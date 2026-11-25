import type { RouteFlight } from "./types";

export interface DestinationAirline {
  code: string;
  weekly: number; // voos por semana
}

export interface Destination {
  iata: string;
  weekly: number;
  airlines: DestinationAirline[];
  minDurationMin: number | null;
  departures: { flight: string; airline: string; depTime: string; arrTime: string; days: string[] }[];
}

/** Agrupa voos por destino, sem contar duas vezes o mesmo voo (mesmo número, horário e dias). */
export function aggregateDestinations(flights: RouteFlight[]): Destination[] {
  const byDest = new Map<string, Map<string, RouteFlight>>();
  for (const f of flights) {
    const key = `${f.flight}|${f.depTime}|${[...f.days].sort().join(",")}`;
    if (!byDest.has(f.arr)) byDest.set(f.arr, new Map());
    byDest.get(f.arr)!.set(key, f);
  }
  const out: Destination[] = [];
  for (const [iata, map] of byDest) {
    const list = [...map.values()];
    const perAirline = new Map<string, number>();
    for (const f of list) perAirline.set(f.airline, (perAirline.get(f.airline) ?? 0) + f.days.length);
    const durations = list.map((f) => f.durationMin).filter((d): d is number => d !== null && d > 0);
    out.push({
      iata,
      weekly: list.reduce((s, f) => s + f.days.length, 0),
      airlines: [...perAirline].map(([code, weekly]) => ({ code, weekly })).sort((a, b) => b.weekly - a.weekly),
      minDurationMin: durations.length ? Math.min(...durations) : null,
      departures: list
        .map((f) => ({ flight: f.flight, airline: f.airline, depTime: f.depTime, arrTime: f.arrTime, days: f.days }))
        .sort((a, b) => a.depTime.localeCompare(b.depTime)),
    });
  }
  return out.sort((a, b) => b.weekly - a.weekly);
}

export interface OneStopDestination {
  iata: string;
  via: { hub: string; firstLegMin: number | null; secondLegMin: number | null }[];
  /** Menor soma das durações dos dois trechos, sem o tempo de conexão. */
  minFlyingMin: number | null;
}

/** Destinos alcançáveis com uma conexão, a partir dos voos dos hubs já conhecidos. */
export function oneStopDestinations(
  origin: string,
  direct: Destination[],
  hubDestinations: Record<string, Destination[]>,
): OneStopDestination[] {
  const directSet = new Set(direct.map((d) => d.iata));
  const firstLeg = new Map(direct.map((d) => [d.iata, d.minDurationMin]));
  const out = new Map<string, OneStopDestination>();
  for (const [hub, dests] of Object.entries(hubDestinations)) {
    if (!directSet.has(hub)) continue;
    for (const d of dests) {
      if (d.iata === origin || directSet.has(d.iata)) continue;
      const entry = out.get(d.iata) ?? { iata: d.iata, via: [], minFlyingMin: null };
      const a = firstLeg.get(hub) ?? null;
      const b = d.minDurationMin;
      entry.via.push({ hub, firstLegMin: a, secondLegMin: b });
      if (a !== null && b !== null && (entry.minFlyingMin === null || a + b < entry.minFlyingMin)) {
        entry.minFlyingMin = a + b;
      }
      out.set(d.iata, entry);
    }
  }
  return [...out.values()].sort((x, y) => (x.minFlyingMin ?? Infinity) - (y.minFlyingMin ?? Infinity));
}
