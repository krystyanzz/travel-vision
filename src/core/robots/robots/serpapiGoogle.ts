import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { METRO_AREAS } from "../../airportsDb";
import { SourceUnavailableError, type FareObservation, type Robot, type RobotContext, type RobotOutput } from "../types";
import type { Cabin } from "../../types";

// Preços do Google Flights pela SerpAPI (API paga que entrega os resultados do
// Google em JSON). Consulta só ida, por data exata, e só quando alguém busca:
// o plano grátis tem 250 consultas/mês. Cada resposta fica 12 h em cache e há
// teto diário de consultas, gravado em disco.

const API = "https://serpapi.com/search.json";
const CACHE_TTL = 12 * 3_600_000;

interface Airport {
  id?: string;
  time?: string; // "2026-12-01 13:00", horário local do aeroporto
}
interface Segment {
  departure_airport?: Airport;
  arrival_airport?: Airport;
  airline?: string;
  flight_number?: string; // "LA 8084"
  travel_class?: string;
}
interface Itinerary {
  flights?: Segment[];
  total_duration?: number;
  price?: number;
}
export interface SerpResponse {
  best_flights?: Itinerary[];
  other_flights?: Itinerary[];
  search_metadata?: { google_flights_url?: string; status?: string };
  error?: string;
}

const CABIN: Record<string, Cabin> = { economy: "economy", "premium economy": "premium_economy", business: "business", first: "first" };
const localIso = (t?: string) => (t && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(t) ? `${t.replace(" ", "T")}:00` : null);

export function parseSerpGoogle(body: SerpResponse, observedAt: string): FareObservation[] {
  const link = body.search_metadata?.google_flights_url ?? null;
  return [...(body.best_flights ?? []), ...(body.other_flights ?? [])].flatMap((it) => {
    const segs = it.flights ?? [];
    const first = segs[0];
    const last = segs[segs.length - 1];
    const departAt = localIso(first?.departure_airport?.time);
    if (typeof it.price !== "number" || !first?.departure_airport?.id || !last?.arrival_airport?.id || !departAt) return [];
    const numbers = segs.map((s) => (s.flight_number ?? "").replace(/\s+/g, "")).filter(Boolean);
    return [{
      kind: "cash" as const,
      origin: first.departure_airport.id.toUpperCase(),
      destination: last.arrival_airport.id.toUpperCase(),
      departDate: departAt.slice(0, 10),
      departAt,
      arriveAt: localIso(last.arrival_airport.time),
      returnDate: null,
      carrier: first.flight_number?.split(/\s+/)[0] ?? null,
      flightNumbers: numbers.length ? numbers.join("+") : null,
      stops: segs.length - 1,
      durationMin: it.total_duration ?? null,
      cabin: CABIN[(first.travel_class ?? "economy").toLowerCase()] ?? "economy",
      program: null,
      cashAmount: it.price,
      cashCurrency: "BRL",
      miles: null,
      taxesAmount: null, // preço total exibido pelo Google
      taxesCurrency: null,
      seats: null,
      availability: "nao_confirmada" as const,
      deepLink: link,
      seller: "Google Flights",
      observedAt,
    }];
  });
}

const cacheDir = () => path.join(process.cwd(), ".cache", "serpapi");
export const serpCacheDir = cacheDir;
const today = () => new Date().toISOString().slice(0, 10);

/** Reserva uma consulta do dia ou recusa (o teto vale para o servidor e os robôs juntos). */
export async function serpReserve(): Promise<boolean> {
  return reserve();
}

async function reserve(): Promise<boolean> {
  const cap = Number(process.env.SERPAPI_DAILY_CALLS ?? 8);
  const file = path.join(cacheDir(), "budget.json");
  let b = { day: today(), calls: 0 };
  try {
    const saved = JSON.parse(await readFile(file, "utf8"));
    if (saved.day === b.day) b = saved;
  } catch {}
  if (b.calls >= cap) return false;
  b.calls++;
  await mkdir(cacheDir(), { recursive: true });
  await writeFile(file, JSON.stringify(b));
  return true;
}

