import { describe, expect, it } from "vitest";
import { partnersOf, programsForAirlines } from "../partners/partners";
import { refreshRoute, runRobot } from "../robots/engine";
import { openStore } from "../robots/store";
import type { FareObservation, Robot, RobotOutput } from "../robots/types";
import { searchFlights } from "./flights";
import { parseFlightQuery } from "./query";

const day = (n: number) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const DATE = day(40);

const fare = (over: Partial<FareObservation>): FareObservation => ({
  kind: "cash", origin: "GRU", destination: "LIS", departDate: DATE, departAt: `${DATE}T22:00:00-03:00`, returnDate: null,
  carrier: "TP", flightNumbers: "TP88", stops: 0, durationMin: 600, cabin: "economy", program: null,
  cashAmount: 4000, cashCurrency: "BRL", miles: null, taxesAmount: null, taxesCurrency: null, seats: null,
  availability: "nao_confirmada", deepLink: "https://exemplo.test/x", observedAt: new Date().toISOString(), ...over,
});

function robot(id: string, covers: Robot["covers"], out: RobotOutput, extra: Partial<Robot> = {}): Robot {
  return {
    id, name: id, produces: covers?.kind === "award" ? "fares_award" : "fares_cash", everyMinutes: 60, covers,
    source: { id: `${id}-src`, name: id, access: "api_oficial", termsUrl: "", commercialUse: "confirmado", attribution: "" },
    notReady: () => null, run: async () => out, ...extra,
  };
}

const q = { origin: "SAO", destination: "LIS", departDate: DATE, returnDate: null, cabin: "any" as const };

describe("busca consolidada", () => {
  it("junta dinheiro e milhas, converte moeda pela PTAX e calcula o valor do milheiro", async () => {
    const store = openStore(":memory:");
    store.upsertFx("bcb-ptax", [{ currency: "USD", base: "BRL", buy: 5, sell: 5, quotedAt: "2026-10-30T13:00:00-03:00", bulletin: "Fechamento" }]);
    const cash = robot("dinheiro", { kind: "cash" }, { fares: [fare({})], calls: 1, partial: false, itemErrors: [] });
    const award = robot("milhas", { kind: "award", programs: ["smiles"] }, {
      fares: [fare({ kind: "award", program: "smiles", cashAmount: null, cashCurrency: null, miles: 70000, taxesAmount: 100, taxesCurrency: "USD", flightNumbers: "TP88" })],
      calls: 1, partial: false, itemErrors: [],
    });
    await runRobot(cash, store);
    await runRobot(award, store);

    const r = searchFlights(store, q, [cash, award]);
    const [leg] = r.legs;
    expect(leg.results).toHaveLength(2); // SAO expande para GRU
    const a = leg.results.find((f) => f.kind === "award")!;
    expect(a.taxesBrl).toBe(500);
    expect(a.valuePerThousand).toBe(50); // (4000 - 500) / 70
    expect(a.programName).toBe("Smiles");
    expect(r.modalities.find((m) => m.id === "cash")!.status).toBe("com_resultados");
    expect(r.modalities.find((m) => m.id === "smiles")!.status).toBe("com_resultados");
    expect(r.modalities.find((m) => m.id === "latampass")!.status).toBe("sem_fonte");
    expect(leg.calendar.days.find((d) => d.date === DATE)!.lowestAmount).toBe(4000);
  });

  it("sem fonte conectada: nenhum resultado e modalidades dizem por quê", () => {
    const store = openStore(":memory:");
    const r = searchFlights(store, q, []);
    expect(r.legs[0].results).toHaveLength(0);
    expect(r.modalities.every((m) => m.status === "sem_fonte")).toBe(true);
    expect(r.onDemand).toBe(false);
  });

  it("fonte conectada que falhou aparece como indisponível", async () => {
    const store = openStore(":memory:");
    const broken = robot("dinheiro", { kind: "cash" }, { calls: 0, partial: false, itemErrors: [] }, { run: async () => { throw new Error("HTTP 503"); } });
    await runRobot(broken, store);
    expect(searchFlights(store, q, [broken]).modalities[0].status).toBe("indisponivel");
  });

  it("ida e volta busca os dois sentidos", () => {
    const r = searchFlights(openStore(":memory:"), { ...q, returnDate: day(50) }, []);
    expect(r.legs.map((l) => `${l.leg}:${l.origin}-${l.destination}`)).toEqual(["ida:SAO-LIS", "volta:LIS-SAO"]);
  });

  it("valida a consulta da URL", () => {
    expect(parseFlightQuery(new URLSearchParams("de=gru&para=lis&ida=2030-01-10")).ok).toBe(true);
    expect(parseFlightQuery(new URLSearchParams("de=GRU&para=GRU&ida=2030-01-10")).ok).toBe(false);
    expect(parseFlightQuery(new URLSearchParams("de=GRU&para=LIS&ida=2030-01-10&volta=2030-01-01")).ok).toBe(false);
  });
});

