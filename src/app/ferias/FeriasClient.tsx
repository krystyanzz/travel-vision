"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RoutePair } from "@/components/AirportInput";
import { shortLabel } from "@/components/DatePicker";
import { ago } from "@/components/FareBadges";
import { brl } from "@/components/format";
import { rememberOrigin, useHomeAirport } from "@/components/useHomeAirport";
import type { FlexDay, FlexMonth, FlexResult, FlexWindow } from "@/core/flex/engine";
import { airlineName } from "@/core/partners/partners";

// Férias flexíveis: o usuário diz destino, meses possíveis e duração; a tela mostra a
// melhor janela de cada mês, as 5 melhores do período e o mapa de calor dos dias.
// Só preços reais: mês sem preço aparece vazio, com a opção de consultar.

interface Form {
  origin: string;
  destination: string;
  fromMonth: string;
  toMonth: string;
  minDays: number;
  maxDays: number;
  directOnly: boolean;
  maxPrice: string;
  weekdays: number[];
}

type Result = FlexResult & { onDemand: boolean };

const SOURCE: Record<string, string> = {
  "serpapi-explore": "Google (melhor janela)",
  "serpapi-google": "Google Flights",
  travelpayouts: "Aviasales",
};
const WEEK = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const DURATIONS: { label: string; min: number; max: number }[] = [
  { label: "Fim de semana", min: 2, max: 4 },
  { label: "1 semana", min: 6, max: 9 },
  { label: "2 semanas", min: 13, max: 16 },
  { label: "2 a 3 semanas", min: 14, max: 21 },
  { label: "3 semanas", min: 20, max: 23 },
  { label: "1 mês", min: 28, max: 31 },
];

function monthAdd(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}
const thisMonth = () => new Date().toISOString().slice(0, 7);
const monthName = (m: string, style: "short" | "long" = "short") => {
  const t = new Date(`${m}-15T12:00:00`).toLocaleDateString("pt-BR", { month: style, year: "numeric" }).replace(/\./g, "").replace(" de ", "/");
  return t.charAt(0).toUpperCase() + t.slice(1);
};
const monthShort = (m: string) => {
  const t = new Date(`${m}-15T12:00:00`).toLocaleDateString("pt-BR", { month: "short" }).replace(/\./g, "");
  return t.charAt(0).toUpperCase() + t.slice(1);
};

/** "LA" → LATAM; "LA/AF" → LATAM e Air France; "multi" → várias companhias. */
function carriers(code: string | null): string {
  if (!code) return "Companhia não informada";
  if (code.toLowerCase() === "multi") return "Várias companhias";
  return code.split("/").map((c) => airlineName(c)).join(" e ");
}
const sourcesLabel = (ids: string[]) => [...new Set(ids.map((s) => SOURCE[s] ?? s))].join(" + ");

function formFromParams(p: URLSearchParams): Form {
  const from = p.get("de_mes") ?? monthAdd(thisMonth(), 1);
  return {
    origin: p.get("de") ?? "",
    destination: p.get("para") ?? "",
    fromMonth: from,
    toMonth: p.get("ate_mes") ?? monthAdd(from, 5),
    minDays: Number(p.get("min") ?? 14),
    maxDays: Number(p.get("max") ?? 21),
    directOnly: p.get("direto") === "1",
    maxPrice: p.get("teto") ?? "",
    weekdays: (p.get("dias") ?? "").split(",").filter(Boolean).map(Number),
  };
}

function toQuery(f: Form, override: Partial<Form> = {}): string {
  const g = { ...f, ...override };
  const q = new URLSearchParams({ de: g.origin, para: g.destination, de_mes: g.fromMonth, ate_mes: g.toMonth, min: String(g.minDays), max: String(g.maxDays) });
  if (g.directOnly) q.set("direto", "1");
  if (g.maxPrice) q.set("teto", g.maxPrice);
  if (g.weekdays.length) q.set("dias", g.weekdays.join(","));
  return q.toString();
}

