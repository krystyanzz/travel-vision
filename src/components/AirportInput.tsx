"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { Place } from "@/core/airportsDb";

// Campo de origem/destino próprio (combobox ARIA): mostra "Cidade (CÓD)",
// sugere cidades com todos os aeroportos e os 4 mil aeroportos da base, com
// país e destaque do trecho digitado. O valor do formulário é sempre o código.

const POPULAR: Place[] = [
  { code: "SAO", kind: "city", city: "São Paulo", detail: "Todos os aeroportos (GRU, CGH, VCP)", country: "BR" },
  { code: "RIO", kind: "city", city: "Rio de Janeiro", detail: "Todos os aeroportos (GIG, SDU)", country: "BR" },
  { code: "BSB", kind: "airport", city: "Brasília", detail: "Aeroporto Internacional de Brasília", country: "BR" },
  { code: "LIS", kind: "airport", city: "Lisboa", detail: "Aeroporto Humberto Delgado", country: "PT" },
  { code: "MCO", kind: "airport", city: "Orlando", detail: "Orlando International Airport", country: "US" },
  { code: "SCL", kind: "airport", city: "Santiago", detail: "Aeroporto Arturo Merino Benítez", country: "CL" },
];

const known = new Map<string, Place>(POPULAR.map((p) => [p.code, p]));

let regionNames: Intl.DisplayNames | null = null;
function countryName(iso: string): string {
  try {
    regionNames ??= new Intl.DisplayNames(["pt-BR"], { type: "region" });
    return regionNames.of(iso) ?? iso;
  } catch {
    return iso;
  }
}

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Destaca o trecho que casa com a busca (sem acento e sem caixa). */
function Highlight({ text, query }: { text: string; query: string }) {
  const q = norm(query.trim());
  const i = q ? norm(text).indexOf(q) : -1;
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <mark>{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length)}
    </>
  );
}

function PlaceIcon({ kind }: { kind: Place["kind"] | "explore" }) {
  if (kind === "explore") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden>
        <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path d="M15.5 8.5 13.4 13.4 8.5 15.5 10.6 10.6Z" fill="currentColor" />
      </svg>
    );
  }
  if (kind === "city") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden>
        <path d="M4 20V9l5-3v14M9 20V4l7 3v13M16 20v-9l4 2v7M3 20h18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M21 15.5v-2l-8-5V3.8a1.5 1.5 0 0 0-3 0v4.7l-8 5v2l8-2.5V18l-2 1.5V21l3.5-1 3.5 1v-1.5L13 18v-5Z" fill="currentColor" />
    </svg>
  );
}

const label = (p: Place) => `${p.city} (${p.code})`;

