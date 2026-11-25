// Simulador de transferência e custo do milheiro (custo por 1.000 milhas, em R$).

export interface TransferInput {
  points: number;
  /** Quanto custou cada 1.000 pontos de origem, em R$ (0 se veio "de graça"). */
  sourceCostPerThousand: number;
  ratio: number;
  /** Bônus da promoção em %, ex.: 80 para 80%. */
  bonusPercent: number;
  /** Custos fixos adicionais em R$ (ex.: taxa de transferência, assinatura de clube). */
  extraCost?: number;
}

export interface TransferResult {
  milesReceived: number;
  baseMiles: number;
  bonusMiles: number;
  totalCost: number;
  costPerThousand: number;
}

export function simulateTransfer(i: TransferInput): TransferResult {
  if (i.points < 0 || i.ratio <= 0 || i.bonusPercent < 0) throw new RangeError("Parâmetros inválidos");
  const baseMiles = Math.floor(i.points * i.ratio);
  const bonusMiles = Math.floor((baseMiles * i.bonusPercent) / 100);
  const milesReceived = baseMiles + bonusMiles;
  const totalCost = (i.points / 1000) * i.sourceCostPerThousand + (i.extraCost ?? 0);
  return {
    milesReceived,
    baseMiles,
    bonusMiles,
    totalCost: round2(totalCost),
    costPerThousand: milesReceived > 0 ? round2(totalCost / (milesReceived / 1000)) : 0,
  };
}

/** Custo do milheiro em uma compra direta de pontos/milhas com bônus. */
export function purchaseCostPerThousand(price: number, milesBought: number, bonusPercent = 0): number {
  const total = milesBought * (1 + bonusPercent / 100);
  return total > 0 ? round2(price / (total / 1000)) : 0;
}

export interface MilesVsCash {
  /** Quanto cada 1.000 milhas "valem" neste resgate, em R$. */
  valuePerThousand: number;
  /** Custo total do resgate considerando o seu custo do milheiro + taxas. */
  awardCost: number;
  savings: number;
  verdict: "milhas" | "dinheiro" | "empate";
}

export function compareMilesVsCash(p: {
  cashPrice: number;
  miles: number;
  taxes: number;
  myCostPerThousand: number;
}): MilesVsCash {
  const valuePerThousand = p.miles > 0 ? round2((p.cashPrice - p.taxes) / (p.miles / 1000)) : 0;
  const awardCost = round2((p.miles / 1000) * p.myCostPerThousand + p.taxes);
  const savings = round2(p.cashPrice - awardCost);
  const margin = p.cashPrice * 0.02;
  const verdict = savings > margin ? "milhas" : savings < -margin ? "dinheiro" : "empate";
  return { valuePerThousand, awardCost, savings, verdict };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
