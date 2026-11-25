"use client";

import { useEffect, useMemo, useRef, useState } from "react";

// Escolha de datas por clique: ida e, se houver, volta, num calendário de dois
// meses (um no celular), com o menor preço real de cada dia quando já coletado.

interface Props {
  departDate: string;
  returnDate: string;
  roundTrip: boolean;
  origin: string;
  destination: string;
  onChange: (v: { departDate: string; returnDate: string }) => void;
}

const WEEK = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const IATA = /^[A-Z]{3}$/;

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const parse = (s: string) => new Date(`${s}T12:00:00`);
const todayIso = () => iso(new Date());
const shiftMonth = (month: string, n: number) => {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};
export const addDaysIso = (s: string, n: number) => {
  const d = parse(s);
  d.setDate(d.getDate() + n);
  return iso(d);
};
/** "Seg, 21 dez": curto para caber no botão. */
export const shortLabel = (s: string) => {
  if (!s) return "";
  const d = parse(s);
  const wd = d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(/\./g, "");
  const mo = d.toLocaleDateString("pt-BR", { month: "short" }).replace(/\./g, "");
  return `${wd.charAt(0).toUpperCase()}${wd.slice(1)}, ${d.getDate()} ${mo}`;
};
const monthLabel = (month: string) => {
  const t = parse(`${month}-15`).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return t.charAt(0).toUpperCase() + t.slice(1);
};
const compact = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1).replace(".", ",")} mil` : String(Math.round(n)));

function useIsNarrow() {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mq = matchMedia("(max-width: 719px)");
    const set = () => setNarrow(mq.matches);
    set();
    mq.addEventListener("change", set);
    return () => mq.removeEventListener("change", set);
  }, []);
  return narrow;
}

export function DateRangeField(p: Props) {
  const [open, setOpen] = useState<null | "ida" | "volta">(null);
  const [hover, setHover] = useState<string | null>(null);
  const [view, setView] = useState((p.departDate || todayIso()).slice(0, 7));
  const [prices, setPrices] = useState<{ ida: Record<string, number>; volta: Record<string, number> }>({ ida: {}, volta: {} });
  const ref = useRef<HTMLDivElement>(null);
  const idaRef = useRef<HTMLButtonElement>(null);
  const voltaRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const focusDay = useRef<string | null>(null);
  const narrow = useIsNarrow();
  const months = narrow ? [view] : [view, shiftMonth(view, 1)];
  const today = todayIso();
  const minMonth = today.slice(0, 7);

  // fecha e devolve o foco ao botão da data (teclado e leitor de tela não ficam "perdidos")
  const returnTo = useRef<"ida" | "volta" | null>(null);
  function close(which: "ida" | "volta" | null = open) {
    returnTo.current = which;
    setOpen(null);
  }
  useEffect(() => {
    if (open || !returnTo.current) return;
    (returnTo.current === "volta" ? voltaRef : idaRef).current?.focus();
    returnTo.current = null;
  }, [open]);

  // fecha ao clicar fora ou com Esc
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      close(open);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Preços reais por dia dos meses visíveis. Busca assim que origem e destino estão
  // escolhidos (antes mesmo de abrir o calendário); se a rota ainda não tem preço
  // nesses meses, pede às fontes na hora, uma vez por rota e meses.
  const monthsKey = months.join(",");
  const [loadingPrices, setLoadingPrices] = useState(false);
  const asked = useRef(new Set<string>());
  useEffect(() => {
    if (!IATA.test(p.origin) || !IATA.test(p.destination) || p.origin === p.destination) {
      setPrices({ ida: {}, volta: {} });
      return;
    }
    let alive = true;
    const base = `/api/calendario?de=${p.origin}&para=${p.destination}&meses=${monthsKey}`;
    const t = setTimeout(async () => {
      try {
        const first = await fetch(base).then((r) => (r.ok ? r.json() : null));
        if (!alive || !first) return;
        setPrices(first);
        const key = `${p.origin}-${p.destination}|${monthsKey}`;
        const empty = !Object.keys(first.ida).length || (p.roundTrip && !Object.keys(first.volta).length);
        if (!empty || asked.current.has(key)) return;
        asked.current.add(key);
        setLoadingPrices(true);
        const fresh = await fetch(`${base}&atualizar=1`).then((r) => (r.ok ? r.json() : null));
        if (alive && fresh) setPrices(fresh);
      } catch {
        // sem preço no calendário: a escolha de datas continua funcionando
      } finally {
        if (alive) setLoadingPrices(false);
      }
    }, 400);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [monthsKey, p.origin, p.destination, p.roundTrip]);

  const dayMap = open === "volta" ? prices.volta : prices.ida;
  const cheapCut = useMemo(() => {
    const v = Object.values(dayMap).sort((a, b) => a - b);
    return v.length >= 4 ? v[Math.floor(v.length * 0.25)] : null;
  }, [dayMap]);

  function openAt(which: "ida" | "volta") {
    const day = (which === "volta" && p.returnDate) || p.departDate || "";
    setView((day || today).slice(0, 7));
    focusDay.current = day || null;
    setOpen(which);
  }

  // ao abrir, trocar de mês ou navegar com as setas: foco no dia certo
  useEffect(() => {
    if (!open) return;
    const pop = popRef.current;
    if (!pop) return;
    const want = focusDay.current;
    focusDay.current = null;
    const byDate = want ? pop.querySelector<HTMLButtonElement>(`.date-day[data-date="${want}"]:not(:disabled)`) : null;
    if (byDate) return byDate.focus();
    if (pop.contains(document.activeElement)) return; // trocou de mês pelos botões ‹ ›: o foco fica onde está
    pop.querySelector<HTMLButtonElement>(".date-day[tabindex='0']:not(:disabled)")?.focus();
  }, [open, view]);

  // setas: ±1 dia; ↑↓: ±1 semana; Home/End: início/fim da semana; PageUp/PageDown: ±1 mês
  function onGridKey(e: React.KeyboardEvent<HTMLDivElement>) {
    const cur = (e.target as HTMLElement).dataset?.date;
    if (!cur) return;
    const dow = parse(cur).getDay();
    const step: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7, Home: -dow, End: 6 - dow };
    let next: string;
    if (e.key in step) next = addDaysIso(cur, step[e.key]);
    else if (e.key === "PageUp" || e.key === "PageDown") {
      const d = parse(cur);
      d.setMonth(d.getMonth() + (e.key === "PageUp" ? -1 : 1));
      next = iso(d);
    } else return;
    e.preventDefault();
    const min = open === "volta" && p.departDate ? p.departDate : today;
    if (next < min) next = min;
    const m = next.slice(0, 7);
    if (months.includes(m)) {
      popRef.current?.querySelector<HTMLButtonElement>(`.date-day[data-date="${next}"]`)?.focus();
    } else {
      focusDay.current = next;
      setView(m < view || narrow ? m : shiftMonth(m, -1));
    }
  }

  function pick(day: string) {
    if (open === "ida" || !p.roundTrip) {
      // nova ida: se passar da volta, a volta é escolhida de novo
      const ret = p.roundTrip && p.returnDate && p.returnDate >= day ? p.returnDate : "";
      p.onChange({ departDate: day, returnDate: ret });
      if (p.roundTrip) {
        focusDay.current = day;
        setOpen("volta");
      } else close("ida");
      return;
    }
    if (day < p.departDate) {
      p.onChange({ departDate: day, returnDate: "" });
      return;
    }
    p.onChange({ departDate: p.departDate, returnDate: day });
    close("volta");
  }

  // um único dia entra na ordem do Tab (o selecionado ou o primeiro disponível)
  const visibleMin = open === "volta" && p.departDate ? p.departDate : today;
  const selected = open === "volta" ? p.returnDate || p.departDate : p.departDate;
  const tabDay = selected && selected >= visibleMin && months.includes(selected.slice(0, 7)) ? selected : visibleMin.slice(0, 7) >= months[0] ? visibleMin : `${months[0]}-01`;

  const rangeEnd = open === "volta" && hover && hover >= p.departDate ? hover : p.returnDate;

  return (
    <div className={`date-field ${p.roundTrip ? "" : "is-oneway"}`} ref={ref}>
      <div className="date-buttons">
        <DateButton buttonRef={idaRef} label="Ida" value={p.departDate} active={open === "ida"} onClick={() => openAt("ida")} onStep={(n) => {
          if (!p.departDate) return;
          const d = addDaysIso(p.departDate, n);
          if (d < today) return;
          p.onChange({ departDate: d, returnDate: p.returnDate && p.returnDate < d ? "" : p.returnDate });
        }} />
        {p.roundTrip && (
          <DateButton buttonRef={voltaRef} label="Volta" value={p.returnDate} active={open === "volta"} onClick={() => openAt(p.departDate ? "volta" : "ida")} onStep={(n) => {
            if (!p.returnDate) return;
            const d = addDaysIso(p.returnDate, n);
            if (d < p.departDate) return;
            p.onChange({ departDate: p.departDate, returnDate: d });
          }} />
        )}
      </div>

      {open && (
        <div className="date-pop" ref={popRef} role="dialog" aria-label={open === "ida" ? "Escolha a data de ida" : "Escolha a data de volta"}>
          <div className="date-pop-head">
            <button type="button" className="date-nav" aria-label="Mês anterior" disabled={view <= minMonth} onClick={() => setView(shiftMonth(view, -1))}>
              ‹
            </button>
            <strong>{open === "ida" ? "Quando você vai?" : "Quando você volta?"}</strong>
            <button type="button" className="date-nav" aria-label="Próximo mês" onClick={() => setView(shiftMonth(view, 1))}>
              ›
            </button>
          </div>
          <div className="date-months" onKeyDown={onGridKey}>
            {months.map((m) => (
              <MonthGrid
                key={m}
                month={m}
                today={today}
                minDay={open === "volta" && p.departDate ? p.departDate : today}
                start={p.departDate}
                end={p.roundTrip ? rangeEnd : ""}
                prices={dayMap}
                cheapCut={cheapCut}
                onPick={pick}
                onHover={setHover}
                focusable={tabDay}
              />
            ))}
          </div>
          <div className="date-pop-foot">
            <span className="muted date-pop-note">
              {loadingPrices ? (
                <>
                  <span className="live-dot" aria-hidden /> Buscando os preços destes meses…
                </>
              ) : !IATA.test(p.origin) || !IATA.test(p.destination) ? (
                "Escolha origem e destino para ver o preço de cada dia"
              ) : Object.keys(dayMap).length ? (
                "Valores: menor preço real só de ida encontrado no dia"
              ) : (
                "Nenhum preço encontrado nestes meses"
              )}
            </span>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => close()}>
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function DateButton(p: { buttonRef: React.Ref<HTMLButtonElement>; label: string; value: string; active: boolean; onClick: () => void; onStep: (n: number) => void }) {
  return (
    <div className={`date-button ${p.active ? "is-active" : ""} ${p.value ? "" : "is-empty"}`}>
      <button type="button" ref={p.buttonRef} className="date-main" onClick={p.onClick} aria-haspopup="dialog" aria-expanded={p.active} aria-label={p.value ? `${p.label}: ${shortLabel(p.value)}` : `Escolher data de ${p.label.toLowerCase()}`}>
        {/* vazio: só a palavra (Ida / Volta), como convite para escolher */}
        {p.value ? (
          <>
            <span className="date-label">{p.label}</span>
            <span className="date-value">{shortLabel(p.value)}</span>
          </>
        ) : (
          <span className="date-value is-empty">{p.label}</span>
        )}
      </button>
      {p.value && (
        <span className="date-steps">
          <button type="button" aria-label={`${p.label}: dia anterior`} onClick={() => p.onStep(-1)}>
            ‹
          </button>
          <button type="button" aria-label={`${p.label}: dia seguinte`} onClick={() => p.onStep(1)}>
            ›
          </button>
        </span>
      )}
    </div>
  );
}

function MonthGrid(p: {
  month: string;
  today: string;
  minDay: string;
  start: string;
  end: string;
  prices: Record<string, number>;
  cheapCut: number | null;
  onPick: (d: string) => void;
  onHover: (d: string | null) => void;
  /** dia que recebe Tab; os outros são alcançados pelas setas */
  focusable: string;
}) {
  const [y, m] = p.month.split("-").map(Number);
  const first = new Date(y, m - 1, 1).getDay();
  const count = new Date(y, m, 0).getDate();
  const cells: (string | null)[] = [...Array(first).fill(null), ...Array.from({ length: count }, (_, i) => `${p.month}-${String(i + 1).padStart(2, "0")}`)];
  return (
    <div className="date-month" onMouseLeave={() => p.onHover(null)}>
      <div className="date-month-title">{monthLabel(p.month)}</div>
      <div className="date-grid" role="grid">
        {WEEK.map((w) => (
          <span key={w} className="date-dow">
            {w}
          </span>
        ))}
        {cells.map((d, i) => {
          if (!d) return <span key={`e${i}`} />;
          const disabled = d < p.minDay;
          const isStart = d === p.start;
          const isEnd = !!p.end && d === p.end;
          const inRange = !!p.end && d > p.start && d < p.end;
          const price = p.prices[d];
          const cheap = price != null && p.cheapCut != null && price <= p.cheapCut;
          return (
            <button
              key={d}
              type="button"
              data-date={d}
              tabIndex={d === p.focusable ? 0 : -1}
              className={`date-day ${isStart || isEnd ? "is-selected" : ""} ${inRange ? "is-range" : ""} ${d === p.today ? "is-today" : ""}`}
              disabled={disabled}
              onClick={() => p.onPick(d)}
              onMouseEnter={() => p.onHover(d)}
              aria-label={`${parse(d).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}${price != null ? `, a partir de R$ ${Math.round(price)}` : ""}`}
              aria-pressed={isStart || isEnd}
            >
              <span className="date-num">{Number(d.slice(8))}</span>
              {price != null && !disabled && <span className={`date-price ${cheap ? "is-cheap" : ""}`}>{compact(price)}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
