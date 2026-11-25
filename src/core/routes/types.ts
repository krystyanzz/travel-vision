import type { ProviderLicense } from "../providers/types";

export type Weekday = "sun" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat";

/** Um voo regular de uma rota (horário de partida e dias da semana). */
export interface RouteFlight {
  airline: string; // IATA da companhia operadora
  flight: string; // ex.: G31751
  dep: string;
  arr: string;
  depTime: string; // HH:MM local
  arrTime: string;
  durationMin: number | null;
  days: Weekday[];
}

export interface DeparturesResult {
  flights: RouteFlight[];
  /** true quando o limite de páginas foi atingido antes do fim dos dados. */
  partial: boolean;
  fetchedAt: string;
}

export interface RoutesProvider {
  info: { id: string; name: string; license: ProviderLicense; attribution: string };
  departures(iata: string): Promise<DeparturesResult>;
  /** Malha já em cache (sem consultar a fonte); null se nunca foi consultada. */
  peekDepartures?(iata: string): Promise<DeparturesResult | null>;
  airlineNames(codes: string[]): Promise<Record<string, string>>;
  /** Consultas restantes no período, quando o fornecedor informa. */
  quotaRemaining(): number | null;
  /** Consultas feitas à fonte desde que o processo subiu (cache não conta). */
  callsMade?(): number;
}
