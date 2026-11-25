import { readFileSync } from "node:fs";
import path from "node:path";
import { programStatuses, robotStatuses } from "./registry";
import { defaultStore, type Store } from "./store";
import type { Availability } from "./types";

// Visão consolidada para a tela de robôs (só leitura do banco).

const RECENT_MS = 6 * 3_600_000;
const OPPORTUNITY_MS = 48 * 3_600_000;

export interface FareView {
  key: string;
  sourceId: string;
  kind: "cash" | "award";
  origin: string;
  destination: string;
  departDate: string;
  departAt: string | null;
  returnDate: string | null;
  returnAt: string | null;
  returnStops: number | null;
  returnDurationMin: number | null;
  arriveAt: string | null;
  carrier: string | null;
  flightNumbers: string | null;
  stops: number | null;
  durationMin: number | null;
  cabin: string | null;
  program: string | null;
  cashAmount: number | null;
  cashCurrency: string | null;
  miles: number | null;
  taxesAmount: number | null;
  taxesCurrency: string | null;
  availability: Availability;
  deepLink: string | null;
  seller: string | null;
  observedAt: string;
  recent: boolean;
  opportunity: boolean;
}

export function toFareView(r: Record<string, unknown>, opportunityKeys: Set<string>, now = Date.now()): FareView {
  return {
    key: r.key as string,
    sourceId: r.source_id as string,
    kind: r.kind as "cash" | "award",
    origin: r.origin as string,
    destination: r.destination as string,
    departDate: r.depart_date as string,
    departAt: (r.depart_at as string) ?? null,
    returnDate: (r.return_date as string) ?? null,
    returnAt: (r.return_at as string) ?? null,
    returnStops: (r.return_stops as number) ?? null,
    returnDurationMin: (r.return_duration_min as number) ?? null,
    arriveAt: (r.arrive_at as string) ?? null,
    carrier: (r.carrier as string) ?? null,
    flightNumbers: (r.flight_numbers as string) ?? null,
    stops: (r.stops as number) ?? null,
    durationMin: (r.duration_min as number) ?? null,
    cabin: (r.cabin as string) ?? null,
    program: (r.program as string) ?? null,
    cashAmount: (r.cash_amount as number) ?? null,
    cashCurrency: (r.cash_currency as string) ?? null,
    miles: (r.miles as number) ?? null,
    taxesAmount: (r.taxes_amount as number) ?? null,
    taxesCurrency: (r.taxes_currency as string) ?? null,
    availability: r.availability as Availability,
    deepLink: (r.deep_link as string) ?? null,
    seller: (r.seller as string) ?? null,
    observedAt: r.observed_at as string,
    recent: now - Date.parse(r.observed_at as string) < RECENT_MS,
    opportunity: opportunityKeys.has(r.key as string),
  };
}

export function opportunityKeys(store: Store, now = Date.now()): Set<string> {
  return new Set(
    store
      .recentEvents(200, ["price_drop", "availability_up"])
      .filter((e) => now - Date.parse(e.at as string) < OPPORTUNITY_MS)
      .map((e) => e.ref as string),
  );
}

/** Consumo de cota das fontes que informam limite (hoje: AirLabs). */
export function quotaUsage() {
  let airlabs: { day: string; calls: number; remaining: number | null } | null = null;
  try {
    airlabs = JSON.parse(readFileSync(path.join(process.cwd(), ".cache", "airlabs", "budget.json"), "utf8"));
  } catch {}
  return [
    {
      source: "AirLabs",
      today: airlabs?.day === new Date().toISOString().slice(0, 10) ? airlabs.calls : 0,
      dailyCap: Number(process.env.AIRLABS_DAILY_CALLS ?? 60),
      monthlyRemaining: airlabs?.remaining ?? null,
      monthlyReserve: Number(process.env.AIRLABS_MONTHLY_RESERVE ?? 50),
    },
  ];
}

export function robotsDashboard(store: Store = defaultStore()) {
  const opp = opportunityKeys(store);
  const fx = ["USD", "EUR"].map((c) => store.latestFx(c)).filter(Boolean) as Record<string, unknown>[];
  return {
    robots: robotStatuses(store),
    programs: programStatuses(store),
    runs: store.recentRuns(25),
    errors: store.recentErrors(15),
    events: store.recentEvents(25),
    fares: store.latestFares(40).map((r) => toFareView(r, opp)),
    schedules: store.scheduleSummary(),
    quotas: quotaUsage(),
    fx: fx.map((r) => ({ currency: r.currency as string, sell: r.sell as number, buy: r.buy as number, quotedAt: r.quoted_at as string, bulletin: r.bulletin as string })),
  };
}
