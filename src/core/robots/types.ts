import type { Cabin } from "../types";

// Robôs de coleta. Cada robô fala com UMA fonte e devolve observações
// normalizadas; o motor (engine.ts) cuida de agenda, cota, deduplicação,
// histórico, detecção de mudanças e registro de erros.

/** Como o robô acessa a fonte. "navegador" só roda com permissão documentada nos termos da fonte. */
/** Como o robô acessa a fonte. "navegador" só roda com permissão documentada nos termos da fonte.
 *  "api_terceiros" = API paga de um intermediário que entrega dados de outro serviço (ex.: SerpAPI → Google Flights). */
export type AccessMethod = "api_oficial" | "api_afiliado" | "api_terceiros" | "dados_abertos" | "navegador";

export interface SourceInfo {
  id: string;
  name: string;
  access: AccessMethod;
  termsUrl: string;
  /** Evidência de que os termos permitem coleta automatizada. Obrigatória para "navegador". */
  automationPermitted?: { evidenceUrl: string; checkedAt: string; note: string };
  commercialUse: "confirmado" | "a_confirmar" | "nao_permitido";
  attribution: string;
}

/**
 * Classificação obrigatória de todo preço (regra 4):
 * confirmada = preço e assento confirmados pela fonte no momento da consulta;
 * nao_confirmada = preço encontrado, disponibilidade não garantida (ex.: cache de buscas);
 * historico = registro antigo, mantido para tendência;
 * estimativa = simulação/cálculo; nunca exibir como preço real.
 */
export type Availability = "confirmada" | "nao_confirmada" | "historico" | "estimativa";

export interface FareObservation {
  kind: "cash" | "award";
  origin: string;
  destination: string;
  departDate: string; // AAAA-MM-DD
  departAt: string | null; // ISO com fuso, quando a fonte informa
  returnDate: string | null;
  carrier: string | null; // IATA da operadora
  flightNumbers: string | null; // ex.: "LA8084" ou "LA3000+LA8084"
  stops: number | null;
  durationMin: number | null;
  cabin: Cabin | null;
  program: string | null; // programa de fidelidade (só award)
  cashAmount: number | null;
  cashCurrency: string | null; // moeda original da fonte
  miles: number | null;
  taxesAmount: number | null;
  taxesCurrency: string | null;
  seats: number | null;
  availability: Availability;
  deepLink: string | null; // redirecionamento para o parceiro
  /** Quem vende a tarifa (agência ou companhia), quando a fonte informa. */
  seller?: string | null;
  /** Tarifa de ida e volta: dados do trecho de volta, quando a fonte informa. */
  returnAt?: string | null;
  returnStops?: number | null;
  returnDurationMin?: number | null;
  /** Chegada do trecho (horário local do destino), quando a fonte informa. */
  arriveAt?: string | null;
  observedAt: string; // ISO, momento da consulta
}

export interface ScheduleObservation {
  origin: string;
  destination: string;
  airline: string;
  flight: string;
  depTime: string;
  arrTime: string;
  durationMin: number | null;
  days: string[];
}

export interface FxObservation {
  currency: string; // moeda estrangeira
  base: "BRL";
  buy: number;
  sell: number;
  quotedAt: string; // data/hora da cotação na fonte
  bulletin: string; // tipo de boletim (PTAX)
}

export interface RobotOutput {
  fares?: FareObservation[];
  /** Malha por aeroporto de origem: a lista substitui a anterior daquele aeroporto. */
  schedules?: { origin: string; flights: ScheduleObservation[]; partial: boolean; fetchedAt: string }[];
  fx?: FxObservation[];
  /** Consultas feitas à fonte nesta execução (para a cota). */
  calls: number;
  /** true quando a fonte não devolveu tudo (limite de linhas, cota, falha parcial). */
  partial: boolean;
  /** Erros por item que não derrubam a execução inteira. */
  itemErrors: { target: string; message: string }[];
}

export interface RobotContext {
  now: Date;
  signal: AbortSignal;
  log: (message: string) => void;
}

export interface Robot {
  id: string;
  name: string;
  produces: "fares_cash" | "fares_award" | "schedules" | "fx";
  source: SourceInfo;
  /** Frequência padrão em minutos (sobrescrita por ROBOT_<ID>_EVERY_MIN). */
  everyMinutes: number;
  /** null = pronto para rodar; texto = motivo de não estar configurado (ex.: falta chave). */
  notReady(): string | null;
  run(ctx: RobotContext): Promise<RobotOutput>;
  /** Coleta sob demanda de uma rota (busca do usuário). Só robôs cuja fonte permite consulta pontual. */
  collectRoute?(q: RouteRequest, ctx: RobotContext): Promise<RobotOutput>;
  /** true = só coleta sob demanda (busca do usuário); o agendador não o roda sozinho (cota pequena). */
  onDemandOnly?: boolean;
  /** Modalidade e programa que o robô cobre (para a busca saber de onde vêm os resultados). */
  covers?: { kind: "cash" } | { kind: "award"; programs: string[] };
}

export interface RouteRequest {
  origin: string;
  destination: string;
  months: string[]; // AAAA-MM
  /** Datas exatas buscadas pelo usuário (AAAA-MM-DD), para fontes que consultam dia a dia. */
  dates?: string[];
  /** Também buscar tarifas de ida e volta (bilhete único) para estes meses. */
  roundTrip?: { departMonth: string; returnMonth: string };
  /** Férias flexíveis: varrer estes meses atrás de janelas de ida e volta com essa duração. */
  flex?: { months: string[]; minDays: number; maxDays: number };
}

export class SourceUnavailableError extends Error {
  constructor(public readonly sourceId: string, message: string, public readonly retryable: boolean) {
    super(`[${sourceId}] ${message}`);
  }
}
