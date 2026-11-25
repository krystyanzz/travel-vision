"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RoutePair } from "@/components/AirportInput";
import { DateRangeField, shortLabel } from "@/components/DatePicker";
import { ago, AvailabilityBadge, dateTime, FreshBadge, money, OpportunityBadge } from "@/components/FareBadges";
import { brl, duration, int } from "@/components/format";
import { ProgramMatches, UnreviewedNote } from "@/components/PartnerExplorer";
import { PartnerLink } from "@/components/PartnerLink";
import { PriceCalendar } from "@/components/PriceCalendar";
import { RouteLoader } from "@/components/RouteLoader";
import { rememberOrigin, useHomeAirport } from "@/components/useHomeAirport";
import type { ProgramMatch } from "@/core/partners/partners";
import { calendarLevels } from "@/core/pricing";
import type { Modality, SearchResponse, Trip, TripLeg } from "@/core/search/flights";
import { CABIN_LABEL, type Cabin } from "@/core/types";

// Busca consolidada: dinheiro e milhas de todas as fontes conectadas, só com
// dados reais. Ida e volta aparece como viagem completa, com preço total.

interface Form {
  origin: string;
  destination: string;
  departDate: string;
  returnDate: string;
  roundTrip: boolean;
  cabin: Cabin | "any";
}

type Sort = "melhor" | "barato" | "rapido" | "milhas";
type DayPart = "madrugada" | "manha" | "tarde" | "noite";
const DAY_PARTS: { id: DayPart; label: string; from: number; to: number }[] = [
  { id: "madrugada", label: "Madrugada (0h–6h)", from: 0, to: 6 },
  { id: "manha", label: "Manhã (6h–12h)", from: 6, to: 12 },
  { id: "tarde", label: "Tarde (12h–18h)", from: 12, to: 18 },
  { id: "noite", label: "Noite (18h–24h)", from: 18, to: 24 },
];

const STATUS_LABEL: Record<Modality["status"], string> = {
  com_resultados: "Com resultados",
  sem_resultados: "Sem preços para esta busca",
  sem_fonte: "Sem fonte conectada",
  indisponivel: "Fonte temporariamente indisponível",
};
const STATUS_CLASS: Record<Modality["status"], string> = { com_resultados: "is-ok", sem_resultados: "is-empty", sem_fonte: "is-off", indisponivel: "is-down" };
const SOURCE_NAME: Record<string, string> = { travelpayouts: "Aviasales", "serpapi-google": "Google Flights" };
const sourceName = (id: string) => id.split("+").map((s) => SOURCE_NAME[s] ?? s).filter((v, i, a) => a.indexOf(v) === i).join(" + ");

