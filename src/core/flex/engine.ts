// Férias flexíveis: dado um período e uma faixa de duração, acha as janelas de
// viagem mais baratas. Função pura: recebe só preços reais (já em BRL) e devolve
// as janelas, o melhor de cada dia e de cada mês, e a cobertura dos dados.
// Nunca estima: dia sem preço fica "sem_dado".

export interface FlexQuery {
  origin: string;
  destination: string;
  fromMonth: string; // AAAA-MM
  toMonth: string; // AAAA-MM
  minDays: number;
  maxDays: number;
  directOnly?: boolean;
  maxPrice?: number | null;
  /** Dias da semana permitidos para sair (0 = domingo … 6 = sábado). Vazio = todos. */
  weekdays?: number[];
}

/** Uma tarifa só de ida (o melhor preço de um dia num sentido). */
export interface OneWayPrice {
  date: string; // AAAA-MM-DD
  brl: number;
  stops: number | null;
  carrier: string | null;
  sourceId: string;
  observedAt: string;
  key: string;
}

/** Uma tarifa de ida e volta vendida como bilhete único (inclui as janelas do Google Explore). */
export interface RoundTripPrice {
  departDate: string;
  returnDate: string;
  brl: number;
  stops: number | null;
  returnStops: number | null;
  carrier: string | null;
  sourceId: string;
  observedAt: string;
  key: string;
  /** Aceita a duração com folga de ±1 dia (o Google Explore só trabalha com "1 ou 2 semanas"). */
  approxDuration?: boolean;
}

export interface FlexWindow {
  departDate: string;
  returnDate: string;
  days: number;
  totalBrl: number;
  ticket: "ida_e_volta" | "dois_bilhetes";
  carrier: string | null;
  stops: number | null; // maior número de escalas entre ida e volta
  sources: string[];
  observedAt: string; // a consulta mais antiga envolvida
  keys: string[];
}

export type DayStatus = "ok" | "sem_dado" | "ainda_nao_a_venda" | "passado" | "fora_do_filtro";

export interface FlexDay {
  date: string;
  status: DayStatus;
  best: FlexWindow | null;
}

export interface FlexMonth {
  month: string;
  status: "ok" | "sem_dado" | "ainda_nao_a_venda" | "passado";
  best: FlexWindow | null;
  /** Dias de saída possíveis no mês com alguma janela de preço real (0 a 1). */
  coverage: number;
}

export interface FlexResult {
  query: FlexQuery;
  windows: FlexWindow[];
  days: FlexDay[];
  months: FlexMonth[];
  coverage: number;
  generatedAt: string;
}

/** As companhias abrem as vendas com cerca de 11 meses de antecedência. */
export const SALES_HORIZON_DAYS = 330;
/** Janelas do top 5 precisam começar com pelo menos esta distância entre si. */
const MIN_GAP_DAYS = 3;

const DAY = 86_400_000;
const toTime = (d: string) => Date.parse(`${d}T12:00:00Z`);
const toDate = (t: number) => new Date(t).toISOString().slice(0, 10);
export const addDays = (d: string, n: number) => toDate(toTime(d) + n * DAY);
export const daysBetween = (a: string, b: string) => Math.round((toTime(b) - toTime(a)) / DAY);

function monthRange(from: string, to: string): string[] {
  const out: string[] = [];
  let [y, m] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  while (y < ty || (y === ty && m <= tm)) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    if (++m > 12) {
      m = 1;
      y++;
    }
  }
  return out;
}

