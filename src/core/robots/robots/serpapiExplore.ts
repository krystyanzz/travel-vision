import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { serpAirportIds, serpCacheDir, serpReserve } from "./serpapiGoogle";
import { SourceUnavailableError, type FareObservation, type Robot, type RobotContext, type RobotOutput } from "../types";

// Google Travel Explore pela SerpAPI: para uma rota, um mês e uma duração
// ("fim de semana", "1 semana" ou "2 semanas"), devolve a melhor janela de ida e
// volta e 3 a 4 opções de voo. Só cobre os próximos 6 meses. Usado pelas Férias
// flexíveis, sob demanda, com cache de 24 h e o mesmo teto diário da SerpAPI.

const API = "https://serpapi.com/search.json";
const CACHE_TTL = 24 * 3_600_000;
export const EXPLORE_MONTHS_AHEAD = 6;

interface ExploreFlight {
  departure_airport?: { id?: string };
  arrival_airport?: { id?: string };
  duration?: number;
  price?: number;
  number_of_stops?: number;
  airline?: string;
  airline_code?: string;
}
export interface ExploreResponse {
  start_date?: string;
  end_date?: string;
  flights?: ExploreFlight[];
  google_flights_link?: string;
  error?: string;
}

/** Duração do Google mais próxima da faixa pedida: 1 = fim de semana, 2 = 1 semana, 3 = 2 semanas. */
export function exploreDuration(minDays: number, maxDays: number): 1 | 2 | 3 {
  const nominal: [1 | 2 | 3, number][] = [[1, 3], [2, 7], [3, 14]];
  const inRange = nominal.filter(([, d]) => d >= minDays - 1 && d <= maxDays + 1);
  if (inRange.length) return inRange[inRange.length - 1][0];
  const mid = (minDays + maxDays) / 2;
  return nominal.reduce((a, b) => (Math.abs(b[1] - mid) < Math.abs(a[1] - mid) ? b : a))[0];
}

/** Meses (AAAA-MM) do pedido que o Explore cobre: o atual e os 5 seguintes. */
export function exploreMonths(months: string[], today: Date): string[] {
  const limit = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + EXPLORE_MONTHS_AHEAD - 1, 1)).toISOString().slice(0, 7);
  const now = today.toISOString().slice(0, 7);
  return months.filter((m) => m >= now && m <= limit);
}

export function parseExplore(body: ExploreResponse, observedAt: string): FareObservation[] {
  if (!body.start_date || !body.end_date) return [];
  return (body.flights ?? []).flatMap((f) => {
    if (typeof f.price !== "number" || !f.departure_airport?.id || !f.arrival_airport?.id) return [];
    return [{
      kind: "cash" as const,
      origin: f.departure_airport.id.toUpperCase(),
      destination: f.arrival_airport.id.toUpperCase(),
      departDate: body.start_date!,
      departAt: null,
      returnDate: body.end_date!,
      carrier: f.airline_code ?? null,
      flightNumbers: null, // o Explore não informa número nem horário do voo
      stops: f.number_of_stops ?? null,
      durationMin: f.duration ?? null,
      cabin: "economy" as const,
      program: null,
      cashAmount: f.price,
      cashCurrency: "BRL",
      miles: null,
      taxesAmount: null,
      taxesCurrency: null,
      seats: null,
      availability: "nao_confirmada" as const,
      deepLink: body.google_flights_link ?? null,
      seller: "Google Flights",
      observedAt,
    }];
  });
}

