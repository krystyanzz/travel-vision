"use client";

import type { CalendarDay, PriceLevel } from "@/core/types";

const DOW = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

function compact(n: number): string {
  return n >= 1000 ? `R$ ${(n / 1000).toFixed(1).replace(".", ",")} mil` : `R$ ${n}`;
}

export function PriceCalendar(props: {
  month: string;
  days: CalendarDay[];
  levels: Record<string, PriceLevel>;
  selected: string;
  onSelect: (date: string) => void;
  onMonthChange: (month: string) => void;
}) {
  const [y, m] = props.month.split("-").map(Number);
  const offset = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const today = new Date().toISOString().slice(0, 10);
  const rawLabel = new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });
  const label = rawLabel.charAt(0).toUpperCase() + rawLabel.slice(1);
  const thisMonth = today.slice(0, 7);
  const min = props.days.reduce<number | null>((acc, d) => (d.lowestAmount !== null && d.date >= today && (acc === null || d.lowestAmount < acc) ? d.lowestAmount : acc), null);

  return (
    <section className="card" aria-label="Calendário de preços">
      <div className="calendar-head">
        <div>
          <h3 style={{ margin: 0 }}>{label}</h3>
          <span className="muted" style={{ fontSize: "0.85rem" }}>
            Menor preço só de ida por adulto{min !== null ? ` · a partir de ${compact(min)}` : ""}
          </span>
        </div>
        <div className="row-actions">
          <button className="btn btn-ghost btn-sm" type="button" onClick={() => props.onMonthChange(shiftMonth(props.month, -1))} disabled={props.month <= thisMonth} aria-label="Mês anterior">
            ←
          </button>
          <button className="btn btn-ghost btn-sm" type="button" onClick={() => props.onMonthChange(shiftMonth(props.month, 1))} aria-label="Próximo mês">
            →
          </button>
        </div>
      </div>
      <div className="calendar" role="grid">
        {DOW.map((d) => (
          <div key={d} className="calendar-dow" role="columnheader">
            {d}
          </div>
        ))}
        {Array.from({ length: offset }, (_, i) => (
          <div key={`e${i}`} />
        ))}
        {props.days.map((d) => {
          const lvl = props.levels[d.date];
          const past = d.date < today;
          return (
            <button
              key={d.date}
              type="button"
              className={`cal-day ${lvl ? `lvl-${lvl}` : ""}`}
              aria-pressed={d.date === props.selected}
              disabled={past || d.lowestAmount === null}
              onClick={() => props.onSelect(d.date)}
              aria-label={`${d.date}: ${d.lowestAmount !== null ? `R$ ${d.lowestAmount}, preço ${lvl ?? "normal"}` : "sem dados"}`}
            >
              <span className="cal-num">{Number(d.date.slice(8))}</span>
              <span className="cal-price">{d.lowestAmount !== null && !past ? compact(d.lowestAmount) : "—"}</span>
            </button>
          );
        })}
      </div>
      <div className="legend" style={{ marginTop: "var(--space-3)" }}>
        <span className="badge badge-success">Preço baixo</span>
        <span className="badge">Normal</span>
        <span className="badge badge-danger">Preço alto</span>
      </div>
    </section>
  );
}