export function AirportInput(props: {
  id: string;
  label: string;
  value: string;
  onChange: (code: string) => void;
  placeholder?: string;
  /** Mostra o atalho "Explorar destinos" no mapa a partir deste aeroporto. */
  exploreFrom?: string;
}) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState<Place | null>(() => known.get(props.value) ?? null);
  const [text, setText] = useState(() => (known.get(props.value) ? label(known.get(props.value)!) : props.value));
  const [dirty, setDirty] = useState(false); // o usuário digitou desde o foco
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<Place[]>([]);
  const [resultsFor, setResultsFor] = useState(""); // texto que gerou as sugestões atuais
  const [active, setActive] = useState(0);
  // Enter apertado antes das sugestões chegarem: escolhe a primeira quando vierem
  const pendingPick = useRef(false);

  // resolve o nome quando o código vem de fora (URL, troca de origem/destino)
  useEffect(() => {
    const code = props.value.toUpperCase();
    if (selected?.code === code) return;
    const hit = known.get(code);
    if (hit) {
      setSelected(hit);
      setText(label(hit));
      return;
    }
    setText(code);
    if (!/^[A-Z]{3}$/.test(code)) return;
    let alive = true;
    fetch(`/api/aeroportos?codigo=${code}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((p: Place | null) => {
        if (!alive || !p) return;
        known.set(p.code, p);
        setSelected(p);
        setText(label(p));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.value]);

  // sugestões conforme digita
  useEffect(() => {
    if (!open || !dirty || text.trim().length < 2) {
      setResults([]);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/aeroportos?q=${encodeURIComponent(text)}`, { signal: ctrl.signal })
        .then((r) => (r.ok ? r.json() : []))
        .then((list: Place[]) => {
          for (const p of list) known.set(p.code, p);
          if (pendingPick.current && list[0]) {
            pendingPick.current = false;
            pick(list[0]);
            return;
          }
          setResults(list);
          setResultsFor(text);
          setActive(0);
        })
        .catch(() => {});
    }, 120);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [text, open, dirty]);

  const showingPopular = !dirty || text.trim().length < 2;
  const options = useMemo(() => (showingPopular ? POPULAR.filter((p) => p.code !== props.exploreFrom) : results), [showingPopular, results, props.exploreFrom]);
  const exploreHref = props.exploreFrom ? `/explorar?de=${props.exploreFrom}` : null;

  function pick(p: Place) {
    known.set(p.code, p);
    setSelected(p);
    setText(label(p));
    setDirty(false);
    setOpen(false);
    props.onChange(p.code);
  }

  function close() {
    pendingPick.current = false;
    setOpen(false);
    setDirty(false);
    // sem escolha: volta ao valor atual (ou aceita um código de 3 letras digitado)
    const typed = text.trim().toUpperCase();
    if (dirty && /^[A-Z]{3}$/.test(typed) && typed !== selected?.code) {
      props.onChange(typed);
      return;
    }
    setText(selected ? label(selected) : props.value);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) setOpen(true);
      const n = options.length;
      if (n) setActive((i) => (e.key === "ArrowDown" ? (i + 1) % n : (i - 1 + n) % n));
    } else if (e.key === "Enter") {
      if (open && options[active] && (showingPopular || resultsFor === text)) {
        e.preventDefault();
        pick(options[active]);
      } else if (open && dirty && text.trim().length >= 2) {
        // ainda buscando: não envia o formulário com texto pela metade
        e.preventDefault();
        pendingPick.current = true;
      }
    } else if (e.key === "Escape") {
      if (open) {
        e.preventDefault();
        close();
      }
    } else if (e.key === "Tab" && open && dirty && options[active] && resultsFor === text) {
      pick(options[active]);
    }
  }

  const expanded = open && (options.length > 0 || !!exploreHref || (dirty && text.trim().length >= 2));

  return (
    <div className="field place-field">
      <label htmlFor={props.id}>{props.label}</label>
      <input
        ref={inputRef}
        id={props.id}
        className="input place-input"
        value={text}
        placeholder={props.placeholder ?? "Cidade, aeroporto ou código"}
        autoComplete="off"
        spellCheck={false}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={expanded}
        aria-controls={listId}
        aria-activedescendant={expanded && options[active] ? `${listId}-${active}` : undefined}
        onFocus={(e) => {
          setOpen(true);
          setActive(0);
          e.currentTarget.select();
        }}
        onBlur={close}
        onChange={(e) => {
          setText(e.target.value);
          setDirty(true);
          setOpen(true);
        }}
        onKeyDown={onKeyDown}
      />
      {/* valor real do formulário: o código */}
      <input type="hidden" name={props.id} value={props.value} />
      {expanded && (
        <div className="place-menu">
          {showingPopular && <div className="place-menu-head">Destinos frequentes</div>}
          <ul id={listId} role="listbox" aria-label={props.label}>
            {options.map((p, i) => (
              <li
                key={p.code}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                className={`place-option ${p.kind === "airport" && i > 0 && options[i - 1].kind === "city" && options[i - 1].airports?.includes(p.code) ? "is-child" : ""} ${i === active ? "is-active" : ""}`}
                // mousedown evita perder o foco antes do clique
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(p);
                }}
                onMouseEnter={() => setActive(i)}
              >
                <span className="place-icon"><PlaceIcon kind={p.kind} /></span>
                <span className="place-text">
                  <span className="place-title">
                    <Highlight text={p.city} query={dirty ? text : ""} /> <span className="place-code">{p.code}</span>
                  </span>
                  <span className="place-detail">
                    {p.kind === "city" ? p.detail : <Highlight text={p.detail} query={dirty ? text : ""} />} · {countryName(p.country)}
                  </span>
                </span>
              </li>
            ))}
            {dirty && text.trim().length >= 2 && options.length === 0 && (
              <li className="place-empty">{resultsFor === text ? `Nenhum aeroporto encontrado para “${text.trim()}”.` : "Buscando…"}</li>
            )}
          </ul>
          {exploreHref && (
            <Link href={exploreHref} className="place-explore" onMouseDown={(e) => e.preventDefault()}>
              <span className="place-icon"><PlaceIcon kind="explore" /></span>
              <span className="place-text">
                <span className="place-title">Explorar destinos a partir de {props.exploreFrom}</span>
                <span className="place-detail">Veja no mapa todos os voos diretos e com uma conexão</span>
              </span>
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

/** Origem e destino lado a lado, com botão para inverter. */
export function RoutePair(props: {
  idPrefix: string;
  origin: string;
  destination: string;
  onChange: (v: { origin: string; destination: string }) => void;
}) {
  const [turned, setTurned] = useState(false);
  return (
    <div className="route-pair">
      <AirportInput id={`${props.idPrefix}-origin`} label="De" value={props.origin} onChange={(origin) => props.onChange({ origin, destination: props.destination })} placeholder="De onde você sai?" />
      <button
        type="button"
        className={`route-swap ${turned ? "is-turned" : ""}`}
        aria-label="Inverter origem e destino"
        title="Inverter origem e destino"
        onClick={() => {
          setTurned((t) => !t);
          props.onChange({ origin: props.destination, destination: props.origin });
        }}
      >
        <svg viewBox="0 0 24 24" aria-hidden>
          <path d="M7 7h12m0 0-3.5-3.5M19 7l-3.5 3.5M17 17H5m0 0 3.5-3.5M5 17l3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <AirportInput
        id={`${props.idPrefix}-dest`}
        label="Para"
        value={props.destination}
        onChange={(destination) => props.onChange({ origin: props.origin, destination })}
        placeholder="Para onde você vai?"
        exploreFrom={/^[A-Z]{3}$/.test(props.origin) ? props.origin : undefined}
      />
    </div>
  );
}