export function FeriasClient() {
  const params = useSearchParams();
  const router = useRouter();
  const [form, setForm] = useState<Form>(() => formFromParams(params));
  const [data, setData] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [collecting, setCollecting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null); // mês em destaque
  const tried = useRef(new Set<string>());

  useHomeAirport(!params.get("de"), (code) => setForm((f) => (f.origin ? f : { ...f, origin: code })));

  const fetchResult = useCallback(async (qs: string) => {
    const res = await fetch(`/api/ferias?${qs}`);
    const body = await res.json();
    if (!res.ok) throw new Error(body.error ?? "Falha na busca");
    return body as Result;
  }, []);

  /** Coleta `collectQs` nas fontes e, se trouxe dado, recarrega o resultado de `resultQs` (o período inteiro). */
  const collect = useCallback(
    async (collectQs: string, label: string, resultQs = collectQs) => {
      setCollecting(label);
      try {
        const up = await fetch(`/api/ferias/atualizar?${collectQs}`, { method: "POST" }).then((r) => r.json());
        if (up?.refreshed) setData(await fetchResult(resultQs));
        // "atualizada há poucos minutos" é a proteção contra consultas repetidas, não um problema para o usuário
        const quiet = up?.refreshed || /poucos minutos/.test(up?.message ?? "");
        setCollecting(quiet ? null : (up?.message ?? "As fontes não responderam agora."));
      } catch {
        setCollecting("Não foi possível consultar as fontes agora.");
      }
    },
    [fetchResult],
  );

  const run = useCallback(
    async (f: Form) => {
      const qs = toQuery(f);
      setLoading(true);
      setError(null);
      setSelected(null);
      try {
        const body = await fetchResult(qs);
        setData(body);
        // mostra o que já existe e consulta as fontes em segundo plano, uma vez por pesquisa
        if (body.onDemand && !tried.current.has(qs)) {
          tried.current.add(qs);
          void collect(qs, "Buscando os melhores preços do período nas fontes conectadas… (até 40 s)");
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Falha na busca");
        setData(null);
      } finally {
        setLoading(false);
      }
    },
    [collect, fetchResult],
  );

  useEffect(() => {
    if (params.get("de") && params.get("para")) void run(form);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!/^[A-Z]{3}$/.test(form.origin) || !/^[A-Z]{3}$/.test(form.destination)) {
      setError("Escolha a origem e o destino.");
      return;
    }
    rememberOrigin(form.origin);
    router.replace(`/ferias?${toQuery(form)}`, { scroll: false });
    void run(form);
  }

  function queryMonth(month: string) {
    void collect(toQuery(form, { fromMonth: month, toMonth: month }), `Consultando ${monthName(month, "long")}…`, toQuery(form));
  }

  const months = useMemo(() => Array.from({ length: 13 }, (_, i) => monthAdd(thisMonth(), i)), []);
  const best = data?.windows[0] ?? null;
  const selectedMonth = data?.months.find((m) => m.month === selected) ?? null;

  return (
    <>
      <form className="card flex-form" onSubmit={submit}>
        <RoutePair idPrefix="ferias" origin={form.origin} destination={form.destination} onChange={(v) => setForm({ ...form, ...v })} />

        <fieldset className="flex-field">
          <legend>Quando você pode viajar</legend>
          <div className="flex-months">
            <label>
              De
              <select className="select" value={form.fromMonth} onChange={(e) => setForm({ ...form, fromMonth: e.target.value, toMonth: form.toMonth < e.target.value ? e.target.value : form.toMonth })}>
                {months.map((m) => (
                  <option key={m} value={m}>
                    {monthName(m, "long")}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Até
              <select className="select" value={form.toMonth} onChange={(e) => setForm({ ...form, toMonth: e.target.value })}>
                {months.filter((m) => m >= form.fromMonth && m <= monthAdd(form.fromMonth, 11)).map((m) => (
                  <option key={m} value={m}>
                    {monthName(m, "long")}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="chip-row">
            {[3, 6, 12].map((n) => (
              <button key={n} type="button" className="chip" onClick={() => setForm({ ...form, fromMonth: monthAdd(thisMonth(), 1), toMonth: monthAdd(thisMonth(), n) })}>
                Próximos {n} meses
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="flex-field">
          <legend>
            Quanto tempo fica lá: <strong>{form.minDays === form.maxDays ? `${form.minDays} dias` : `${form.minDays} a ${form.maxDays} dias`}</strong>
          </legend>
          <div className="chip-row">
            {DURATIONS.map((d) => (
              <button
                key={d.label}
                type="button"
                className={`chip ${form.minDays === d.min && form.maxDays === d.max ? "is-on" : ""}`}
                aria-pressed={form.minDays === d.min && form.maxDays === d.max}
                onClick={() => setForm({ ...form, minDays: d.min, maxDays: d.max })}
              >
                {d.label}
              </button>
            ))}
          </div>
          <div className="flex-range">
            <label>
              Mínimo
              <input type="range" min={1} max={45} value={form.minDays} onChange={(e) => {
                const v = Number(e.target.value);
                setForm({ ...form, minDays: v, maxDays: Math.max(v, form.maxDays) });
              }} />
            </label>
            <label>
              Máximo
              <input type="range" min={1} max={45} value={form.maxDays} onChange={(e) => {
                const v = Number(e.target.value);
                setForm({ ...form, maxDays: v, minDays: Math.min(v, form.minDays) });
              }} />
            </label>
          </div>
        </fieldset>

        <details className="flex-more">
          <summary>Mais opções</summary>
          <div className="flex-more-body">
            <label className="check">
              <input type="checkbox" checked={form.directOnly} onChange={(e) => setForm({ ...form, directOnly: e.target.checked })} />
              Só voos diretos
            </label>
            <label className="flex-teto">
              Pagar no máximo (R$, ida e volta)
              <input className="input" inputMode="numeric" placeholder="sem limite" value={form.maxPrice} onChange={(e) => setForm({ ...form, maxPrice: e.target.value.replace(/\D/g, "") })} />
            </label>
            <div>
              <span className="flex-label">Sair só em</span>
              <div className="chip-row">
                {WEEK.map((w, i) => (
                  <button key={w} type="button" className={`chip ${form.weekdays.includes(i) ? "is-on" : ""}`} aria-pressed={form.weekdays.includes(i)}
                    onClick={() => setForm({ ...form, weekdays: form.weekdays.includes(i) ? form.weekdays.filter((x) => x !== i) : [...form.weekdays, i].sort() })}>
                    {w}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </details>

        <button className="btn btn-primary flex-submit" type="submit" disabled={loading}>
          {loading ? "Buscando…" : "Ver as datas mais baratas"}
        </button>
      </form>

      {error && (
        <div className="notice notice-warning" role="alert" style={{ marginTop: "var(--space-4)" }}>
          {error}
        </div>
      )}

      {data && (
        <div className="flex-results">
          {collecting && (
            <p className="muted refresh-status" role="status">
              {collecting.endsWith("…") || collecting.endsWith("s)") ? <span className="live-dot" aria-hidden /> : null} {collecting}
            </p>
          )}

          <BestWindow best={best} data={data} />

          <section className="card flex-chart-card" aria-label="Melhor janela de cada mês">
            <div className="flex-section-head">
              <h2>Melhor janela de cada mês</h2>
              <span className="muted">
                Ida e volta por adulto, {data.query.minDays === data.query.maxDays ? `${data.query.minDays} dias` : `${data.query.minDays} a ${data.query.maxDays} dias`}
              </span>
            </div>
            <MonthChart months={data.months} selected={selected} onSelect={(m) => setSelected(m === selected ? null : m)} onQuery={queryMonth} busy={!!collecting?.endsWith("…")} />
            {selectedMonth?.best && <WindowRow w={selectedMonth.best} q={data.query} highlight label={`Melhor de ${monthName(selectedMonth.month, "long")}`} />}
          </section>

          {data.windows.length > 0 && (
            <section className="card" aria-label="As 5 melhores janelas">
              <div className="flex-section-head">
                <h2>As {data.windows.length} melhores janelas do período</h2>
              </div>
              <ol className="flex-top">
                {data.windows.map((w, i) => (
                  <li key={`${w.departDate}-${w.returnDate}`}>
                    <WindowRow w={w} q={data.query} rank={i + 1} />
                  </li>
                ))}
              </ol>
            </section>
          )}

          <section className="card" aria-label="Mapa de preços por dia de saída">
            <div className="flex-section-head">
              <h2>Por dia de saída</h2>
              <span className="muted">
                {Math.round(data.coverage * 100)}% dos dias do período têm preço real{data.coverage < 0.3 ? ": o Google entrega a melhor janela de cada mês, não todos os dias" : ""}
              </span>
            </div>
            <Heatmap days={data.days} months={data.months} selected={selected} />
          </section>
        </div>
      )}
    </>
  );
}

function BestWindow({ best, data }: { best: FlexWindow | null; data: Result }) {
  if (!best) {
    return (
      <div className="card empty-state">
        <p>Ainda não encontramos preço real para essa viagem no período.</p>
        <p className="muted">
          {data.onDemand ? "As fontes estão sendo consultadas; os meses sem preço podem ser consultados um a um no gráfico abaixo." : "Nenhuma fonte de preço está conectada agora."}
        </p>
      </div>
    );
  }
  return (
    <section className="card flex-best" aria-label="Melhor janela do período">
      <div>
        <span className="eyebrow">Melhor janela do período</span>
        <h2>
          {shortLabel(best.departDate)} → {shortLabel(best.returnDate)} <span className="muted">· {best.days} dias</span>
        </h2>
        <p className="muted">
          {carriers(best.carrier)} · {best.stops === 0 ? "direto" : best.stops != null ? `até ${best.stops} escala${best.stops > 1 ? "s" : ""}` : "escalas não informadas"} ·{" "}
          {best.ticket === "ida_e_volta" ? "bilhete único de ida e volta" : "2 bilhetes só de ida"}
        </p>
        <p className="muted flex-source">
          {sourcesLabel(best.sources)} · consultado {ago(best.observedAt)} · preço encontrado, disponibilidade não confirmada
        </p>
      </div>
      <div className="flex-best-price">
        <span className="price">{brl(best.totalBrl)}</span>
        <span className="muted">ida e volta, por adulto</span>
        <Link className="btn btn-primary" href={`/busca?de=${data.query.origin}&para=${data.query.destination}&ida=${best.departDate}&volta=${best.returnDate}`}>
          Ver voos e preço de agora
        </Link>
      </div>
    </section>
  );
}

function WindowRow({ w, q, rank, highlight, label }: { w: FlexWindow; q: FlexResult["query"]; rank?: number; highlight?: boolean; label?: string }) {
  return (
    <div className={`flex-window ${highlight ? "is-highlight" : ""}`}>
      {rank && <span className="flex-rank">{rank}</span>}
      <div className="flex-window-main">
        {label && <span className="flex-window-label">{label}</span>}
        <strong>
          {shortLabel(w.departDate)} → {shortLabel(w.returnDate)}
        </strong>
        <span className="muted">
          {w.days} dias · {carriers(w.carrier)} · {w.ticket === "ida_e_volta" ? "bilhete único" : "2 bilhetes"} · {sourcesLabel(w.sources)}, {ago(w.observedAt)}
        </span>
      </div>
      <span className="flex-window-price">{brl(w.totalBrl)}</span>
      <Link className="btn btn-ghost btn-sm" href={`/busca?de=${q.origin}&para=${q.destination}&ida=${w.departDate}&volta=${w.returnDate}`}>
        Ver voos
      </Link>
    </div>
  );
}

function MonthChart(p: { months: FlexMonth[]; selected: string | null; onSelect: (m: string) => void; onQuery: (m: string) => void; busy: boolean }) {
  const prices = p.months.filter((m) => m.best).map((m) => m.best!.totalBrl);
  const max = Math.max(...prices, 1);
  const min = Math.min(...prices);
  return (
    <div className="month-chart" role="list">
      {p.months.map((m) => {
        const price = m.best?.totalBrl ?? null;
        const cheapest = price !== null && price === min;
        return (
          <div key={m.month} role="listitem" className={`month-col ${p.selected === m.month ? "is-selected" : ""}`}>
            <div className="month-plot">
              {price !== null ? (
                <button
                  type="button"
                  className={`month-bar ${cheapest ? "is-cheapest" : ""}`}
                  style={{ height: `${Math.max(8, (price / max) * 100)}%` }}
                  onClick={() => p.onSelect(m.month)}
                  aria-label={`${monthName(m.month, "long")}: a partir de ${brl(price)}, saindo em ${shortLabel(m.best!.departDate)}`}
                  title={`${monthName(m.month, "long")}: ${brl(price)} · ${shortLabel(m.best!.departDate)} → ${shortLabel(m.best!.returnDate)} (${m.best!.days} dias)`}
                >
                  {cheapest && <span className="month-bar-label">{brl(price)}</span>}
                </button>
              ) : m.status === "ainda_nao_a_venda" ? (
                <span className="month-empty is-not-on-sale" title="As companhias ainda não abriram as vendas para este mês">
                  ainda não à venda
                </span>
              ) : (
                <span className="month-empty">
                  sem preço
                  {m.status === "sem_dado" && (
                    <button type="button" className="month-query" onClick={() => p.onQuery(m.month)} disabled={p.busy} aria-label={`Consultar preços de ${monthName(m.month, "long")}`}>
                      Consultar
                    </button>
                  )}
                </span>
              )}
            </div>
            <span className="month-label">{monthShort(m.month)}</span>
            <span className="month-price">{price !== null ? brl(price) : "—"}</span>
          </div>
        );
      })}
    </div>
  );
}

function heatSummary(month: string, md: FlexDay[]): string {
  const priced = md.filter((d) => d.best);
  const name = monthName(month, "long");
  if (!priced.length) {
    const notOnSale = md.some((d) => d.status === "ainda_nao_a_venda");
    return `${name}: nenhum dia com preço${notOnSale ? " (ainda não à venda)" : ""}`;
  }
  const best = priced.reduce((a, b) => (b.best!.totalBrl < a.best!.totalBrl ? b : a));
  return `${name}: ${priced.length} de ${md.length} dias com preço; mais barato saindo ${shortLabel(best.date)}, ${brl(best.best!.totalBrl)}`;
}

/** Um quadrado por dia de saída; intensidade pelo preço (mais forte = mais barato). */
function Heatmap({ days, months, selected }: { days: FlexDay[]; months: FlexMonth[]; selected: string | null }) {
  const prices = days.filter((d) => d.best).map((d) => d.best!.totalBrl).sort((a, b) => a - b);
  const q = (f: number) => prices[Math.min(prices.length - 1, Math.floor(prices.length * f))];
  const level = (v: number) => (prices.length < 4 ? 3 : v <= q(0.25) ? 4 : v <= q(0.5) ? 3 : v <= q(0.75) ? 2 : 1);
  return (
    <div className="heatmap">
      {months.map((m) => {
        const md = days.filter((d) => d.date.startsWith(m.month));
        const offset = new Date(`${m.month}-01T12:00:00`).getDay();
        return (
          <div key={m.month} className={`heat-month ${selected === m.month ? "is-selected" : ""}`}>
            <span className="heat-title" aria-hidden>{monthShort(m.month)}</span>
            {/* para leitor de tela: um resumo do mês em vez de 30 quadrados soltos */}
            <div className="heat-grid" role="img" aria-label={heatSummary(m.month, md)}>
              {Array.from({ length: offset }, (_, i) => (
                <span key={`e${i}`} />
              ))}
              {md.map((d) => (
                <span
                  key={d.date}
                  className={`heat-day ${d.best ? `lv${level(d.best.totalBrl)}` : `is-${d.status}`}`}
                  title={
                    d.best
                      ? `Sai ${shortLabel(d.date)} → volta ${shortLabel(d.best.returnDate)} (${d.best.days} dias): ${brl(d.best.totalBrl)}`
                      : `${shortLabel(d.date)}: ${d.status === "ainda_nao_a_venda" ? "ainda não à venda" : d.status === "passado" ? "já passou" : d.status === "fora_do_filtro" ? "fora dos dias escolhidos" : "sem preço"}`
                  }
                />
              ))}
            </div>
          </div>
        );
      })}
      <div className="heat-legend" aria-hidden>
        <span>mais barato</span>
        <i className="heat-day lv4" />
        <i className="heat-day lv3" />
        <i className="heat-day lv2" />
        <i className="heat-day lv1" />
        <span>mais caro</span>
        <i className="heat-day is-sem_dado" />
        <span>sem preço</span>
        <i className="heat-day is-ainda_nao_a_venda" />
        <span>ainda não à venda</span>
      </div>
    </div>
  );
}
