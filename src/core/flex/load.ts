import { toBrl, type FxRate } from "../robots/compare";
import type { Store } from "../robots/store";
import { airportsFor } from "../search/flights";
import { addDays, computeWindows, type FlexQuery, type FlexResult, type OneWayPrice, type RoundTripPrice } from "./engine";

// Lê do banco os preços reais (em dinheiro) que servem ao período pedido e roda o motor.

/** Fontes cujas janelas de ida e volta têm duração aproximada ("1 ou 2 semanas"). */
const APPROX_SOURCES = new Set(["serpapi-explore"]);

type Row = Record<string, unknown>;

function lastDay(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

export function loadFlexData(store: Store, q: FlexQuery) {
  const from = `${q.fromMonth}-01`;
  const to = lastDay(q.toMonth);
  const codes = (c: string) => [...new Set([c.toUpperCase(), ...airportsFor(c)])];
  const rows = (o: string, d: string, until: string) =>
    codes(o).flatMap((a) => codes(d).flatMap((b) => store.faresForRoute(a, b, from, until))).filter((r) => r.kind === "cash");

  const fwd = rows(q.origin, q.destination, to);
  const rev = rows(q.destination, q.origin, addDays(to, q.maxDays));

  const currencies = [...new Set([...fwd, ...rev].map((r) => (r.cash_currency as string) ?? "BRL").filter((c) => c !== "BRL"))];
  const fx: FxRate[] = currencies.flatMap((c) => {
    const r = store.latestFx(c);
    return r ? [{ currency: c, sell: r.sell as number, quotedAt: r.quoted_at as string, sourceId: r.source_id as string }] : [];
  });
  const brl = (r: Row) => (r.cash_amount != null ? (toBrl(r.cash_amount as number, (r.cash_currency as string) ?? "BRL", fx)?.brl ?? null) : null);

  const oneWay = (list: Row[]): OneWayPrice[] =>
    list
      .filter((r) => !r.return_date)
      .flatMap((r) => {
        const v = brl(r);
        return v == null ? [] : [{ date: r.depart_date as string, brl: v, stops: (r.stops as number) ?? null, carrier: (r.carrier as string) ?? null, sourceId: r.source_id as string, observedAt: r.observed_at as string, key: r.key as string }];
      });

  const roundTrips: RoundTripPrice[] = fwd
    .filter((r) => r.return_date)
    .flatMap((r) => {
      const v = brl(r);
      return v == null
        ? []
        : [{
            departDate: r.depart_date as string,
            returnDate: r.return_date as string,
            brl: v,
            stops: (r.stops as number) ?? null,
            returnStops: (r.return_stops as number) ?? null,
            carrier: (r.carrier as string) ?? null,
            sourceId: r.source_id as string,
            observedAt: r.observed_at as string,
            key: r.key as string,
            approxDuration: APPROX_SOURCES.has(r.source_id as string),
          }];
    });

  return { outbound: oneWay(fwd), inbound: oneWay(rev), roundTrips };
}

export function flexSearch(store: Store, q: FlexQuery, today = new Date().toISOString().slice(0, 10)): FlexResult {
  return computeWindows(q, loadFlexData(store, q), today);
}
