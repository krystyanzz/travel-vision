import type { AwardAvailability } from "../providers/types";
import { routesTo } from "./programs";

// Carteira de pontos informada pelo próprio usuário. Nunca armazenamos login
// ou senha de programas (diretriz, regra 6): apenas saldo, validade e custo.

export interface WalletEntry {
  programId: string;
  balance: number;
  expiresAt?: string; // AAAA-MM-DD
  costPerThousand?: number;
}

export function expiringWithin(wallet: WalletEntry[], days: number, today = new Date()): WalletEntry[] {
  const limit = today.getTime() + days * 86_400_000;
  return wallet.filter((e) => e.expiresAt && new Date(`${e.expiresAt}T23:59:59`).getTime() <= limit);
}

export interface ReachPath {
  fromProgramId: string;
  pointsNeeded: number;
  milesObtained: number;
  bonusPercent: number;
}

export interface Reach {
  programId: string;
  direct: number;
  viaTransfer: ReachPath[];
  total: number;
}

/** Quantas milhas o usuário consegue reunir em um programa, somando transferências com bônus vigentes. */
export function reachableMiles(
  wallet: WalletEntry[],
  programId: string,
  bonuses: Record<string, number> = {}, // chave "origem>destino" → bônus %
): Reach {
  const direct = wallet.filter((e) => e.programId === programId).reduce((s, e) => s + e.balance, 0);
  const viaTransfer: ReachPath[] = [];
  for (const route of routesTo(programId)) {
    const pts = wallet.filter((e) => e.programId === route.from).reduce((s, e) => s + e.balance, 0);
    if (pts <= 0) continue;
    const bonus = bonuses[`${route.from}>${programId}`] ?? 0;
    const miles = Math.floor(pts * route.ratio * (1 + bonus / 100));
    viaTransfer.push({ fromProgramId: route.from, pointsNeeded: pts, milesObtained: miles, bonusPercent: bonus });
  }
  return { programId, direct, viaTransfer, total: direct + viaTransfer.reduce((s, p) => s + p.milesObtained, 0) };
}

export interface IssuableOption {
  award: AwardAvailability;
  reach: Reach;
  /** Milhas que ainda precisam vir de transferência (0 = emite só com saldo direto). */
  fromTransfers: number;
}

/** "O que eu consigo emitir com o que tenho": cruza carteira com disponibilidade. */
export function whatCanIIssue(
  wallet: WalletEntry[],
  awards: AwardAvailability[],
  bonuses: Record<string, number> = {},
): IssuableOption[] {
  const cache = new Map<string, Reach>();
  const out: IssuableOption[] = [];
  for (const award of awards) {
    let reach = cache.get(award.program);
    if (!reach) {
      reach = reachableMiles(wallet, award.program, bonuses);
      cache.set(award.program, reach);
    }
    if (reach.total >= award.miles) {
      out.push({ award, reach, fromTransfers: Math.max(0, award.miles - reach.direct) });
    }
  }
  return out.sort((a, b) => a.fromTransfers - b.fromTransfers || a.award.miles - b.award.miles);
}
