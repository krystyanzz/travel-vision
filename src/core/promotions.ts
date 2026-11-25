// Radar de promoções. As promoções são cadastradas pela curadoria a partir de
// comunicações oficiais dos programas (sem scraping). Cada item guarda a fonte.

export type PromotionType = "bonus_transferencia" | "compra_bonificada" | "compra_pontos";

export interface Promotion {
  id: string;
  type: PromotionType;
  title: string;
  fromProgramId?: string;
  toProgramId: string;
  bonusPercent?: number;
  pricePerThousand?: number;
  startsAt: string;
  endsAt: string;
  sourceUrl: string;
  conditions: string;
}

export const PROMOTION_TYPE_LABEL: Record<PromotionType, string> = {
  bonus_transferencia: "Bônus de transferência",
  compra_bonificada: "Compra bonificada",
  compra_pontos: "Compra de pontos",
};

export function activePromotions(list: Promotion[], today = new Date()): Promotion[] {
  const t = today.toISOString().slice(0, 10);
  return list.filter((p) => p.startsAt <= t && p.endsAt >= t).sort((a, b) => a.endsAt.localeCompare(b.endsAt));
}

/** Mapa "origem>destino" → bônus % das promoções ativas, usado pelo simulador e pela carteira. */
export function activeTransferBonuses(list: Promotion[], today = new Date()): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of activePromotions(list, today)) {
    if (p.type !== "bonus_transferencia" || !p.fromProgramId || p.bonusPercent === undefined) continue;
    const key = `${p.fromProgramId}>${p.toProgramId}`;
    out[key] = Math.max(out[key] ?? 0, p.bonusPercent);
  }
  return out;
}

// Exemplos fictícios para desenvolver a interface. Substituir por dados da curadoria.
export const SAMPLE_PROMOTIONS: Promotion[] = [
  {
    id: "exemplo-1",
    type: "bonus_transferencia",
    title: "Exemplo: bônus Livelo → Smiles",
    fromProgramId: "livelo",
    toProgramId: "smiles",
    bonusPercent: 80,
    startsAt: "2026-10-01",
    endsAt: "2026-12-31",
    sourceUrl: "",
    conditions: "Dado fictício de demonstração.",
  },
  {
    id: "exemplo-2",
    type: "bonus_transferencia",
    title: "Exemplo: bônus Esfera → LATAM Pass",
    fromProgramId: "esfera",
    toProgramId: "latam_pass",
    bonusPercent: 50,
    startsAt: "2026-10-15",
    endsAt: "2026-11-30",
    sourceUrl: "",
    conditions: "Dado fictício de demonstração.",
  },
  {
    id: "exemplo-3",
    type: "compra_pontos",
    title: "Exemplo: compra de pontos Livelo com desconto",
    toProgramId: "livelo",
    pricePerThousand: 38,
    startsAt: "2026-10-20",
    endsAt: "2026-11-10",
    sourceUrl: "",
    conditions: "Dado fictício de demonstração.",
  },
];
