import path from "node:path";
import { airport, type AirportInfo } from "../airportsDb";
import { SlidingWindowQuota } from "../providers/quota";
import { aggregateDestinations, oneStopDestinations, type Destination } from "./aggregate";
import { createAirlabsProvider } from "./airlabs";
import type { RoutesProvider } from "./types";

// Companhias nacionais e as estrangeiras mais comuns nos aeroportos brasileiros.
const CANDIDATE_AIRLINES = ["LA", "JJ", "G3", "AD", "2Z", "TP", "AA", "UA", "DL", "AF", "KL", "LH", "IB", "UX", "BA", "CM", "AV", "AR", "H2", "EK", "QR", "TK", "ET", "AC", "AM", "AZ", "LX", "SA", "DT", "JA"];

let provider: RoutesProvider | null | undefined;
// Plano gratuito da AirLabs: 250 consultas por minuto; ficamos bem abaixo.
const quota = new SlidingWindowQuota("airlabs-minuto", 60);

export function routesProvider(): RoutesProvider | null {
  if (provider === undefined) {
    const key = process.env.AIRLABS_API_KEY;
    provider = key
      ? createAirlabsProvider({
          apiKey: key,
          cacheDir: path.join(process.cwd(), ".cache", "airlabs"),
          pageSize: Number(process.env.AIRLABS_PAGE_SIZE ?? 50),
          maxCalls: Number(process.env.AIRLABS_MAX_CALLS ?? 30),
          candidateAirlines: CANDIDATE_AIRLINES,
          candidatesAreExhaustive: false,
          // plano gratuito: 1.000 consultas/mês ≈ 33/dia; o teto protege contra uso abusivo do mapa público
          dailyCallBudget: Number(process.env.AIRLABS_DAILY_CALLS ?? 60),
          monthlyReserve: Number(process.env.AIRLABS_MONTHLY_RESERVE ?? 50),
        })
      : null;
  }
  return provider;
}

export interface MapDestination extends Destination {
  airport: AirportInfo;
}

export interface RouteMapResult {
  origin: AirportInfo;
  destinations: MapDestination[];
  oneStop: { iata: string; airport: AirportInfo; via: { hub: string }[]; minFlyingMin: number | null }[] | null;
  hubs: string[];
  airlines: Record<string, string>;
  partial: boolean;
  fetchedAt: string;
  attribution: string;
  quotaRemaining: number | null;
}

const withAirport = <T extends { iata: string }>(list: T[]) =>
  list.flatMap((d) => {
    const a = airport(d.iata);
    return a ? [{ ...d, airport: a }] : [];
  });

export async function routeMap(originIata: string, withConnections: boolean): Promise<RouteMapResult> {
  const p = routesProvider();
  if (!p) throw new Error("AIRLABS_API_KEY não configurada");
  const origin = airport(originIata);
  if (!origin) throw new RangeError("Aeroporto desconhecido");

  const departures = async (iata: string) => {
    quota.take();
    return p.departures(iata);
  };

  const dep = await departures(origin.iata);
  const destinations = withAirport(aggregateDestinations(dep.flights));
  let partial = dep.partial;

  let oneStop: RouteMapResult["oneStop"] = null;
  let hubs: string[] = [];
  if (withConnections) {
    // até 3 hubs: os grandes aeroportos com mais voos semanais a partir da origem
    hubs = destinations.filter((d) => d.airport.size === 3).slice(0, 3).map((d) => d.iata);
    const hubDest: Record<string, Destination[]> = {};
    for (const h of hubs) {
      const r = await departures(h);
      partial ||= r.partial;
      hubDest[h] = aggregateDestinations(r.flights);
    }
    oneStop = withAirport(oneStopDestinations(origin.iata, destinations, hubDest)).map((o) => ({
      iata: o.iata,
      airport: o.airport,
      via: o.via.map((v) => ({ hub: v.hub })),
      minFlyingMin: o.minFlyingMin,
    }));
  }

  const airlines = await p.airlineNames(destinations.flatMap((d) => d.airlines.map((a) => a.code)));
  return {
    origin,
    destinations,
    oneStop,
    hubs,
    airlines,
    partial,
    fetchedAt: dep.fetchedAt,
    attribution: p.info.attribution,
    quotaRemaining: p.quotaRemaining(),
  };
}