const ids = (code: string) => (METRO_AREAS[code]?.airports ?? [code]).join(",");
export const serpAirportIds = ids;

async function collect(origin: string, destination: string, dates: string[], ctx: RobotContext): Promise<RobotOutput> {
  const key = process.env.SERPAPI_API_KEY;
  if (!key) throw new SourceUnavailableError("serpapi-google", "SERPAPI_API_KEY não configurada", false);
  const fares: FareObservation[] = [];
  const itemErrors: { target: string; message: string }[] = [];
  let calls = 0;
  let partial = false;
  for (const date of dates) {
    if (ctx.signal.aborted) break;
    const target = `${origin}-${destination} ${date}`;
    const file = path.join(cacheDir(), `${origin}-${destination}-${date}.json`);
    let body: SerpResponse | null = null;
    let observedAt = new Date().toISOString();
    try {
      const hit = JSON.parse(await readFile(file, "utf8")) as { at: number; body: SerpResponse };
      if (Date.now() - hit.at < CACHE_TTL) {
        body = hit.body;
        observedAt = new Date(hit.at).toISOString();
      }
    } catch {}
    if (!body) {
      if (!(await reserve())) {
        partial = true; // teto do dia: o resto fica para amanhã
        ctx.log(`${target}: teto diário de consultas atingido`);
        break;
      }
      const qs = new URLSearchParams({
        engine: "google_flights",
        departure_id: ids(origin),
        arrival_id: ids(destination),
        outbound_date: date,
        type: "2",
        currency: "BRL",
        hl: "pt-br",
        gl: "br",
        api_key: key,
      });
      calls++;
      try {
        const res = await fetch(`${API}?${qs}`, { signal: ctx.signal });
        const json = (await res.json().catch(() => ({}))) as SerpResponse;
        if (res.status === 401) throw new SourceUnavailableError("serpapi-google", "Chave da SerpAPI recusada (HTTP 401)", false);
        if (res.status === 429) throw new SourceUnavailableError("serpapi-google", "Cota da SerpAPI esgotada (HTTP 429)", false);
        // "sem resultados" é resposta válida (rota sem voo nesse dia), não erro da fonte
        if (json.error && !/no results/i.test(json.error) && !/hasn't returned any results/i.test(json.error)) throw new Error(json.error);
        if (!res.ok && !json.error) throw new Error(`HTTP ${res.status}`);
        body = json;
        await mkdir(cacheDir(), { recursive: true });
        await writeFile(file, JSON.stringify({ at: Date.now(), body }));
      } catch (e) {
        if (e instanceof SourceUnavailableError) throw e;
        itemErrors.push({ target, message: e instanceof Error ? e.message : String(e) });
        continue;
      }
    }
    const rows = parseSerpGoogle(body, observedAt);
    fares.push(...rows);
    ctx.log(`${target}: ${rows.length} voos`);
  }
  if (!fares.length && itemErrors.length) throw new SourceUnavailableError("serpapi-google", itemErrors[0].message, true);
  return { fares, calls, partial, itemErrors };
}

export const serpapiGoogleRobot: Robot = {
  id: "serpapi-google",
  name: "Preços em dinheiro (Google Flights via SerpAPI)",
  produces: "fares_cash",
  everyMinutes: 24 * 60,
  onDemandOnly: true,
  covers: { kind: "cash" },
  source: {
    id: "serpapi-google",
    name: "Google Flights (SerpAPI)",
    access: "api_terceiros",
    termsUrl: "https://serpapi.com/legal",
    commercialUse: "a_confirmar",
    attribution: "Preços: Google Flights, via SerpAPI",
  },
  notReady: () => (process.env.SERPAPI_API_KEY ? null : "SERPAPI_API_KEY não configurada (conta em serpapi.com)"),

  // sem agenda: a cota é pequena demais para varrer rotas sozinho
  run: async () => ({ calls: 0, partial: false, itemErrors: [] }),

  collectRoute(q, ctx) {
    if (!q.dates?.length) return Promise.resolve({ calls: 0, partial: false, itemErrors: [] });
    return collect(q.origin, q.destination, q.dates, ctx);
  },
};
