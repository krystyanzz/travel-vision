import { loadMonitorConfig, monthsFrom } from "../monitor";
import { SourceUnavailableError, type FareObservation, type Robot, type RobotContext, type RobotOutput } from "../types";

// Preços em dinheiro pela Aviasales Data API (programa de afiliados Travelpayouts).
// A própria documentação diz que são os menores preços encontrados por usuários
// do Aviasales nas últimas 48 horas: preço real, disponibilidade NÃO confirmada.
// O usuário é redirecionado ao Aviasales para conferir e comprar.

const API = "https://api.travelpayouts.com/aviasales/v3/prices_for_dates";
const PAUSE_MS = 1100; // ritmo conservador; o limite oficial ainda não foi confirmado

interface TpRow {
  origin?: string;
  destination?: string;
  origin_airport?: string;
  destination_airport?: string;
  price?: number;
  airline?: string;
  flight_number?: string | number;
  departure_at?: string;
  return_at?: string;
  transfers?: number;
  duration?: number;
  duration_to?: number;
  duration_back?: number;
  return_transfers?: number;
  gate?: string;
  link?: string;
}

export function parseTravelpayouts(rows: TpRow[], currency: string, observedAt: string, marker?: string): FareObservation[] {
  return rows.flatMap((r) => {
    if (typeof r.price !== "number" || !r.departure_at || !(r.origin_airport ?? r.origin) || !(r.destination_airport ?? r.destination)) return [];
    const link = r.link ? `https://www.aviasales.com${r.link}${marker ? `${r.link.includes("?") ? "&" : "?"}marker=${encodeURIComponent(marker)}` : ""}` : null;
    return [{
      kind: "cash" as const,
      origin: (r.origin_airport ?? r.origin)!.toUpperCase(),
      destination: (r.destination_airport ?? r.destination)!.toUpperCase(),
      departDate: r.departure_at.slice(0, 10),
      departAt: r.departure_at,
      returnDate: r.return_at ? r.return_at.slice(0, 10) : null,
      carrier: r.airline ?? null,
      flightNumbers: r.airline && r.flight_number != null ? `${r.airline}${r.flight_number}` : null,
      stops: typeof r.transfers === "number" ? r.transfers : null,
      // só ida: "duration" é a viagem inteira, com conexões (o que o viajante compara);
      // ida e volta: "duration_to" é o trecho de ida
      durationMin: (r.duration_back ? r.duration_to : (r.duration ?? r.duration_to)) ?? null,
      cabin: "economy" as const,
      program: null,
      cashAmount: r.price,
      cashCurrency: currency.toUpperCase(),
      miles: null,
      taxesAmount: null, // o preço da fonte já é o total; taxas não vêm separadas
      taxesCurrency: null,
      seats: null,
      availability: "nao_confirmada" as const,
      deepLink: link,
      seller: r.gate ?? null,
      returnAt: r.return_at ?? null,
      returnStops: r.return_at && typeof r.return_transfers === "number" ? r.return_transfers : null,
      returnDurationMin: r.return_at ? (r.duration_back ?? null) : null,
      observedAt,
    }];
  });
}

/** Consulta pares rota/mês, com pausa entre chamadas; credencial recusada ou 429 interrompem tudo. */
interface Pair {
  origin: string;
  destination: string;
  month: string;
  /** Mês de volta: busca tarifas de ida e volta (bilhete único) em vez de só ida. */
  returnMonth?: string;
}