function datesOfMonth(month: string): string[] {
  const [y, m] = month.split("-").map(Number);
  const n = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return Array.from({ length: n }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`);
}

const weekday = (d: string) => new Date(toTime(d)).getUTCDay();
const maxStops = (a: number | null, b: number | null) => (a == null || b == null ? (a ?? b) : Math.max(a, b));

/** Para cada dia de saída d, o mínimo de `back` entre d+min e d+max (fila monotônica, O(n)). */
function bestReturnPerDay(departDates: string[], back: Map<string, OneWayPrice>, minDays: number, maxDays: number): Map<string, OneWayPrice> {
  const out = new Map<string, OneWayPrice>();
  if (!departDates.length) return out;
  const first = departDates[0];
  const last = addDays(departDates[departDates.length - 1], maxDays);
  const span = daysBetween(first, last) + 1;
  const series: (OneWayPrice | null)[] = Array.from({ length: span }, (_, i) => back.get(addDays(first, i)) ?? null);
  const deque: number[] = []; // índices com preço crescente
  let right = -1;
  for (const d of departDates) {
    const offset = daysBetween(first, d);
    const lo = offset + minDays;
    const hi = Math.min(offset + maxDays, span - 1);
    while (right < hi) {
      right++;
      const v = series[right];
      if (!v) continue;
      while (deque.length && series[deque[deque.length - 1]]!.brl >= v.brl) deque.pop();
      deque.push(right);
    }
    while (deque.length && deque[0] < lo) deque.shift();
    if (deque.length) out.set(d, series[deque[0]]!);
  }
  return out;
}

export function computeWindows(
  query: FlexQuery,
  data: { outbound: OneWayPrice[]; inbound: OneWayPrice[]; roundTrips: RoundTripPrice[] },
  today: string,
): FlexResult {
  const months = monthRange(query.fromMonth, query.toMonth);
  const horizon = addDays(today, SALES_HORIZON_DAYS);
  const allDates = months.flatMap(datesOfMonth);
  const allowedDay = (d: string) => !query.weekdays?.length || query.weekdays.includes(weekday(d));
  const okStops = (s: number | null) => !query.directOnly || s === 0;
  const okPrice = (p: number) => query.maxPrice == null || p <= query.maxPrice;

  const cheapest = <T extends { brl: number }>(list: T[], key: (x: T) => string) => {
    const m = new Map<string, T>();
    for (const x of list) {
      const k = key(x);
      const prev = m.get(k);
      if (!prev || x.brl < prev.brl) m.set(k, x);
    }
    return m;
  };
  const out = cheapest(data.outbound.filter((f) => okStops(f.stops)), (f) => f.date);
  const back = cheapest(data.inbound.filter((f) => okStops(f.stops)), (f) => f.date);

  const departDates = allDates.filter((d) => d >= today && d <= horizon);
  const bestBack = bestReturnPerDay(departDates, back, query.minDays, query.maxDays);

  // melhor janela por dia de saída
  const bestByDay = new Map<string, FlexWindow>();
  const offer = (w: FlexWindow) => {
    if (!okPrice(w.totalBrl)) return;
    const prev = bestByDay.get(w.departDate);
    if (!prev || w.totalBrl < prev.totalBrl) bestByDay.set(w.departDate, w);
  };

  for (const d of departDates) {
    const o = out.get(d);
    const b = bestBack.get(d);
    if (!o || !b) continue;
    offer({
      departDate: d,
      returnDate: b.date,
      days: daysBetween(d, b.date),
      totalBrl: Math.round((o.brl + b.brl) * 100) / 100,
      ticket: "dois_bilhetes",
      carrier: o.carrier === b.carrier ? o.carrier : o.carrier && b.carrier ? `${o.carrier}/${b.carrier}` : (o.carrier ?? b.carrier),
      stops: maxStops(o.stops, b.stops),
      sources: [...new Set([o.sourceId, b.sourceId])],
      observedAt: [o.observedAt, b.observedAt].sort()[0],
      keys: [o.key, b.key],
    });
  }

  for (const rt of data.roundTrips) {
    const days = daysBetween(rt.departDate, rt.returnDate);
    const slack = rt.approxDuration ? 1 : 0;
    if (days < query.minDays - slack || days > query.maxDays + slack) continue;
    if (query.directOnly && (rt.stops !== 0 || (rt.returnStops != null && rt.returnStops !== 0))) continue;
    if (rt.departDate < today || rt.departDate > horizon) continue;
    if (!departDates.includes(rt.departDate)) continue;
    offer({
      departDate: rt.departDate,
      returnDate: rt.returnDate,
      days,
      totalBrl: rt.brl,
      ticket: "ida_e_volta",
      carrier: rt.carrier,
      stops: maxStops(rt.stops, rt.returnStops),
      sources: [rt.sourceId],
      observedAt: rt.observedAt,
      keys: [rt.key],
    });
  }

  const days: FlexDay[] = allDates.map((d) => {
    if (d < today) return { date: d, status: "passado", best: null };
    if (d > horizon) return { date: d, status: "ainda_nao_a_venda", best: null };
    if (!allowedDay(d)) return { date: d, status: "fora_do_filtro", best: null };
    const best = bestByDay.get(d) ?? null;
    return { date: d, status: best ? "ok" : "sem_dado", best };
  });

  const monthsOut: FlexMonth[] = months.map((m) => {
    const md = days.filter((d) => d.date.startsWith(m));
    const open = md.filter((d) => d.status === "ok" || d.status === "sem_dado");
    const withPrice = md.filter((d) => d.status === "ok");
    const best = withPrice.reduce<FlexWindow | null>((acc, d) => (!acc || d.best!.totalBrl < acc.totalBrl ? d.best : acc), null);
    const status: FlexMonth["status"] = withPrice.length
      ? "ok"
      : md.every((d) => d.status === "passado")
        ? "passado"
        : md.every((d) => d.status === "ainda_nao_a_venda" || d.status === "passado")
          ? "ainda_nao_a_venda"
          : "sem_dado";
    return { month: m, status, best, coverage: open.length ? Math.round((withPrice.length / open.length) * 100) / 100 : 0 };
  });

  // top 5: mais baratas, sem repetir quase a mesma viagem
  const ranked = days.filter((d) => d.best).map((d) => d.best!).sort((a, b) => a.totalBrl - b.totalBrl);
  const windows: FlexWindow[] = [];
  for (const w of ranked) {
    if (windows.some((x) => Math.abs(daysBetween(x.departDate, w.departDate)) < MIN_GAP_DAYS)) continue;
    windows.push(w);
    if (windows.length === 5) break;
  }

  const open = days.filter((d) => d.status === "ok" || d.status === "sem_dado");
  return {
    query,
    windows,
    days,
    months: monthsOut,
    coverage: open.length ? Math.round((open.filter((d) => d.status === "ok").length / open.length) * 100) / 100 : 0,
    generatedAt: new Date().toISOString(),
  };
}