describe("atualização sob demanda", () => {
  it("roda só robôs com coleta pontual e respeita o intervalo mínimo por rota", async () => {
    const store = openStore(":memory:");
    let calls = 0;
    const r = robot("dinheiro", { kind: "cash" }, { calls: 0, partial: false, itemErrors: [] }, {
      collectRoute: async () => {
        calls++;
        return { fares: [fare({})], calls: 1, partial: false, itemErrors: [] };
      },
    });
    const req = { origin: "GRU", destination: "LIS", months: [DATE.slice(0, 7)] };
    expect((await refreshRoute([r], store, req)).refreshed).toBe(true);
    expect((await refreshRoute([r], store, req)).refreshed).toBe(false);
    expect(calls).toBe(1);
    expect((await refreshRoute([robot("x", { kind: "cash" }, { calls: 0, partial: false, itemErrors: [] })], store, req)).message).toMatch(/Nenhuma fonte/);
  });
});

describe("parcerias de resgate", () => {
  it("programa lista só parcerias com fonte; conflitantes ficam à parte", () => {
    const latam = partnersOf("latampass")!;
    expect(latam.partners.map((p) => p.airline)).toContain("DL");
    expect(latam.partners.map((p) => p.airline)).not.toContain("AS");
    expect(latam.disputed.map((p) => p.airline)).toContain("AS");
  });

  it("companhias da rota → programas; aliança não conta e programas sem revisão não aparecem", () => {
    const ids = programsForAirlines(["TP"]).map((m) => m.program.id);
    expect(ids).toEqual(expect.arrayContaining(["smiles", "azul"]));
    expect(ids).not.toContain("united"); // mesma aliança da TAP, mas lista não validada
    expect(programsForAirlines(["JJ"]).map((m) => m.program.id)).toContain("latampass"); // JJ = LATAM Brasil
  });
});

