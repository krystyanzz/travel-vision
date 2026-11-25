import { AIRLINE_ALIASES, AIRLINE_NAMES, LOYALTY_PROGRAMS, REDEMPTION_PARTNERS, type LoyaltyProgram, type RedemptionPartner } from "./data";

// Consultas sobre parcerias de resgate. Só evidência "oficial" ou "secundaria"
// conta como parceria; "conflito" volta separado, para a tela avisar.

export const airlineName = (code: string) => AIRLINE_NAMES[code] ?? code;
const canonical = (code: string) => AIRLINE_ALIASES[code] ?? code;
const counts = (p: RedemptionPartner) => p.evidence !== "conflito";

export function program(id: string): LoyaltyProgram | undefined {
  return LOYALTY_PROGRAMS.find((p) => p.id === id);
}

export interface ProgramPartners {
  program: LoyaltyProgram;
  partners: (RedemptionPartner & { airlineName: string })[];
  disputed: (RedemptionPartner & { airlineName: string })[];
}

/** Em quais companhias dá para emitir com o saldo deste programa. */
export function partnersOf(programId: string): ProgramPartners | null {
  const prog = program(programId);
  if (!prog) return null;
  const all = REDEMPTION_PARTNERS.filter((p) => p.program === programId).map((p) => ({ ...p, airlineName: airlineName(p.airline) }));
  return { program: prog, partners: all.filter(counts), disputed: all.filter((p) => !counts(p)) };
}

export interface ProgramMatch {
  program: LoyaltyProgram;
  /** Companhias da rota em que o programa emite, com a evidência de cada uma. */
  via: { airline: string; airlineName: string; evidence: RedemptionPartner["evidence"]; source: string }[];
  disputed: { airline: string; airlineName: string; note?: string }[];
}

/** Quais programas permitem voar com alguma das companhias informadas (ex.: as que operam a rota). */
export function programsForAirlines(airlines: string[]): ProgramMatch[] {
  const set = new Set(airlines.map(canonical));
  return LOYALTY_PROGRAMS.flatMap((prog) => {
    const rel = REDEMPTION_PARTNERS.filter((p) => p.program === prog.id && set.has(p.airline));
    const via = rel.filter(counts).map((p) => ({ airline: p.airline, airlineName: airlineName(p.airline), evidence: p.evidence, source: p.source }));
    const disputed = rel.filter((p) => !counts(p)).map((p) => ({ airline: p.airline, airlineName: airlineName(p.airline), note: p.note }));
    return via.length || disputed.length ? [{ program: prog, via, disputed }] : [];
  }).sort((a, b) => b.via.length - a.via.length);
}

/** Programas cuja lista de parceiras ainda não foi conferida (não entram nas respostas). */
export function unreviewedPrograms(): LoyaltyProgram[] {
  return LOYALTY_PROGRAMS.filter((p) => !p.partnersReviewed);
}