async function collect(pairs: Pair[], ctx: RobotContext): Promise<RobotOutput> {
  const token = process.env.TRAVELPAYOUTS_TOKEN;
  if (!token) throw new SourceUnavailableError("travelpayouts", "TRAVELPAYOUTS_TOKEN não configurado", false);
  const marker = process.env.TRAVELPAYOUTS_MARKER || undefined;
  const currency = "brl";
  const fares: FareObservation[] = [];
  const itemErrors: { target: string; message: string }[] = [];
  let calls = 0;
  for (const { origin, destination, month, returnMonth } of pairs) {
    if (ctx.signal.aborted) break;
    const target = `${origin}-${destination} ${month}${returnMonth ? ` / volta ${returnMonth}` : ""}`;
    const qs = new URLSearchParams({ origin, destination, departure_at: month, one_way: returnMonth ? "false" : "true", sorting: "price", unique: "false", limit: "100", page: "1", currency });
    if (returnMonth) qs.set("return_at", returnMonth);
    if (calls) await new Promise((r) => setTimeout(r, PAUSE_MS));
    calls++;
    try {
      const res = await fetch(`${API}?${qs}`, { signal: ctx.signal, headers: { "X-Access-Token": token, "Accept-Encoding": "gzip" } });
      if (res.status === 401 || res.status === 403) throw new SourceUnavailableError("travelpayouts", `Token recusado (HTTP ${res.status})`, false);
      if (res.status === 429) throw new SourceUnavailableError("travelpayouts", "Limite de requisições atingido (HTTP 429)", true);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as { success?: boolean; data?: TpRow[]; currency?: string; error?: string };
      if (body.success === false) throw new Error(body.error ?? "resposta sem sucesso");
      const rows = parseTravelpayouts(body.data ?? [], body.currency ?? currency, new Date().toISOString(), marker);
      fares.push(...rows);
      ctx.log(`${target}: ${rows.length} preços`);
    } catch (e) {
      // credencial ou cota: não adianta seguir martelando a fonte
      if (e instanceof SourceUnavailableError) throw e;
      itemErrors.push({ target, message: e instanceof Error ? e.message : String(e) });
    }
  }
  if (!fares.length && itemErrors.length) throw new SourceUnavailableError("travelpayouts", itemErrors[0].message, true);
  return { fares, calls, partial: false, itemErrors };
}

interface CalendarRow {
  origin?: string;
  destination?: string;
  airline?: string;
  departure_at?: string;
  return_at?: string;
  price?: number;
  flight_number?: number | string;
  transfers?: number;
}
interface LatestRow {
  origin?: string;
  destination?: string;
  depart_date?: string;
  return_date?: string;
  value?: number;
  number_of_changes?: number;
  gate?: string;
}

/** Calendário de ida e volta do ano (v1) e últimas ida e volta encontradas (v2): códigos de cidade, preço total. */
export function parseYearRoundTrips(calendar: CalendarRow[], latest: LatestRow[], observedAt: string, marker?: string): FareObservation[] {
  const base = { kind: "cash" as const, cabin: "economy" as const, program: null, cashCurrency: "BRL", miles: null, taxesAmount: null, taxesCurrency: null, seats: null, availability: "nao_confirmada" as const, observedAt };
  const link = (o: string, d: string) => `https://www.aviasales.com/?origin=${o}&destination=${d}${marker ? `&marker=${encodeURIComponent(marker)}` : ""}`;
  const a = calendar.flatMap((r) =>
    typeof r.price === "number" && r.origin && r.destination && r.departure_at && r.return_at
      ? [{ ...base, origin: r.origin.toUpperCase(), destination: r.destination.toUpperCase(), departDate: r.departure_at.slice(0, 10), departAt: r.departure_at,
          returnDate: r.return_at.slice(0, 10), returnAt: r.return_at, carrier: r.airline ?? null,
          flightNumbers: r.airline && r.flight_number != null ? `${r.airline}${r.flight_number}` : null, stops: r.transfers ?? null,
          durationMin: null, cashAmount: r.price, deepLink: link(r.origin, r.destination), seller: null }]
      : [],
  );
  const b = latest.flatMap((r) =>
    typeof r.value === "number" && r.origin && r.destination && r.depart_date && r.return_date
      ? [{ ...base, origin: r.origin.toUpperCase(), destination: r.destination.toUpperCase(), departDate: r.depart_date, departAt: null,
          returnDate: r.return_date, carrier: null, flightNumbers: null, stops: r.number_of_changes ?? null, durationMin: null,
          cashAmount: r.value, deepLink: link(r.origin, r.destination), seller: r.gate ?? null }]
      : [],
  );
  return [...a, ...b];
}