async function collect(origin: string, destination: string, months: string[], duration: 1 | 2 | 3, ctx: RobotContext): Promise<RobotOutput> {
  const key = process.env.SERPAPI_API_KEY;
  if (!key) throw new SourceUnavailableError("serpapi-explore", "SERPAPI_API_KEY não configurada", false);
  const fares: FareObservation[] = [];
  const itemErrors: { target: string; message: string }[] = [];
  let calls = 0;
  let partial = false;
  for (const month of exploreMonths(months, ctx.now)) {
    if (ctx.signal.aborted) break;
    const target = `${origin}-${destination} ${month} (duração ${duration})`;
    const file = path.join(serpCacheDir(), `explore-${origin}-${destination}-${month}-${duration}.json`);
    let body: ExploreResponse | null = null;
    let observedAt = new Date().toISOString();
    try {
      const hit = JSON.parse(await readFile(file, "utf8")) as { at: number; body: ExploreResponse };
      if (Date.now() - hit.at < CACHE_TTL) {
        body = hit.body;
        observedAt = new Date(hit.at).toISOString();
      }
    } catch {}
    if (!body) {
      if (!(await serpReserve())) {
        partial = true;
        ctx.log(`${target}: teto diário de consultas atingido`);
        break;
      }
      const qs = new URLSearchParams({
        engine: "google_travel_explore",
        departure_id: serpAirportIds(origin),
        arrival_id: serpAirportIds(destination),
        travel_duration: String(duration),
        month: String(Number(month.slice(5, 7))),
        currency: "BRL",
        hl: "pt-br",
        gl: "br",
        api_key: key,
      });
      calls++;
      try {
        const res = await fetch(`${API}?${qs}`, { signal: ctx.signal });
        const json = (await res.json().catch(() => ({}))) as ExploreResponse;
        if (res.status === 401) throw new SourceUnavailableError("serpapi-explore", "Chave da SerpAPI recusada (HTTP 401)", false);
        if (res.status === 429) throw new SourceUnavailableError("serpapi-explore", "Cota da SerpAPI esgotada (HTTP 429)", false);
        if (json.error && !/no results|hasn't returned any results/i.test(json.error)) throw new Error(json.error);
        body = json;
        await mkdir(serpCacheDir(), { recursive: true });
        await writeFile(file, JSON.stringify({ at: Date.now(), body }));
      } catch (e) {
        if (e instanceof SourceUnavailableError) throw e;
        itemErrors.push({ target, message: e instanceof Error ? e.message : String(e) });
        continue;
      }
    }
    const rows = parseExplore(body, observedAt);
    fares.push(...rows);
    ctx.log(`${target}: ${rows.length} opções, janela ${body.start_date ?? "?"} → ${body.end_date ?? "?"}`);
  }
  if (!fares.length && itemErrors.length) throw new SourceUnavailableError("serpapi-explore", itemErrors[0].message, true);
  return { fares, calls, partial, itemErrors };
}

export const serpapiExploreRobot: Robot = {
  id: "serpapi-explore",
  name: "Melhores janelas (Google Travel Explore via SerpAPI)",
  produces: "fares_cash",
  everyMinutes: 24 * 60,
  onDemandOnly: true,
  covers: { kind: "cash" },
  source: {
    id: "serpapi-explore",
    name: "Google Travel Explore (SerpAPI)",
    access: "api_terceiros",
    termsUrl: "https://serpapi.com/legal",
    commercialUse: "a_confirmar",
    attribution: "Janelas: Google Flights, via SerpAPI",
  },
  notReady: () => (process.env.SERPAPI_API_KEY ? null : "SERPAPI_API_KEY não configurada (conta em serpapi.com)"),
  run: async () => ({ calls: 0, partial: false, itemErrors: [] }),
  collectRoute(q, ctx) {
    if (!q.flex) return Promise.resolve({ calls: 0, partial: false, itemErrors: [] });
    return collect(q.origin, q.destination, q.flex.months, exploreDuration(q.flex.minDays, q.flex.maxDays), ctx);
  },
};

// ---------- "para onde ir": Explore sem destino ----------

interface ExploreDestination {
  name?: string;
  country?: string;
  destination_airport?: { code?: string };
  start_date?: string;
  end_date?: string;
  flight_price?: number;
  number_of_stops?: number;
  airline?: string;
  airline_code?: string;
}

export interface AnywhereOption {
  name: string;
  country: string | null;
  code: string;
  departDate: string;
  returnDate: string;
  price: number;
  stops: number | null;
  airline: string | null;
}

export interface AnywhereResult {
  options: AnywhereOption[];
  observedAt: string;
  status: "ok" | "sem_chave" | "limite" | "erro";
}

/**
 * Destinos mais baratos saindo de `origin`, para um mês (1 a 12; 0 = próximos 6 meses) e uma duração.
 * Uma consulta da SerpAPI, guardada 24 h. Não grava no banco: é uma vitrine de ideias com preço real.
 */
export async function exploreAnywhere(origin: string, month: number, duration: 1 | 2 | 3): Promise<AnywhereResult> {
  const key = process.env.SERPAPI_API_KEY;
  if (!key) return { options: [], observedAt: new Date().toISOString(), status: "sem_chave" };
  const file = path.join(serpCacheDir(), `explore-any-${origin}-${month}-${duration}.json`);
  let body: { destinations?: ExploreDestination[] } | null = null;
  let observedAt = new Date().toISOString();
  try {
    const hit = JSON.parse(await readFile(file, "utf8")) as { at: number; body: { destinations?: ExploreDestination[] } };
    if (Date.now() - hit.at < CACHE_TTL) {
      body = hit.body;
      observedAt = new Date(hit.at).toISOString();
    }
  } catch {}
  if (!body) {
    if (!(await serpReserve())) return { options: [], observedAt, status: "limite" };
    try {
      const qs = new URLSearchParams({ engine: "google_travel_explore", departure_id: serpAirportIds(origin), travel_duration: String(duration), month: String(month), currency: "BRL", hl: "pt-br", gl: "br", api_key: key });
      const res = await fetch(`${API}?${qs}`);
      if (!res.ok) return { options: [], observedAt, status: res.status === 429 ? "limite" : "erro" };
      body = (await res.json()) as { destinations?: ExploreDestination[] };
      await mkdir(serpCacheDir(), { recursive: true });
      await writeFile(file, JSON.stringify({ at: Date.now(), body }));
    } catch {
      return { options: [], observedAt, status: "erro" };
    }
  }
  const options = (body.destinations ?? []).flatMap((d) =>
    typeof d.flight_price === "number" && d.destination_airport?.code && d.start_date && d.end_date
      ? [{ name: d.name ?? d.destination_airport.code, country: d.country ?? null, code: d.destination_airport.code, departDate: d.start_date, returnDate: d.end_date, price: d.flight_price, stops: d.number_of_stops ?? null, airline: d.airline ?? null }]
      : [],
  );
  return { options: options.sort((a, b) => a.price - b.price), observedAt, status: "ok" };
}