describe("viagens de ida e volta", () => {
  const IDA = day(40);
  const VOLTA = day(44);
  it("monta dois bilhetes com preços reais e inclui o bilhete único da fonte", async () => {
    const store = openStore(":memory:");
    const r = robot("dinheiro", { kind: "cash" }, {
      fares: [
        fare({ origin: "GRU", destination: "SCL", departDate: IDA, departAt: `${IDA}T08:00:00-03:00`, cashAmount: 800, flightNumbers: "LA800", durationMin: 240 }),
        fare({ origin: "GRU", destination: "SCL", departDate: IDA, departAt: `${IDA}T15:00:00-03:00`, cashAmount: 950, flightNumbers: "JA950", durationMin: 230 }),
        fare({ origin: "SCL", destination: "GRU", departDate: VOLTA, departAt: `${VOLTA}T10:00:00-04:00`, cashAmount: 700, flightNumbers: "LA701", durationMin: 235 }),
        // bilhete único ida e volta vendido pela fonte
        fare({ origin: "GRU", destination: "SCL", departDate: IDA, departAt: `${IDA}T22:00:00-03:00`, returnDate: VOLTA, returnAt: `${VOLTA}T06:00:00-04:00`, returnStops: 0, returnDurationMin: 230, cashAmount: 1400, flightNumbers: "AR3007", durationMin: 250 }),
      ],
      calls: 1, partial: false, itemErrors: [],
    });
    await runRobot(r, store);
    const res = searchFlights(store, { ...q, destination: "SCL", departDate: IDA, returnDate: VOLTA }, [r]);
    expect(res.trips.map((t) => `${t.ticket}:${t.totalBrl}`)).toEqual(["ida_e_volta:1400", "dois_bilhetes:1500", "dois_bilhetes:1650"]);
    const rt = res.trips.find((t) => t.ticket === "ida_e_volta")!;
    expect(rt.back).toMatchObject({ origin: "SCL", destination: "GRU", date: VOLTA, stops: 0, durationMin: 230 });
    expect(rt.totalDurationMin).toBe(480);
    const two = res.trips[1];
    expect(two.offers.map((o) => o.brl)).toEqual([800, 700]);
    // o bilhete único não aparece como preço de um trecho só
    expect(res.legs[0].results.map((f) => f.cashAmount)).toEqual([800, 950]);
  });

  it("sem preço de volta: nenhuma viagem completa", async () => {
    const store = openStore(":memory:");
    const r = robot("dinheiro", { kind: "cash" }, { fares: [fare({ origin: "GRU", destination: "SCL", departDate: IDA })], calls: 1, partial: false, itemErrors: [] });
    await runRobot(r, store);
    const res = searchFlights(store, { ...q, destination: "SCL", departDate: IDA, returnDate: VOLTA }, [r]);
    expect(res.trips).toHaveLength(0);
    expect(res.legs[0].results).toHaveLength(1);
  });
});

describe("mesma viagem em duas fontes", () => {
  it("junta numa opção só, com a mais barata na frente e a outra em 'também em'", async () => {
    const store = openStore(":memory:");
    const D = day(40);
    const tp = robot("tp", { kind: "cash" }, { fares: [fare({ departDate: D, departAt: `${D}T22:00:00-03:00`, flightNumbers: "TP88", cashAmount: 3000 })], calls: 1, partial: false, itemErrors: [] });
    const g = robot("g", { kind: "cash" }, { fares: [fare({ departDate: D, departAt: `${D}T22:00:00`, flightNumbers: "TP88", cashAmount: 2800, seller: "Google Flights" })], calls: 1, partial: false, itemErrors: [] });
    await runRobot(tp, store);
    await runRobot(g, store);
    const res = searchFlights(store, { ...q, departDate: D }, [tp, g]);
    expect(res.trips).toHaveLength(1);
    expect(res.trips[0].totalBrl).toBe(2800);
    expect(res.trips[0].alsoFrom).toEqual([expect.objectContaining({ sourceId: "tp-src", totalBrl: 3000 })]);
  });
});

describe("viagens diferentes com o mesmo primeiro voo", () => {
  it("não junta itinerários com conexões diferentes da mesma fonte", async () => {
    const store = openStore(":memory:");
    const D = day(41);
    const g = robot("g", { kind: "cash" }, {
      fares: [
        fare({ departDate: D, departAt: `${D}T09:40:00`, flightNumbers: "LA4593+LA8146", cashAmount: 2875 }),
        fare({ departDate: D, departAt: `${D}T09:40:00`, flightNumbers: "LA4593+LA8148", cashAmount: 3010 }),
      ],
      calls: 1, partial: false, itemErrors: [],
    });
    await runRobot(g, store);
    expect(searchFlights(store, { ...q, departDate: D }, [g]).trips).toHaveLength(2);
  });
});
