import { describe, expect, it } from "vitest";
import { compareMilesVsCash, purchaseCostPerThousand, simulateTransfer } from "./miles/simulator";
import { expiringWithin, reachableMiles, whatCanIIssue, type WalletEntry } from "./miles/wallet";
import { priceLevel } from "./pricing";
import { activeTransferBonuses, SAMPLE_PROMOTIONS } from "./promotions";
import { QuotaExceededError, SlidingWindowQuota, TtlCache } from "./providers/quota";
import type { AwardAvailability } from "./providers/types";

describe("simulateTransfer", () => {
  it("calcula milhas com bônus e custo do milheiro", () => {
    // 10.000 pontos comprados a R$ 40/milheiro = R$ 400; com 100% de bônus viram 20.000 milhas
    const r = simulateTransfer({ points: 10_000, sourceCostPerThousand: 40, ratio: 1, bonusPercent: 100 });
    expect(r.milesReceived).toBe(20_000);
    expect(r.bonusMiles).toBe(10_000);
    expect(r.totalCost).toBe(400);
    expect(r.costPerThousand).toBe(20);
  });

  it("considera paridade diferente de 1:1 e custos extras", () => {
    const r = simulateTransfer({ points: 5_000, sourceCostPerThousand: 30, ratio: 0.5, bonusPercent: 0, extraCost: 25 });
    expect(r.milesReceived).toBe(2_500);
    expect(r.totalCost).toBe(175);
    expect(r.costPerThousand).toBe(70);
  });

  it("rejeita parâmetros inválidos", () => {
    expect(() => simulateTransfer({ points: 1, sourceCostPerThousand: 1, ratio: 0, bonusPercent: 0 })).toThrow();
  });
});

describe("purchaseCostPerThousand", () => {
  it("aplica bônus na compra", () => {
    expect(purchaseCostPerThousand(700, 20_000, 0)).toBe(35);
    expect(purchaseCostPerThousand(700, 20_000, 100)).toBe(17.5);
  });
});

describe("compareMilesVsCash", () => {
  it("indica milhas quando o resgate sai mais barato", () => {
    const r = compareMilesVsCash({ cashPrice: 3_000, miles: 60_000, taxes: 120, myCostPerThousand: 20 });
    expect(r.valuePerThousand).toBe(48);
    expect(r.awardCost).toBe(1_320);
    expect(r.verdict).toBe("milhas");
  });

  it("indica dinheiro quando a passagem paga é mais barata", () => {
    const r = compareMilesVsCash({ cashPrice: 800, miles: 50_000, taxes: 60, myCostPerThousand: 25 });
    expect(r.verdict).toBe("dinheiro");
  });
});

const wallet: WalletEntry[] = [
  { programId: "smiles", balance: 20_000, expiresAt: "2026-11-15" },
  { programId: "livelo", balance: 30_000, expiresAt: "2027-06-01" },
];

function award(program: string, miles: number): AwardAvailability {
  return {
    providerId: "teste",
    program,
    operatingCarrier: "Aérea Alfa",
    origin: "GRU",
    destination: "LIS",
    date: "2027-03-10",
    cabin: "economy",
    seats: 2,
    miles,
    taxesAmount: 300,
    taxesCurrency: "BRL",
    direct: true,
    fetchedAt: "2026-10-30T00:00:00Z",
  };
}

describe("carteira", () => {
  it("lista saldos que vencem no período", () => {
    expect(expiringWithin(wallet, 30, new Date("2026-10-30"))).toHaveLength(1);
  });

  it("soma saldo direto e transferências com bônus", () => {
    const r = reachableMiles(wallet, "smiles", { "livelo>smiles": 80 });
    expect(r.direct).toBe(20_000);
    expect(r.viaTransfer[0].milesObtained).toBe(54_000);
    expect(r.total).toBe(74_000);
  });

  it("responde o que dá para emitir, priorizando o que não exige transferência", () => {
    const awards = [award("smiles", 70_000), award("smiles", 15_000), award("latam_pass", 40_000), award("azul_fidelidade", 99_000)];
    const r = whatCanIIssue(wallet, awards, { "livelo>smiles": 80 });
    // LATAM Pass: 30.000 Livelo sem bônus não alcançam 40.000; Azul: saldo insuficiente
    expect(r.map((o) => [o.award.program, o.award.miles])).toEqual([
      ["smiles", 15_000],
      ["smiles", 70_000],
    ]);
    expect(r[0].fromTransfers).toBe(0);
    expect(r[1].fromTransfers).toBe(50_000);
  });
});

describe("promoções", () => {
  it("extrai bônus vigentes por rota", () => {
    const b = activeTransferBonuses(SAMPLE_PROMOTIONS, new Date("2026-10-30"));
    expect(b["livelo>smiles"]).toBe(80);
    expect(b["esfera>latam_pass"]).toBe(50);
  });
});

describe("priceLevel", () => {
  const ref = [100, 200, 300, 400, 500, 600, 700, 800];
  it("classifica por quartis", () => {
    expect(priceLevel(150, ref)).toBe("baixo");
    expect(priceLevel(450, ref)).toBe("normal");
    expect(priceLevel(790, ref)).toBe("alto");
  });
});

describe("cota e cache", () => {
  it("bloqueia ao exceder o limite e libera após a janela", () => {
    let t = 0;
    const q = new SlidingWindowQuota("x", 2, 1_000, () => t);
    q.take();
    q.take();
    expect(() => q.take()).toThrow(QuotaExceededError);
    t = 1_001;
    expect(() => q.take()).not.toThrow();
  });

  it("expira entradas do cache", async () => {
    let t = 0;
    const c = new TtlCache<number>(100, () => t);
    let loads = 0;
    await c.getOrLoad("k", async () => ++loads);
    await c.getOrLoad("k", async () => ++loads);
    expect(loads).toBe(1);
    t = 101;
    await c.getOrLoad("k", async () => ++loads);
    expect(loads).toBe(2);
  });
});
