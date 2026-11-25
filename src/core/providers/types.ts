import type { CalendarDay, CashOffer, CashSearchQuery, Cabin } from "../types";

// Metadados obrigatórios de licença de cada fornecedor (diretriz, seção 4.3).
// Um adaptador sem licença comercial confirmada não pode ir para produção.
export interface ProviderLicense {
  commercialUse: "confirmado" | "a_confirmar" | "nao_permitido";
  redistribution: "permitida" | "a_confirmar" | "nao_permitida";
  attribution?: string; // texto exigido pelo fornecedor, exibido junto aos resultados
  termsUrl?: string;
}

export interface ProviderInfo {
  id: string;
  name: string;
  kind: "cash" | "award";
  license: ProviderLicense;
  realtime: boolean;
  /** Dados sintéticos para desenvolvimento: nunca exibir como preço real. */
  synthetic?: boolean;
}

export interface CashFareProvider {
  info: ProviderInfo;
  search(query: CashSearchQuery): Promise<CashOffer[]>;
  /** Menor preço por dia. Fornecedores sem endpoint próprio usam fallback por busca. */
  calendar?(query: Omit<CashSearchQuery, "departureDate">, month: string): Promise<CalendarDay[]>;
}

export interface AwardAvailability {
  providerId: string;
  program: string; // id do programa (ex.: "smiles")
  operatingCarrier: string;
  origin: string;
  destination: string;
  date: string;
  cabin: Cabin;
  seats: number | null;
  miles: number;
  taxesAmount: number;
  taxesCurrency: string;
  direct: boolean;
  fetchedAt: string;
}

export interface AwardProvider {
  info: ProviderInfo;
  availability(params: {
    origin: string;
    destination: string;
    dateFrom: string;
    dateTo: string;
    cabin?: Cabin;
  }): Promise<AwardAvailability[]>;
}

export class ProviderError extends Error {
  constructor(
    public readonly providerId: string,
    message: string,
    public readonly retryable = false,
  ) {
    super(`[${providerId}] ${message}`);
  }
}