async function collectYearRoundTrips(origin: string, destination: string, month: string, ctx: RobotContext): Promise<RobotOutput> {
  const token = process.env.TRAVELPAYOUTS_TOKEN;
  if (!token) throw new SourceUnavailableError("travelpayouts", "TRAVELPAYOUTS_TOKEN não configurado", false);
  const headers = { "X-Access-Token": token, "Accept-Encoding": "gzip" };
  const itemErrors: { target: string; message: string }[] = [];
  let calendar: CalendarRow[] = [];
  let latest: LatestRow[] = [];
  try {
    const qs = new URLSearchParams({ origin, destination, depart_date: month, calendar_type: "departure_date", currency: "brl" });
    const r = await fetch(`https://api.travelpayouts.com/v1/prices/calendar?${qs}`, { signal: ctx.signal, headers });
    const j = (await r.json()) as { data?: Record<string, CalendarRow> };
    calendar = Object.values(j.data ?? {});
  } catch (e) {
    itemErrors.push({ target: `${origin}-${destination} calendário do ano`, message: e instanceof Error ? e.message : String(e) });
  }
  await new Promise((r) => setTimeout(r, PAUSE_MS));
  try {
    const qs = new URLSearchParams({ origin, destination, currency: "brl", period_type: "year", one_way: "false", limit: "100", sorting: "price", show_to_affiliates: "true" });
    const r = await fetch(`https://api.travelpayouts.com/v2/prices/latest?${qs}`, { signal: ctx.signal, headers });
    const j = (await r.json()) as { data?: LatestRow[] };
    latest = j.data ?? [];
  } catch (e) {
    itemErrors.push({ target: `${origin}-${destination} últimas ida e volta`, message: e instanceof Error ? e.message : String(e) });
  }
  const fares = parseYearRoundTrips(calendar, latest, new Date().toISOString(), process.env.TRAVELPAYOUTS_MARKER || undefined);
  ctx.log(`${origin}-${destination}: ${fares.length} ida e volta no ano`);
  return { fares, calls: 2, partial: false, itemErrors };
}

export const travelpayoutsRobot: Robot = {
  id: "travelpayouts-precos",
  name: "Preços em dinheiro (Aviasales / Travelpayouts)",
  produces: "fares_cash",
  everyMinutes: 6 * 60,
  source: {
    id: "travelpayouts",
    name: "Aviasales Data API (Travelpayouts)",
    access: "api_afiliado",
    termsUrl: "https://www.travelpayouts.com/terms",
    commercialUse: "a_confirmar",
    attribution: "Preços: Aviasales, via Travelpayouts",
  },
  notReady: () => (process.env.TRAVELPAYOUTS_TOKEN ? null : "TRAVELPAYOUTS_TOKEN não configurado (conta de afiliado Travelpayouts)"),

  covers: { kind: "cash" },

  run(ctx) {
    const { routes, monthsAhead } = loadMonitorConfig();
    const months = monthsFrom(ctx.now, monthsAhead);
    return collect(routes.flatMap((r) => months.map((month) => ({ ...r, month }))), ctx);
  },

  async collectRoute(q, ctx) {
    const pairs: Pair[] = q.months.map((month) => ({ origin: q.origin, destination: q.destination, month }));
    if (q.roundTrip) pairs.push({ origin: q.origin, destination: q.destination, month: q.roundTrip.departMonth, returnMonth: q.roundTrip.returnMonth });
    if (q.flex) {
      // só ida nos dois sentidos, mês a mês: permite montar ida + volta com dois bilhetes
      for (const month of q.flex.months) {
        pairs.push({ origin: q.origin, destination: q.destination, month }, { origin: q.destination, destination: q.origin, month });
      }
    }
    const out = pairs.length ? await collect(pairs, ctx) : { fares: [], calls: 0, partial: false, itemErrors: [] };
    if (q.flex) {
      const year = await collectYearRoundTrips(q.origin, q.destination, q.flex.months[0], ctx);
      out.fares = [...(out.fares ?? []), ...(year.fares ?? [])];
      out.calls += year.calls;
      out.itemErrors.push(...year.itemErrors);
    }
    return out;
  },
};
