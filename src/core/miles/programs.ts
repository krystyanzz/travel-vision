// Programas brasileiros e caminhos de transferência.
// ATENÇÃO: paridades e parcerias abaixo são valores-semente para desenvolvimento.
// Devem ser conferidos e mantidos pela curadoria nas fontes oficiais de cada
// programa antes de exibir ao usuário como informação vigente.

export type ProgramKind = "aereo" | "banco";

export interface Program {
  id: string;
  name: string;
  kind: ProgramKind;
}

export const PROGRAMS: Program[] = [
  { id: "latam_pass", name: "LATAM Pass", kind: "aereo" },
  { id: "smiles", name: "Smiles", kind: "aereo" },
  { id: "azul_fidelidade", name: "Azul Fidelidade", kind: "aereo" },
  { id: "livelo", name: "Livelo", kind: "banco" },
  { id: "esfera", name: "Esfera", kind: "banco" },
  { id: "c6_atomos", name: "C6 Átomos", kind: "banco" },
];

export interface TransferRoute {
  from: string;
  to: string;
  /** Milhas recebidas por ponto transferido, sem bônus. */
  ratio: number;
  verified: boolean;
}

export const TRANSFER_ROUTES: TransferRoute[] = [
  { from: "livelo", to: "smiles", ratio: 1, verified: false },
  { from: "livelo", to: "latam_pass", ratio: 1, verified: false },
  { from: "livelo", to: "azul_fidelidade", ratio: 1, verified: false },
  { from: "esfera", to: "smiles", ratio: 1, verified: false },
  { from: "esfera", to: "latam_pass", ratio: 1, verified: false },
  { from: "esfera", to: "azul_fidelidade", ratio: 1, verified: false },
  { from: "c6_atomos", to: "smiles", ratio: 1, verified: false },
  { from: "c6_atomos", to: "latam_pass", ratio: 1, verified: false },
  { from: "c6_atomos", to: "azul_fidelidade", ratio: 1, verified: false },
];

export function programName(id: string): string {
  return PROGRAMS.find((p) => p.id === id)?.name ?? id;
}

export function routesTo(programId: string): TransferRoute[] {
  return TRANSFER_ROUTES.filter((r) => r.to === programId);
}

export function routesFrom(programId: string): TransferRoute[] {
  return TRANSFER_ROUTES.filter((r) => r.from === programId);
}
