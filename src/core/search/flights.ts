import { METRO_AREAS } from "../airportsDb";
import { LOYALTY_PROGRAMS } from "../partners/data";
import { airlineName } from "../partners/partners";
import type { CalendarDay, Cabin } from "../types";
import { toBrl, type FxRate } from "../robots/compare";
import { opportunityKeys, toFareView, type FareView } from "../robots/dashboard";
import { policyBlock } from "../robots/engine";
import { PROGRAMS as PROGRAM_BLOCKERS, ROBOTS, robotStatuses } from "../robots/registry";
import type { Store } from "../robots/store";
import type { Availability, Robot } from "../robots/types";

// Motor de busca: lê o banco alimentado pelos robôs e consolida dinheiro e
// milhas numa resposta só. Nunca inventa resultado: cada modalidade diz se
// tem fonte, se a fonte está fora do ar ou se não achou nada para a rota.

export interface FlightQuery {
  origin: string;
  destination: string;
  departDate: string; // AAAA-MM-DD
  returnDate: string | null;
  cabin: Cabin | "any";
}

export type ModalityStatus = "com_resultados" | "sem_resultados" | "sem_fonte" | "indisponivel";

export interface Modality {
  id: string; // "cash" ou id do programa
  kind: "cash" | "award";
  label: string;
  status: ModalityStatus;
  detail: string;
  updatedAt: string | null;
}

export interface FlightResult extends FareView {
  leg: "ida" | "volta";
  carrierName: string | null;
  programName: string | null;
  /** Valor em reais (convertido pela PTAX quando a moeda é outra). */
  brl: { amount: number; fx: FxRate | null } | null;
  taxesBrl: number | null;
  /** Para resgates: quanto vale cada 1.000 milhas frente à tarifa em dinheiro mais barata do dia. */
  valuePerThousand: number | null;
}

export interface LegResult {
  leg: "ida" | "volta";
  origin: string;
  destination: string;
  date: string;
  results: FlightResult[];
  /** Menor preço em dinheiro nos 3 dias antes e depois. */
  nearby: { date: string; lowestBrl: number | null }[];
  calendar: { month: string; days: CalendarDay[] };
}

/** Um trecho de uma viagem, como a fonte informou. */
export interface TripLeg {
  origin: string;
  destination: string;
  date: string;
  departAt: string | null;
  arriveAt: string | null;
  durationMin: number | null;
  stops: number | null;
  carrier: string | null;
  carrierName: string | null;
  flightNumbers: string | null;
  cabin: string | null;
}

/** Uma oferta que o usuário pode abrir no parceiro (uma por bilhete). */
export interface TripOffer {
  key: string;
  sourceId: string;
  seller: string | null;
  url: string | null;
  brl: number | null;
  fx: FxRate | null;
  cashAmount: number | null;
  cashCurrency: string | null;
  miles: number | null;
  taxesBrl: number | null;
  observedAt: string;
}

/**
 * Uma opção completa para o viajante:
 * so_ida = um bilhete; ida_e_volta = bilhete único de ida e volta, como a fonte vende;
 * dois_bilhetes = ida e volta montadas com dois bilhetes só de ida (preços reais, compra separada).
 */
export interface Trip {
  id: string;
  kind: "cash" | "award";
  ticket: "so_ida" | "ida_e_volta" | "dois_bilhetes";
  out: TripLeg;
  back: TripLeg | null;
  totalBrl: number | null;
  totalMiles: number | null;
  taxesBrl: number | null;
  totalDurationMin: number | null;
  program: string | null;
  programName: string | null;
  availability: Availability;
  observedAt: string; // a consulta mais antiga entre os bilhetes
  recent: boolean;
  opportunity: boolean;
  offers: TripOffer[];
  /** A mesma viagem (mesmos voos e horários) encontrada em outras fontes, mais cara. */
  alsoFrom: { sourceId: string; seller: string | null; totalBrl: number | null; totalMiles: number | null; url: string | null }[];
}

export interface SearchResponse {
  query: FlightQuery;
  legs: LegResult[];
  /** Opções completas (só ida, ou ida e volta), já com preço total. */
  trips: Trip[];
  modalities: Modality[];
  /** Há fonte conectada que permite atualizar esta rota agora. */
  onDemand: boolean;
  generatedAt: string;
}

export const airportsFor = (code: string) => METRO_AREAS[code.toUpperCase()]?.airports ?? [code.toUpperCase()];

const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

