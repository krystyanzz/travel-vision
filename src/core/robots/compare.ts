import { compareMilesVsCash } from "../miles/simulator";
import { priceLevel } from "../pricing";
import type { Availability } from "./types";

// Motor de comparação dinheiro x milhas. Só compara observações reais
// (confirmada / nao_confirmada), sempre carregando a fonte e o horário de cada
// lado, e só converte moeda com uma cotação registrada (fonte e data visíveis).

export interface PricedFare {
  key: string;
  sourceId: string;
  kind: "cash" | "award";
  origin: string;
  destination: string;
  departDate: string;
  carrier: string | null;
  program: string | null;
  cashAmount: number | null;
  cashCurrency: string | null;
  miles: number | null;
  taxesAmount: number | null;
  taxesCurrency: string | null;
  availability: Availability;
  observedAt: string;
}

export interface FxRate {
  currency: string;
  sell: number; // R$ por unidade da moeda
  quotedAt: string;
  sourceId: string;
}

export interface Money {
  brl: number;
  original: { amount: number; currency: string };
  fx: FxRate | null; // null quando já estava em BRL
}

/** Converte para BRL. Sem cotação registrada para a moeda, devolve null (nunca chuta câmbio). */
export function toBrl(amount: number, currency: string, rates: FxRate[]): Money | null {
  const cur = currency.toUpperCase();
  if (cur === "BRL") return { brl: round2(amount), original: { amount, currency: cur }, fx: null };
  const fx = rates.find((r) => r.currency === cur);
  return fx ? { brl: round2(amount * fx.sell), original: { amount, currency: cur }, fx } : null;
}

export interface Comparison {
  cash: PricedFare & { total: Money };
  award: PricedFare & { taxes: Money };
  /** Valor obtido por 1.000 milhas neste resgate, em R$. */
  valuePerThousand: number;
  /** Custo por ponto, em centavos de R$. */
  centsPerPoint: number;
  /** Com o seu custo do milheiro informado: custo do resgate, economia e veredito. */
  withMyCost: { awardCost: number; savings: number; verdict: "milhas" | "dinheiro" | "empate" } | null;
  best: "milhas" | "dinheiro" | "indefinido";
  warnings: string[];
}

const REAL: Availability[] = ["confirmada", "nao_confirmada"];
const HOURS = 3_600_000;

/**
 * Compara a melhor tarifa em dinheiro com cada resgate da mesma rota e data.
 * Não mistura observações sem mostrar a origem; avisa quando os horários das
 * consultas estão distantes ou quando a disponibilidade não está confirmada.
 */
export function compareRoute(fares: PricedFare[], rates: FxRate[], myCostPerThousand?: number): Comparison[] {
  const real = fares.filter((f) => REAL.includes(f.availability));
  const out: Comparison[] = [];
  const byDay = new Map<string, PricedFare[]>();
  for (const f of real) {
    const k = `${f.origin}|${f.destination}|${f.departDate}`;
    byDay.set(k, [...(byDay.get(k) ?? []), f]);
  }
  for (const list of byDay.values()) {
    const cashes = list
      .filter((f) => f.kind === "cash" && f.cashAmount != null && f.cashCurrency)
      .map((f) => ({ f, total: toBrl(f.cashAmount!, f.cashCurrency!, rates) }))
      .filter((x): x is { f: PricedFare; total: Money } => !!x.total)
      .sort((a, b) => a.total.brl - b.total.brl);
    const cheapest = cashes[0];
    if (!cheapest) continue;
    for (const a of list.filter((f) => f.kind === "award" && f.miles)) {
      const taxes = toBrl(a.taxesAmount ?? 0, a.taxesCurrency ?? "BRL", rates);
      if (!taxes) continue; // taxa em moeda sem cotação: não dá para comparar honestamente
      const base = compareMilesVsCash({ cashPrice: cheapest.total.brl, miles: a.miles!, taxes: taxes.brl, myCostPerThousand: myCostPerThousand ?? 0 });
      const warnings: string[] = [];
      if (Math.abs(Date.parse(cheapest.f.observedAt) - Date.parse(a.observedAt)) > 24 * HOURS) warnings.push("Preços consultados com mais de 24 h de diferença");
      if (cheapest.f.availability !== "confirmada") warnings.push("Disponibilidade da tarifa em dinheiro não confirmada");
      if (a.availability !== "confirmada") warnings.push("Disponibilidade do resgate não confirmada");
      if (cheapest.f.sourceId !== a.sourceId) warnings.push(`Fontes diferentes: ${cheapest.f.sourceId} e ${a.sourceId}`);
      const withMyCost = myCostPerThousand != null ? { awardCost: base.awardCost, savings: base.savings, verdict: base.verdict } : null;
      out.push({
        cash: { ...cheapest.f, total: cheapest.total },
        award: { ...a, taxes },
        valuePerThousand: base.valuePerThousand,
        centsPerPoint: round2(base.valuePerThousand / 10),
        withMyCost,
        best: withMyCost ? (withMyCost.verdict === "empate" ? "indefinido" : withMyCost.verdict) : "indefinido",
        warnings,
      });
    }
  }
  return out.sort((x, y) => y.valuePerThousand - x.valuePerThousand);
}

/**
 * Oportunidade em dinheiro: preço no quartil mais baixo do que os robôs já
 * viram na rota/mês, com pelo menos 8 amostras (menos que isso não é tendência).
 */
export function isCashOpportunity(amount: number, samples: number[]): boolean {
  if (samples.length < 8) return false;
  return priceLevel(amount, samples) === "baixo";
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
