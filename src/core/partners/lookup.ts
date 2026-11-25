import { routesProvider } from "../routes/registry";
import type { DeparturesResult } from "../routes/types";
import { airportsFor } from "../search/flights";
import { airlineName, programsForAirlines, type ProgramMatch } from "./partners";

// Quem opera numa rota (malha da AirLabs) e quais programas emitem nessas companhias.
// Usa o cache da malha; só consulta a fonte (gasta cota) com consult = true.

export async function malha(iata: string, consult: boolean): Promise<{ data: DeparturesResult | null; consulted: boolean }> {
  const p = routesProvider();
  if (!p) return { data: null, consulted: false };
  const cached = (await p.peekDepartures?.(iata)) ?? null;
  if (cached || !consult) return { data: cached, consulted: false };
  return { data: await p.departures(iata), consulted: true };
}

export function weeklyByAirline(flights: DeparturesResult["flights"]) {
  const m = new Map<string, number>();
  for (const f of flights) m.set(f.airline, (m.get(f.airline) ?? 0) + f.days.length);
  return [...m].map(([code, weekly]) => ({ code, name: airlineName(code), weekly })).sort((a, b) => b.weekly - a.weekly);
}

export interface RoutePartners {
  status: "ok" | "sem_malha" | "sem_voo_direto";
  airlines: { code: string; name: string; weekly: number }[];
  programs: ProgramMatch[];
  fetchedAt: string | null;
  partial: boolean;
  consulted: boolean;
}

export async function partnersForRoute(origin: string, destination: string, consult = false): Promise<RoutePartners> {
  const targets = new Set(airportsFor(destination));
  const flights: DeparturesResult["flights"] = [];
  let fetchedAt: string | null = null;
  let partial = false;
  let missing = 0;
  let consulted = false;
  for (const o of airportsFor(origin)) {
    const r = await malha(o, consult);
    if (!r.data) {
      missing++;
      continue;
    }
    consulted ||= r.consulted;
    flights.push(...r.data.flights.filter((f) => targets.has(f.arr)));
    fetchedAt = [fetchedAt, r.data.fetchedAt].filter(Boolean).sort()[0] ?? r.data.fetchedAt;
    partial ||= r.data.partial;
  }
  if (missing === airportsFor(origin).length) return { status: "sem_malha", airlines: [], programs: [], fetchedAt: null, partial: false, consulted };
  const airlines = weeklyByAirline(flights);
  return {
    status: airlines.length ? "ok" : "sem_voo_direto",
    airlines,
    programs: programsForAirlines(airlines.map((a) => a.code)),
    fetchedAt,
    partial: partial || missing > 0,
    consulted,
  };
}