function monthDays(month: string): string[] {
  const [y, m] = month.split("-").map(Number);
  const n = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return Array.from({ length: n }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`);
}

function rates(store: Store, currencies: string[]): FxRate[] {
  return [...new Set(currencies.filter((c) => c && c !== "BRL"))].flatMap((c) => {
    const r = store.latestFx(c);
    return r ? [{ currency: c, sell: r.sell as number, quotedAt: r.quoted_at as string, sourceId: r.source_id as string }] : [];
  });
}

function searchLeg(
  store: Store,
  leg: "ida" | "volta",
  origin: string,
  destination: string,
  date: string,
  cabin: FlightQuery["cabin"],
  opp: Set<string>,
): LegResult & { roundTrips: FlightResult[] } {
  const month = date.slice(0, 7);
  const days = monthDays(month);
  const from = [days[0], addDays(date, -3)].sort()[0];
  const to = [days[days.length - 1], addDays(date, 3)].sort().reverse()[0];
  const today = new Date().toISOString().slice(0, 10);

  const rows = airportsFor(origin)
    .flatMap((o) => airportsFor(destination).flatMap((d) => store.faresForRoute(o, d, from < today ? today : from, to)))
    .map((r) => toFareView(r, opp))
    .filter((f) => cabin === "any" || !f.cabin || f.cabin === cabin);

  const fx = rates(store, rows.flatMap((f) => [f.cashCurrency ?? "", f.taxesCurrency ?? ""]));
  const priced = rows.map((f): FlightResult => {
    const brl = f.cashAmount != null && f.cashCurrency ? toBrl(f.cashAmount, f.cashCurrency, fx) : null;
    const taxes = f.taxesAmount != null && f.taxesCurrency ? toBrl(f.taxesAmount, f.taxesCurrency, fx) : null;
    return {
      ...f,
      leg,
      carrierName: f.carrier ? airlineName(f.carrier) : null,
      programName: f.program ? (LOYALTY_PROGRAMS.find((p) => p.id === f.program)?.name ?? f.program) : null,
      brl: brl ? { amount: brl.brl, fx: brl.fx } : null,
      taxesBrl: taxes?.brl ?? null,
      valuePerThousand: null,
    };
  });

  // tarifas de ida e volta (bilhete único) ficam à parte: não são preço de um trecho só
  const roundTrips = priced.filter((f) => f.returnDate);
  const oneWay = priced.filter((f) => !f.returnDate);

  const cheapestCash = new Map<string, number>();
  for (const f of oneWay) {
    if (f.kind === "cash" && f.brl) cheapestCash.set(f.departDate, Math.min(cheapestCash.get(f.departDate) ?? Infinity, f.brl.amount));
  }
  for (const f of oneWay) {
    const cash = cheapestCash.get(f.departDate);
    if (f.kind === "award" && f.miles && cash !== undefined) {
      f.valuePerThousand = Math.round(((cash - (f.taxesBrl ?? 0)) / (f.miles / 1000)) * 100) / 100;
    }
  }

  return {
    leg,
    origin,
    destination,
    date,
    results: oneWay.filter((f) => f.departDate === date),
    roundTrips,
    nearby: Array.from({ length: 7 }, (_, i) => addDays(date, i - 3)).map((d) => ({ date: d, lowestBrl: cheapestCash.get(d) ?? null })),
    calendar: { month, days: days.map((d) => ({ date: d, lowestAmount: cheapestCash.get(d) ?? null, currency: "BRL" })) },
  };
}

const AVAILABILITY_ORDER: Availability[] = ["confirmada", "nao_confirmada", "historico", "estimativa"];
const worst = (list: Availability[]) => list.reduce((a, b) => (AVAILABILITY_ORDER.indexOf(b) > AVAILABILITY_ORDER.indexOf(a) ? b : a));
const sum = (a: number | null, b: number | null) => (a == null || b == null ? null : a + b);

function tripLeg(f: FlightResult): TripLeg {
  return {
    origin: f.origin, destination: f.destination, date: f.departDate, departAt: f.departAt, arriveAt: f.arriveAt, durationMin: f.durationMin,
    stops: f.stops, carrier: f.carrier, carrierName: f.carrierName, flightNumbers: f.flightNumbers, cabin: f.cabin,
  };
}

function offer(f: FlightResult): TripOffer {
  return {
    key: f.key, sourceId: f.sourceId, seller: f.seller, url: f.deepLink, brl: f.brl?.amount ?? null, fx: f.brl?.fx ?? null,
    cashAmount: f.cashAmount, cashCurrency: f.cashCurrency, miles: f.miles, taxesBrl: f.taxesBrl, observedAt: f.observedAt,
  };
}

function single(f: FlightResult): Trip {
  return {
    id: f.key, kind: f.kind, ticket: "so_ida", out: tripLeg(f), back: null,
    totalBrl: f.kind === "cash" ? (f.brl?.amount ?? null) : null, totalMiles: f.miles, taxesBrl: f.taxesBrl, totalDurationMin: f.durationMin,
    program: f.program, programName: f.programName, availability: f.availability, observedAt: f.observedAt,
    recent: f.recent, opportunity: f.opportunity, offers: [offer(f)], alsoFrom: [],
  };
}

function pair(a: FlightResult, b: FlightResult): Trip {
  const cash = a.kind === "cash";
  return {
    id: `${a.key}+${b.key}`, kind: a.kind, ticket: "dois_bilhetes", out: tripLeg(a), back: tripLeg(b),
    totalBrl: cash ? sum(a.brl?.amount ?? null, b.brl?.amount ?? null) : null,
    totalMiles: cash ? null : sum(a.miles, b.miles),
    taxesBrl: cash ? null : sum(a.taxesBrl ?? 0, b.taxesBrl ?? 0),
    totalDurationMin: sum(a.durationMin, b.durationMin),
    program: a.program, programName: a.programName, availability: worst([a.availability, b.availability]),
    observedAt: [a.observedAt, b.observedAt].sort()[0], recent: a.recent && b.recent, opportunity: a.opportunity || b.opportunity,
    offers: [offer(a), offer(b)],
    alsoFrom: [],
  };
}

function roundTripFare(f: FlightResult): Trip {
  return {
    ...single(f),
    ticket: "ida_e_volta",
    back: {
      origin: f.destination, destination: f.origin, date: f.returnDate!, departAt: f.returnAt, arriveAt: null, durationMin: f.returnDurationMin,
      stops: f.returnStops, carrier: f.carrier, carrierName: f.carrierName, flightNumbers: null, cabin: f.cabin,
    },
    totalDurationMin: sum(f.durationMin, f.returnDurationMin),
  };
}

/** Quantas opções de cada trecho entram nas combinações de dois bilhetes. */
const COMBINE_TOP = 12;
const MAX_TRIPS = 80;

function buildTrips(ida: ReturnType<typeof searchLeg>, volta: ReturnType<typeof searchLeg> | null, returnDate: string | null): Trip[] {
  if (!volta || !returnDate) return mergeSameTrips(ida.results.map(single)).slice(0, MAX_TRIPS);
  const trips: Trip[] = ida.roundTrips.filter((f) => f.departDate === ida.date && f.returnDate === returnDate).map(roundTripFare);
  const best = (list: FlightResult[]) =>
    [...list].sort((x, y) => (x.brl?.amount ?? x.miles ?? Infinity) - (y.brl?.amount ?? y.miles ?? Infinity)).slice(0, COMBINE_TOP);
  const outs = best(ida.results);
  const backs = best(volta.results);
  for (const a of outs) {
    for (const b of backs) {
      // dinheiro com dinheiro; milhas só com o mesmo programa
      if (a.kind !== b.kind || (a.kind === "award" && a.program !== b.program)) continue;
      trips.push(pair(a, b));
    }
  }
  return mergeSameTrips(trips).slice(0, MAX_TRIPS);
}

const price = (t: Trip) => t.totalBrl ?? t.totalMiles ?? Infinity;

/** Primeiro voo e horário de partida (até o minuto): identifica o mesmo voo vindo de fontes diferentes. */
const compatible = (a: string | null, b: string | null) => !a || !b || a === b || !a.includes("+") || !b.includes("+");
const sameConnections = (x: Trip, y: Trip) =>
  compatible(x.out.flightNumbers, y.out.flightNumbers) && compatible(x.back?.flightNumbers ?? null, y.back?.flightNumbers ?? null);

function legSig(l: TripLeg | null): string {
  if (!l) return "-";
  const first = (l.flightNumbers ?? "").split("+")[0];
  return `${first || l.carrier || "?"}|${(l.departAt ?? "").slice(0, 16)}`;
}

/**
 * Junta a mesma viagem vinda de fontes diferentes: fica a oferta mais barata e as
 * outras aparecem como "também em". Viagens sem número de voo não se juntam.
 */
export function mergeSameTrips(trips: Trip[]): Trip[] {
  const sorted = [...trips].sort((x, y) => price(x) - price(y));
  const bySig = new Map<string, Trip>();
  const out: Trip[] = [];
  for (const t of sorted) {
    const known = !!t.out.flightNumbers && (!t.back || !!t.back.flightNumbers || t.ticket === "ida_e_volta");
    const sig = `${t.kind}|${t.program ?? ""}|${t.ticket === "so_ida" ? "1" : "2"}|${legSig(t.out)}|${legSig(t.back)}`;
    // mesmo primeiro voo e horário: só é a mesma viagem se as conexões também baterem
    // (quando uma fonte só informa o primeiro voo, não dá para distinguir: junta)
    const candidate = known ? bySig.get(sig) : undefined;
    const main = candidate && sameConnections(candidate, t) ? candidate : undefined;
    if (main) {
      const mainSources = main.offers.map((o) => o.sourceId).join("+");
      const mine = t.offers.map((o) => o.sourceId).join("+");
      // a mesma fonte repetida não é outra oferta
      if (mine !== mainSources && !main.alsoFrom.some((a) => a.sourceId === mine && a.totalBrl === t.totalBrl)) {
        main.alsoFrom.push({ sourceId: mine, seller: t.offers.map((o) => o.seller).filter(Boolean).join(" e ") || null, totalBrl: t.totalBrl, totalMiles: t.totalMiles, url: t.offers[0]?.url ?? null });
      }
      continue;
    }
    if (known && !candidate) bySig.set(sig, t);
    out.push(t);
  }
  return out;
}

/** Menor preço só de ida por dia nos meses pedidos (para o calendário de escolha de datas). */
export function dayPrices(store: Store, origin: string, destination: string, months: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  const opp = new Set<string>();
  for (const m of months) {
    for (const d of searchLeg(store, "ida", origin, destination, `${m}-15`, "any", opp).calendar.days) {
      if (d.lowestAmount !== null) out[d.date] = d.lowestAmount;
    }
  }
  return out;
}

const coversCash = (r: Robot) => r.covers?.kind === "cash";
const coversProgram = (r: Robot, id: string) => r.covers?.kind === "award" && r.covers.programs.includes(id);

export function searchFlights(store: Store, q: FlightQuery, robots: Robot[] = ROBOTS): SearchResponse {
  const opp = opportunityKeys(store);
  const ida = searchLeg(store, "ida", q.origin, q.destination, q.departDate, q.cabin, opp);
  const volta = q.returnDate ? searchLeg(store, "volta", q.destination, q.origin, q.returnDate, q.cabin, opp) : null;
  const trips = buildTrips(ida, volta, q.returnDate);
  const legs: LegResult[] = [ida, ...(volta ? [volta] : [])].map(({ roundTrips: _rt, ...l }) => l);
  const hasKind = (kind: "cash" | "award", program?: string) => trips.some((t) => t.kind === kind && (!program || t.program === program));
  const statuses = robotStatuses(store, robots);

  const modality = (id: string, kind: "cash" | "award", label: string, mine: Robot[], noSource: string, has: boolean): Modality => {
    const st = statuses.filter((s) => mine.some((r) => r.id === s.id));
    const live = st.filter((s) => s.connection === "conectada" || s.connection === "configurada_sem_prova");
    const updatedAt = st.map((s) => s.lastOkAt).filter(Boolean).sort().reverse()[0] ?? null;
    // resultado gravado é real (tem fonte e horário), mesmo que a fonte esteja fora agora
    if (has) return { id, kind, label, status: "com_resultados", detail: "", updatedAt };
    if (!live.length) return { id, kind, label, status: "sem_fonte", detail: noSource, updatedAt: null };
    if (live.every((s) => s.lastStatus === "error")) return { id, kind, label, status: "indisponivel", detail: "A fonte não respondeu na última tentativa. Tentaremos de novo automaticamente.", updatedAt };
    return { id, kind, label, status: "sem_resultados", detail: "A fonte não encontrou preços para esta rota e data.", updatedAt };
  };

  const modalities: Modality[] = [
    modality("cash", "cash", "Dinheiro", robots.filter(coversCash), "Ainda não há fonte de preços em dinheiro conectada.", hasKind("cash")),
    ...LOYALTY_PROGRAMS.map((p) =>
      modality(
        p.id,
        "award",
        p.name,
        robots.filter((r) => coversProgram(r, p.id)),
        PROGRAM_BLOCKERS.find((b) => b.id === p.id)?.blocker ?? "Sem fonte autorizada de resgates para este programa.",
        hasKind("award", p.id),
      ),
    ),
  ];

  return {
    query: q,
    legs,
    trips,
    modalities,
    onDemand: robots.some((r) => r.collectRoute && !policyBlock(r) && !r.notReady()),
    generatedAt: new Date().toISOString(),
  };
}