function inDays(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

const toggle = <T,>(set: Set<T>, v: T) => {
  const n = new Set(set);
  if (n.has(v)) n.delete(v);
  else n.add(v);
  return n;
};

/** Hora local de partida como a fonte informou (o texto ISO já vem no fuso da origem). */
function localTime(iso: string | null): string {
  const m = iso ? /T(\d{2}):(\d{2})/.exec(iso) : null;
  return m ? `${m[1]}:${m[2]}` : "—";
}
const localHour = (iso: string | null) => {
  const m = iso ? /T(\d{2})/.exec(iso) : null;
  return m ? Number(m[1]) : null;
};

/** Custo efetivo em R$: dinheiro, ou milhas pelo seu custo do milheiro + taxas. */
function effectiveCost(t: Trip, milheiro: number): number | null {
  if (t.kind === "cash") return t.totalBrl;
  if (t.totalMiles == null) return null;
  return (t.totalMiles / 1000) * milheiro + (t.taxesBrl ?? 0);
}

const maxStops = (t: Trip) => Math.max(t.out.stops ?? 0, t.back?.stops ?? 0);

/** Sem parâmetros: tudo vazio para o usuário escolher (a origem vem da localização). */
function formFromParams(p: URLSearchParams): Form {
  const volta = p.get("volta") ?? "";
  return {
    origin: p.get("de") ?? "",
    destination: p.get("para") ?? "",
    departDate: p.get("ida") ?? "",
    returnDate: p.has("de") ? volta : "",
    roundTrip: p.has("de") ? !!volta : true,
    cabin: (p.get("cabine") as Cabin | null) ?? "any",
  };
}

export function SearchClient() {
  const params = useSearchParams();
  const router = useRouter();
  const [form, setForm] = useState<Form>(() => formFromParams(params));
  const [data, setData] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState<string | null>(null);
  const [month, setMonth] = useState(form.departDate.slice(0, 7));

  const [kinds, setKinds] = useState<Set<"cash" | "award">>(new Set());
  const [programs, setPrograms] = useState<Set<string>>(new Set());
  const [carriers, setCarriers] = useState<Set<string>>(new Set());
  const [stopsMax, setStopsMax] = useState(2);
  const [parts, setParts] = useState<Set<DayPart>>(new Set());
  const [singleTicket, setSingleTicket] = useState(false);
  const [confirmedOnly, setConfirmedOnly] = useState(false);
  const [sort, setSort] = useState<Sort>("melhor");
  const [milheiro, setMilheiro] = useState(20);

  const queryString = useCallback((f: Form) => {
    const q = new URLSearchParams({ de: f.origin, para: f.destination, ida: f.departDate });
    if (f.roundTrip && f.returnDate) q.set("volta", f.returnDate);
    if (f.cabin !== "any") q.set("cabine", f.cabin);
    return q.toString();
  }, []);

  // primeira abertura, sem busca na URL: origem = aeroporto mais próximo do usuário
  useHomeAirport(!params.get("de"), (code) => setForm((f) => (f.origin ? f : { ...f, origin: code })));

  // buscas já completadas nas fontes nesta visita (não repete a consulta)
  const autoTried = useRef(new Set<string>());

  const run = useCallback(
    async (f: Form) => {
      setLoading(true);
      setError(null);
      setRefreshing(null);
      try {
        const qs = queryString(f);
        const res = await fetch(`/api/voos?${qs}`);
        const body = (await res.json()) as SearchResponse & { error?: string };
        if (!res.ok) throw new Error(body.error ?? "Falha na busca");
        // mostra já o que está no banco e consulta as fontes ao vivo em segundo plano (uma vez por busca)
        setData(body);
        if (body.onDemand && !autoTried.current.has(qs)) {
          autoTried.current.add(qs);
          setRefreshing("Buscando mais preços nas fontes conectadas…");
          void fetch(`/api/voos/atualizar?${qs}`, { method: "POST" })
            .then((r) => r.json())
            .then(async (up) => {
              if (up?.refreshed) setData(await fetch(`/api/voos?${qs}`).then((r) => r.json()));
              setRefreshing(null);
            })
            .catch(() => setRefreshing(null));
        }
        setMonth(f.departDate.slice(0, 7));
        setCarriers(new Set());
        setPrograms(new Set());
      } catch (e) {
        setError(e instanceof Error ? e.message : "Falha na busca");
        setData(null);
      } finally {
        setLoading(false);
      }
    },
    [queryString],
  );

  useEffect(() => {
    if (params.get("de")) void run(form);
    // busca inicial apenas quando chegou com parâmetros
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function go(f: Form) {
    setForm(f);
    rememberOrigin(f.origin);
    router.replace(`/busca?${queryString(f)}`, { scroll: false });
    void run(f);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!/^[A-Z]{3}$/.test(form.origin) || !/^[A-Z]{3}$/.test(form.destination)) {
      setError("Escolha a origem e o destino.");
      return;
    }
    if (!form.departDate) {
      setError("Escolha a data de ida.");
      return;
    }
    if (form.roundTrip && !form.returnDate) {
      setError("Escolha a data de volta, ou mude para só ida.");
      return;
    }
    go(form);
  }

  async function refreshNow() {
    if (!data) return;
    setRefreshing("Consultando as fontes…");
    try {
      const res = await fetch(`/api/voos/atualizar?${queryString(form)}`, { method: "POST" });
      const body = await res.json();
      setRefreshing(body.message ?? null);
      if (body.refreshed) await run(form);
    } catch {
      setRefreshing("Não foi possível atualizar agora.");
    }
  }

  const trips = data?.trips ?? [];
  const roundTrip = !!data?.query.returnDate;
  const ida = data?.legs[0] ?? null;
  const volta = data?.legs[1] ?? null;

  const allCarriers = useMemo(
    () => [...new Map(trips.flatMap((t) => [t.out, t.back]).filter((l): l is TripLeg => !!l?.carrier).map((l) => [l.carrier!, l.carrierName ?? l.carrier!])).entries()],
    [trips],
  );
  const allPrograms = useMemo(() => [...new Map(trips.filter((t) => t.program).map((t) => [t.program!, t.programName ?? t.program!])).entries()], [trips]);

  const filtered = useMemo(
    () =>
      trips.filter((t) => {
        if (kinds.size && !kinds.has(t.kind)) return false;
        if (programs.size && t.kind === "award" && !programs.has(t.program ?? "")) return false;
        if (carriers.size && ![t.out.carrier, t.back?.carrier].some((c) => c && carriers.has(c))) return false;
        if (maxStops(t) > stopsMax) return false;
        if (singleTicket && t.ticket === "dois_bilhetes") return false;
        if (confirmedOnly && t.availability !== "confirmada") return false;
        if (parts.size) {
          const h = localHour(t.out.departAt);
          if (h === null || ![...parts].some((p) => {
            const dp = DAY_PARTS.find((x) => x.id === p)!;
            return h >= dp.from && h < dp.to;
          })) return false;
        }
        return true;
      }),
    [trips, kinds, programs, carriers, stopsMax, singleTicket, confirmedOnly, parts],
  );

  // as quatro ordenações, com o melhor valor de cada uma para mostrar na aba
  const sorted = useMemo(() => {
    const cost = (t: Trip) => effectiveCost(t, milheiro) ?? Infinity;
    const dur = (t: Trip) => t.totalDurationMin ?? Infinity;
    const minCost = Math.min(...filtered.map(cost));
    const minDur = Math.min(...filtered.map(dur));
    // "melhor": preço pesa mais que tempo de viagem
    const score = (t: Trip) => cost(t) / minCost + 0.5 * (Number.isFinite(dur(t)) ? dur(t) / minDur : 3);
    const by = (k: (t: Trip) => number) => [...filtered].sort((a, b) => k(a) - k(b));
    return {
      melhor: by(score),
      barato: by(cost),
      rapido: by(dur),
      milhas: by((t) => (t.kind === "award" ? (t.totalMiles ?? Infinity) : Infinity)),
    };
  }, [filtered, milheiro]);
  const list = sorted[sort];
  const hasAward = trips.some((t) => t.kind === "award");

  const calendar = ida ? { days: ida.calendar.days, levels: calendarLevels(ida.calendar.days) } : null;
  const calendarHasData = !!calendar?.days.some((d) => d.lowestAmount !== null);
  const idaFrom = ida?.results.filter((f) => f.brl).map((f) => f.brl!.amount).sort((a, b) => a - b)[0] ?? null;
  const voltaHasAny = !!volta?.calendar.days.some((d) => d.lowestAmount !== null);

  return (
    <>
      <form className="card search-form search-form-v3" onSubmit={submit}>
        <div className="trip-type" role="radiogroup" aria-label="Tipo de viagem">
          {[
            [true, "Ida e volta"],
            [false, "Só ida"],
          ].map(([v, l]) => (
            <button key={String(v)} type="button" role="radio" aria-checked={form.roundTrip === v} className={form.roundTrip === v ? "is-on" : ""} onClick={() => setForm({ ...form, roundTrip: v as boolean })}>
              {l as string}
            </button>
          ))}
        </div>
        <RoutePair idPrefix="busca" origin={form.origin} destination={form.destination} onChange={(v) => setForm({ ...form, ...v })} />
        <DateRangeField
          departDate={form.departDate}
          returnDate={form.returnDate}
          roundTrip={form.roundTrip}
          origin={form.origin}
          destination={form.destination}
          onChange={(v) => setForm({ ...form, ...v })}
        />
        <div className="field">
          <label htmlFor="cabin">Cabine</label>
          <select id="cabin" className="select" value={form.cabin} onChange={(e) => setForm({ ...form, cabin: e.target.value as Cabin | "any" })}>
            <option value="any">Qualquer</option>
            {Object.entries(CABIN_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <button className="btn btn-primary search-submit" type="submit" disabled={loading}>
          {loading ? "Buscando…" : "Buscar"}
        </button>
      </form>

      {error && (
        <div className="notice notice-warning" role="alert" style={{ marginTop: "var(--space-4)" }}>
          {error}
        </div>
      )}

      {loading && !data && <RouteLoader from={form.origin} to={form.destination} />}

      {data && ida && (
        <>
          <section className="results-head card" aria-label="Resumo da busca">
            <div className="results-head-top">
              <div>
                <h2>
                  {ida.origin} → {ida.destination}
                  {roundTrip ? " · ida e volta" : ""}
                </h2>
                <p className="muted">
                  {shortLabel(data.query.departDate)}
                  {data.query.returnDate ? ` – ${shortLabel(data.query.returnDate)}` : ""} ·{" "}
                  {trips.length
                    ? `${trips.length} ${trips.length === 1 ? "opção real" : "opções reais"}`
                    : "nenhuma opção completa com preço real"}
                </p>
              </div>
              {data.onDemand && (
                <button type="button" className="btn btn-ghost btn-sm" onClick={refreshNow} disabled={!!refreshing && refreshing.endsWith("…")}>
                  Atualizar agora
                </button>
              )}
            </div>
            {refreshing && (
              <p className="muted refresh-status" role="status">
                {refreshing.endsWith("…") && <span className="live-dot" aria-hidden />} {refreshing}
              </p>
            )}
            <ModalitySummary modalities={data.modalities} />
          </section>

          <div className="search-layout">
            <aside className="card filters" aria-label="Filtros">
              {sort === "melhor" && hasAward && (
                <fieldset>
                  <legend>Seu custo do milheiro</legend>
                  <label className="milheiro">
                    R$ por 1.000 milhas (para comparar com dinheiro)
                    <input className="input" type="number" min={1} max={200} value={milheiro} onChange={(e) => setMilheiro(Math.max(1, Number(e.target.value) || 1))} />
                  </label>
                </fieldset>
              )}
              <fieldset>
                <legend>Escalas</legend>
                {[
                  [0, "Somente diretos"],
                  [1, "Até 1 escala"],
                  [2, "Qualquer"],
                ].map(([v, l]) => (
                  <label key={v} className="check">
                    <input type="radio" name="stops" checked={stopsMax === v} onChange={() => setStopsMax(v as number)} />
                    {l}
                  </label>
                ))}
              </fieldset>
              {roundTrip && (
                <fieldset>
                  <legend>Bilhete</legend>
                  <label className="check">
                    <input type="checkbox" checked={singleTicket} onChange={(e) => setSingleTicket(e.target.checked)} />
                    Só bilhete único de ida e volta
                  </label>
                </fieldset>
              )}
              <fieldset>
                <legend>Modalidade</legend>
                {[
                  ["cash", "Dinheiro"],
                  ["award", "Milhas"],
                ].map(([v, l]) => (
                  <label key={v} className="check">
                    <input type="checkbox" checked={kinds.has(v as "cash" | "award")} onChange={() => setKinds(toggle(kinds, v as "cash" | "award"))} />
                    {l}
                  </label>
                ))}
              </fieldset>
              {allPrograms.length > 0 && (
                <fieldset>
                  <legend>Programa</legend>
                  {allPrograms.map(([id, name]) => (
                    <label key={id} className="check">
                      <input type="checkbox" checked={programs.has(id)} onChange={() => setPrograms(toggle(programs, id))} />
                      {name}
                    </label>
                  ))}
                </fieldset>
              )}
              <fieldset>
                <legend>Horário de partida{roundTrip ? " (ida)" : ""}</legend>
                {DAY_PARTS.map((p) => (
                  <label key={p.id} className="check">
                    <input type="checkbox" checked={parts.has(p.id)} onChange={() => setParts(toggle(parts, p.id))} />
                    {p.label}
                  </label>
                ))}
              </fieldset>
              {allCarriers.length > 0 && (
                <fieldset>
                  <legend>Companhias</legend>
                  {allCarriers.map(([code, name]) => (
                    <label key={code} className="check">
                      <input type="checkbox" checked={carriers.has(code)} onChange={() => setCarriers(toggle(carriers, code))} />
                      {name}
                    </label>
                  ))}
                </fieldset>
              )}
              <fieldset>
                <legend>Disponibilidade</legend>
                <label className="check">
                  <input type="checkbox" checked={confirmedOnly} onChange={(e) => setConfirmedOnly(e.target.checked)} />
                  Só assento confirmado
                </label>
              </fieldset>
            </aside>

            <div className="stack">
              {filtered.length > 0 && (
                <div className="sort-tabs" role="tablist" aria-label="Ordenar">
                  {(
                    [
                      ["melhor", "Melhor", sorted.melhor[0]],
                      ["barato", "Mais barato", sorted.barato[0]],
                      ["rapido", "Mais rápido", sorted.rapido[0]],
                      ...(hasAward ? [["milhas", "Menos milhas", sorted.milhas[0]] as const] : []),
                    ] as const
                  ).map(([id, label, top]) => (
                    <button key={id} type="button" role="tab" aria-selected={sort === id} className={sort === id ? "is-on" : ""} onClick={() => setSort(id as Sort)}>
                      <span className="sort-label">{label}</span>
                      {top && (
                        <span className="sort-value">
                          {id === "milhas" && top.totalMiles != null ? `${int(top.totalMiles)} milhas` : top.totalBrl != null ? brl(top.totalBrl) : top.totalMiles != null ? `${int(top.totalMiles)} mi` : "—"}
                          {top.totalDurationMin ? ` · ${duration(roundTrip && top.back ? Math.round(top.totalDurationMin / 2) : top.totalDurationMin)}${roundTrip && top.back ? " média" : ""}` : ""}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}

              <section aria-label="Resultados" aria-busy={loading}>
                {list.length > 0 ? (
                  list.map((t) => <TripCard key={t.id} t={t} milheiro={hasAward ? milheiro : null} />)
                ) : trips.length > 0 ? (
                  <div className="card empty-state">
                    <p>Nenhuma opção com esses filtros.</p>
                    <p className="muted">Ajuste os filtros ao lado.</p>
                  </div>
                ) : (
                  <EmptyTrips
                    roundTrip={roundTrip}
                    idaFrom={idaFrom}
                    voltaHasAny={voltaHasAny}
                    calendarHasData={calendarHasData}
                    returnDate={data.query.returnDate}
                    departDate={data.query.departDate}
                    returnOptions={(volta?.calendar.days ?? []).filter((d) => d.lowestAmount !== null && d.date >= data.query.departDate)}
                    departOptions={(ida.calendar.days ?? []).filter((d) => d.lowestAmount !== null)}
                    onReturn={(d) => go({ ...form, returnDate: d })}
                    onDepart={(d) => go({ ...form, departDate: d, returnDate: form.returnDate && form.returnDate < d ? "" : form.returnDate })}
                    onOneWay={() => go({ ...form, roundTrip: false })}
                  />
                )}
              </section>

              {!roundTrip && (
                <div className="nearby" aria-label="Datas próximas">
                  {ida.nearby.map((n) => (
                    <button key={n.date} type="button" className={`nearby-day ${n.date === ida.date ? "is-on" : ""}`} onClick={() => go({ ...form, departDate: n.date })}>
                      <span>{new Date(`${n.date}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" })}</span>
                      <strong>{n.lowestBrl !== null ? brl(n.lowestBrl) : "—"}</strong>
                    </button>
                  ))}
                </div>
              )}

              {calendar && !roundTrip && (
                <div className="calendar-wrap">
                  <PriceCalendar
                    month={month}
                    days={calendar.days}
                    levels={calendar.levels}
                    selected={ida.date}
                    onSelect={(d) => go({ ...form, departDate: d })}
                    onMonthChange={(m) => {
                      setMonth(m);
                      go({ ...form, departDate: `${m}-01` < inDays(0) ? inDays(0) : `${m}-01` });
                    }}
                  />
                  {!calendarHasData && <p className="muted calendar-note">Ainda não há preços reais coletados neste mês.</p>}
                </div>
              )}

              <RoutePartners origin={ida.origin} destination={ida.destination} />
            </div>
          </div>
        </>
      )}
    </>
  );
}

/** Dinheiro e programas com fonte aparecem um a um; os sem fonte viram uma linha só, com detalhes ao clicar. */
function ModalitySummary({ modalities }: { modalities: Modality[] }) {
  const shown = modalities.filter((m) => m.kind === "cash" || m.status !== "sem_fonte");
  const off = modalities.filter((m) => m.kind === "award" && m.status === "sem_fonte");
  return (
    <div className="modality-summary">
      <ul className="modality-list">
        {shown.map((m) => (
          <li key={m.id} className={`modality ${STATUS_CLASS[m.status]}`} title={m.detail}>
            <span className="modality-name">{m.kind === "award" ? `Milhas · ${m.label}` : m.label}</span>
            <span className="modality-status">{STATUS_LABEL[m.status]}</span>
          </li>
        ))}
        {off.length > 0 && (
          <li className="modality is-off">
            <span className="modality-name">Milhas</span>
            <span className="modality-status">{off.length} programas ainda sem fonte conectada</span>
          </li>
        )}
      </ul>
      {off.length > 0 && (
        <details className="modality-details">
          <summary>Quais programas e por quê</summary>
          <ul>
            {off.map((m) => (
              <li key={m.id}>
                <strong>{m.label}:</strong> {m.detail}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

/** As datas com preço real mais próximas da escolhida, para trocar com um clique. */
function closest(days: { date: string; lowestAmount: number | null }[], target: string, n = 6) {
  const t = Date.parse(target);
  return [...days].sort((a, b) => Math.abs(Date.parse(a.date) - t) - Math.abs(Date.parse(b.date) - t)).slice(0, n).sort((a, b) => a.date.localeCompare(b.date));
}

function DateChips(p: { title: string; days: { date: string; lowestAmount: number | null }[]; onPick: (d: string) => void }) {
  if (!p.days.length) return null;
  return (
    <div className="date-chips">
      <span className="date-chips-title">{p.title}</span>
      <div className="date-chips-list">
        {p.days.map((d) => (
          <button key={d.date} type="button" className="date-chip" onClick={() => p.onPick(d.date)}>
            <span>{shortLabel(d.date)}</span>
            <strong>{brl(d.lowestAmount!)}</strong>
          </button>
        ))}
      </div>
    </div>
  );
}

function EmptyTrips(p: {
  roundTrip: boolean;
  idaFrom: number | null;
  voltaHasAny: boolean;
  calendarHasData: boolean;
  returnDate: string | null;
  departDate: string;
  returnOptions: { date: string; lowestAmount: number | null }[];
  departOptions: { date: string; lowestAmount: number | null }[];
  onReturn: (d: string) => void;
  onDepart: (d: string) => void;
  onOneWay: () => void;
}) {
  if (p.roundTrip && p.idaFrom !== null) {
    return (
      <div className="card empty-state">
        <p>Achamos a ida a partir de {brl(p.idaFrom)}, mas ainda não há preço real para a volta em {shortLabel(p.returnDate!)}.</p>
        <DateChips title="Voltas com preço real perto dessa data (preço só da volta):" days={closest(p.returnOptions, p.returnDate!)} onPick={p.onReturn} />
        {!p.returnOptions.length && <p className="muted">Tente outra data de volta ou veja só a ida.</p>}
        <button type="button" className="btn btn-ghost btn-sm" onClick={p.onOneWay}>
          Ver só a ida
        </button>
      </div>
    );
  }
  return (
    <div className="card empty-state">
      <p>{p.calendarHasData ? "Sem preço real neste dia, mas há em outras datas." : "Ainda não há preço real para esta busca."}</p>
      {p.calendarHasData ? (
        <DateChips title="Idas com preço real perto dessa data:" days={closest(p.departOptions, p.departDate)} onPick={p.onDepart} />
      ) : (
        <p className="muted">Não exibimos preços inventados. Quando uma fonte conectada encontrar esta rota, os preços aparecem aqui.</p>
      )}
    </div>
  );
}

function LegRow({ leg, label }: { leg: TripLeg; label?: string }) {
  return (
    <div className="trip-leg">
      {label && <span className="trip-leg-label">{label}</span>}
      <div className="trip-leg-carrier">
        <span className="carrier-mark" aria-hidden>
          {(leg.carrier ?? "?").slice(0, 2)}
        </span>
        <span>
          {leg.carrierName ?? "Companhia não informada"}
          {leg.flightNumbers && <span className="muted"> · {leg.flightNumbers}</span>}
        </span>
      </div>
      <div className="leg">
        <div>
          <div className="leg-time">{localTime(leg.departAt)}</div>
          <div className="muted">
            {leg.origin} · {shortLabel(leg.date)}
          </div>
        </div>
        <div className="leg-line">
          <span>
            {leg.durationMin ? duration(leg.durationMin) : "duração ?"} · {leg.stops === 0 ? "direto" : leg.stops != null ? `${leg.stops} escala${leg.stops > 1 ? "s" : ""}` : "escalas ?"}
          </span>
        </div>
        <div style={{ textAlign: "right" }}>
          {leg.arriveAt ? (
            <>
              <div className="leg-time">
                {localTime(leg.arriveAt)}
                {leg.arriveAt.slice(0, 10) > leg.date && (
                  <sup className="muted" title="Chega em outro dia">
                    {" "}+{Math.round((Date.parse(leg.arriveAt.slice(0, 10)) - Date.parse(leg.date)) / 86_400_000)}
                  </sup>
                )}
              </div>
              <div className="muted">{leg.destination}</div>
            </>
          ) : (
            <>
              <div className="leg-time">{leg.destination}</div>
              <div className="muted">chegada local não informada</div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function TripCard({ t, milheiro }: { t: Trip; milheiro: number | null }) {
  const cost = milheiro !== null && t.kind === "award" ? effectiveCost(t, milheiro) : null;
  const two = t.ticket === "dois_bilhetes";
  return (
    <article className="card trip-card">
      <div className="trip-main">
        <div className="result-top">
          <span className={`badge ${t.kind === "cash" ? "" : "badge-program"}`}>{t.kind === "cash" ? "Dinheiro" : t.programName}</span>
          {t.back && <span className="badge">{two ? "2 bilhetes só de ida" : "Bilhete único ida e volta"}</span>}
          <AvailabilityBadge value={t.availability} />
          {t.recent && <FreshBadge />}
          {t.opportunity && <OpportunityBadge />}
        </div>
        <LegRow leg={t.out} label={t.back ? "Ida" : undefined} />
        {t.back && <LegRow leg={t.back} label="Volta" />}
      </div>
      <div className="trip-price">
        {t.kind === "cash" ? (
          <div className="price">{t.totalBrl != null ? brl(t.totalBrl) : "—"}</div>
        ) : (
          <>
            <div className="price">{t.totalMiles != null ? `${int(t.totalMiles)} milhas` : "—"}</div>
            <div className="muted price-note">+ {t.taxesBrl != null ? brl(t.taxesBrl) : "taxas não informadas"}</div>
          </>
        )}
        <div className="muted price-note">{t.back ? "total ida e volta, por adulto" : "por adulto, só ida"}</div>
        {two && t.kind === "cash" && (
          <div className="muted price-note">
            ida {t.offers[0].brl != null ? brl(t.offers[0].brl) : "—"} + volta {t.offers[1].brl != null ? brl(t.offers[1].brl) : "—"}
          </div>
        )}
        {t.offers[0].fx && t.offers[0].cashAmount != null && t.offers[0].cashCurrency && (
          <div className="muted price-note">
            {money(t.offers[0].cashAmount, t.offers[0].cashCurrency)} · PTAX {t.offers[0].fx.sell.toFixed(4).replace(".", ",")} de {dateTime(t.offers[0].fx.quotedAt)}
          </div>
        )}
        {cost !== null && <div className="muted price-note">custo efetivo ≈ {brl(cost)}</div>}
        {[...new Set(t.offers.map((o) => o.seller).filter(Boolean))].length > 0 && (
          <div className="muted price-note">vendido por {[...new Set(t.offers.map((o) => o.seller).filter(Boolean))].join(" e ")}</div>
        )}
        <div className="muted price-note">
          {sourceName(t.offers.map((o) => o.sourceId).join("+"))} · atualizado {ago(t.observedAt)}
        </div>
        {t.alsoFrom.length > 0 && (
          <div className="also-from">
            <span className="muted">Também em:</span>
            {t.alsoFrom.map((a, i) => (
              <span key={i}>
                {sourceName(a.sourceId)}
                {a.seller ? ` (${a.seller})` : ""} {a.totalBrl != null ? brl(a.totalBrl) : a.totalMiles != null ? `${int(a.totalMiles)} milhas` : ""}
              </span>
            ))}
          </div>
        )}
        <div className="trip-actions">
          {t.offers.map((o, i) =>
            o.url ? (
              <PartnerLink key={o.key} className="btn btn-primary btn-sm" href={o.url}>
                {two ? (i === 0 ? "Ver ida" : "Ver volta") : t.kind === "cash" ? "Ver no parceiro" : "Emitir no programa"}
              </PartnerLink>
            ) : null,
          )}
        </div>
        {two && <p className="muted price-note trip-warn">Dois bilhetes: compre separadamente; mudanças em um não protegem o outro.</p>}
      </div>
    </article>
  );
}

interface PartnersAnswer {
  status: "ok" | "sem_malha" | "sem_voo_direto" | "limite" | "erro";
  airlines?: { code: string; name: string; weekly: number }[];
  programs?: ProgramMatch[];
  fetchedAt?: string | null;
  partial?: boolean;
  unreviewed: { id: string; name: string; alliance: string | null; url: string }[];
}

/** Quem voa direto na rota (malha AirLabs) e quais programas emitem nessas companhias. */
function RoutePartners({ origin, destination }: { origin: string; destination: string }) {
  const [data, setData] = useState<PartnersAnswer | null>(null);
  const [loading, setLoading] = useState(false);
  const load = useCallback(
    (consult: boolean) => {
      setLoading(true);
      fetch(`/api/parceiros?de=${origin}&para=${destination}${consult ? "&consultar=1" : ""}`)
        .then((r) => r.json())
        .then(setData)
        .catch(() => setData({ status: "erro", unreviewed: [] }))
        .finally(() => setLoading(false));
    },
    [origin, destination],
  );
  useEffect(() => load(false), [load]);

  return (
    <section className="card route-partners" aria-label="Programas que levam ao destino">
      <h3>Com milhas: quem pode levar você de {origin} a {destination}</h3>
      {loading || !data ? (
        <p className="muted">Carregando…</p>
      ) : data.status === "sem_malha" ? (
        <div className="partner-empty">
          <p className="muted">Ainda não temos a malha aérea de {origin}. Consultar agora usa a cota diária da fonte de rotas.</p>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => load(true)}>
            Descobrir quem voa direto nesta rota
          </button>
        </div>
      ) : data.status === "sem_voo_direto" ? (
        <p className="muted">
          Nenhum voo direto {origin} → {destination} na malha consultada{data.partial ? " (malha parcial: pode faltar alguma companhia)" : ""}. Veja as
          conexões em <Link href={`/explorar?de=${origin}`}>Explorar destinos</Link>.
        </p>
      ) : data.status === "limite" ? (
        <p className="muted">Limite diário de consultas de rotas atingido. Tente amanhã.</p>
      ) : data.status === "erro" ? (
        <p className="muted">Não foi possível consultar agora.</p>
      ) : (
        <>
          <p className="muted partner-how">
            Voam direto: {data.airlines!.map((a) => `${a.name} (${a.weekly}x/semana)`).join(", ")}
            {data.partial ? " · malha parcial" : ""} · rotas da AirLabs, {ago(data.fetchedAt)}.
          </p>
          <ProgramMatches programs={data.programs!} />
          <p className="muted partner-note">Parceria indica que é possível emitir; a disponibilidade de assento-prêmio depende da companhia e da data.</p>
        </>
      )}
      {data && data.status !== "erro" && <UnreviewedNote list={data.unreviewed} />}
    </section>
  );
}
