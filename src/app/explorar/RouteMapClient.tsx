"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { duration } from "@/components/format";
import { RouteGlobe, type GlobePoint } from "@/components/RouteGlobe";
import type { AirportInfo } from "@/core/airportsDb";
import type { RouteMapResult } from "@/core/routes/registry";

const DAY_LABEL: Record<string, string> = { sun: "D", mon: "S", tue: "T", wed: "Q", thu: "Q", fri: "S", sat: "S" };
const WEEK = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const regionNames = typeof Intl !== "undefined" ? new Intl.DisplayNames(["pt-BR"], { type: "region" }) : null;
const country = (code: string) => regionNames?.of(code) ?? code;

type Scope = "todos" | "nacional" | "internacional";

function AirportPicker({ value, onPick }: { value: string; onPick: (iata: string) => void }) {
  const [q, setQ] = useState(value);
  const [options, setOptions] = useState<AirportInfo[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => setQ(value), [value]);
  useEffect(() => {
    if (!open || q.trim().length < 2) {
      setOptions([]);
      return;
    }
    const t = setTimeout(async () => {
      const res = await fetch(`/api/aeroportos?tipo=aeroporto&q=${encodeURIComponent(q)}`);
      if (res.ok) setOptions(await res.json());
    }, 180);
    return () => clearTimeout(t);
  }, [q, open]);

  return (
    <div className="field picker">
      <label htmlFor="map-origin">Aeroporto de partida</label>
      <input
        id="map-origin"
        className="input"
        value={q}
        placeholder="Cidade ou código, ex.: Vitória ou VIX"
        autoComplete="off"
        role="combobox"
        aria-expanded={open && options.length > 0}
        aria-controls="map-origin-list"
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && options[0]) {
            onPick(options[0].iata);
            setOpen(false);
          }
        }}
      />
      {open && options.length > 0 && (
        <ul id="map-origin-list" className="picker-list" role="listbox">
          {options.map((a) => (
            <li key={a.iata} role="option" aria-selected={false}>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { onPick(a.iata); setOpen(false); }}>
                <span className="picker-code">{a.iata}</span>
                <span>
                  {a.city} · <span className="muted">{a.name}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function RouteMapClient() {
  const params = useSearchParams();
  const [origin, setOrigin] = useState((params.get("de") ?? "VIX").toUpperCase());
  const [connections, setConnections] = useState(false);
  const [data, setData] = useState<RouteMapResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [airlineFilter, setAirlineFilter] = useState<Set<string>>(new Set());
  const [scope, setScope] = useState<Scope>("todos");
  const [mode, setMode] = useState<"globo" | "mapa">("globo");

  const load = useCallback(async (iata: string, withConn: boolean) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/rotas?de=${iata}${withConn ? "&conexoes=1" : ""}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Falha ao carregar as rotas");
      setData(body);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao carregar as rotas");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setSelected(null);
    setAirlineFilter(new Set());
    void load(origin, connections);
  }, [origin, connections, load]);

  const inScope = useCallback(
    (a: AirportInfo) => scope === "todos" || (scope === "nacional") === (a.country === data?.origin.country),
    [scope, data],
  );

  const direct = useMemo(
    () =>
      (data?.destinations ?? []).filter(
        (d) => inScope(d.airport) && (airlineFilter.size === 0 || d.airlines.some((a) => airlineFilter.has(a.code))),
      ),
    [data, inScope, airlineFilter],
  );
  const oneStop = useMemo(() => (data?.oneStop ?? []).filter((d) => inScope(d.airport)), [data, inScope]);

  const airlineTotals = useMemo(() => {
    const m = new Map<string, number>();
    for (const d of data?.destinations ?? []) for (const a of d.airlines) m.set(a.code, (m.get(a.code) ?? 0) + a.weekly);
    return [...m].sort((a, b) => b[1] - a[1]);
  }, [data]);

  const sel = direct.find((d) => d.iata === selected) ?? null;
  const selConn = !sel ? oneStop.find((d) => d.iata === selected) ?? null : null;
  const totalWeekly = direct.reduce((s, d) => s + d.weekly, 0);
  const countries = new Set(direct.map((d) => d.airport.country)).size;

  const directPoints: GlobePoint[] = direct.map((d) => ({ iata: d.iata, lat: d.airport.lat, lon: d.airport.lon, weight: d.weekly }));
  const connPoints: GlobePoint[] = oneStop.map((d) => ({ iata: d.iata, lat: d.airport.lat, lon: d.airport.lon, weight: 0, via: d.via[0]?.hub }));
  const hubs = (data?.hubs ?? []).flatMap((h) => {
    const d = data?.destinations.find((x) => x.iata === h);
    return d ? [{ iata: h, lat: d.airport.lat, lon: d.airport.lon }] : [];
  });

  return (
    <div className="map-layout">
      <aside className="card map-panel" aria-label="Filtros do mapa">
        <AirportPicker value={origin} onPick={(iata) => setOrigin(iata)} />

        {data && (
          <div className="map-stats">
            <div>
              <span className="stat num">{direct.length}</span>
              <span className="muted">destinos diretos</span>
            </div>
            <div>
              <span className="stat num">{totalWeekly}</span>
              <span className="muted">voos/semana</span>
            </div>
            <div>
              <span className="stat num">{countries}</span>
              <span className="muted">{countries === 1 ? "país" : "países"}</span>
            </div>
          </div>
        )}

        <fieldset className="segmented">
          <legend className="visually-hidden">Destinos</legend>
          {(["todos", "nacional", "internacional"] as Scope[]).map((s) => (
            <label key={s} className={scope === s ? "is-on" : ""}>
              <input type="radio" name="scope" checked={scope === s} onChange={() => setScope(s)} />
              {s === "todos" ? "Todos" : s === "nacional" ? "Nacionais" : "Internacionais"}
            </label>
          ))}
        </fieldset>

        <label className="check">
          <input type="checkbox" checked={connections} onChange={(e) => setConnections(e.target.checked)} />
          Mostrar destinos com 1 conexão
        </label>

        <fieldset className="segmented">
          <legend className="visually-hidden">Visualização</legend>
          {(["globo", "mapa"] as const).map((m) => (
            <label key={m} className={mode === m ? "is-on" : ""}>
              <input type="radio" name="mode" checked={mode === m} onChange={() => setMode(m)} />
              {m === "globo" ? "Globo" : "Mapa plano"}
            </label>
          ))}
        </fieldset>

        {airlineTotals.length > 0 && (
          <div className="filters">
            <fieldset>
              <legend>Companhias</legend>
              {airlineTotals.map(([code, weekly]) => (
                <label key={code} className="check">
                  <input
                    type="checkbox"
                    checked={airlineFilter.has(code)}
                    onChange={() => {
                      const n = new Set(airlineFilter);
                      if (n.has(code)) n.delete(code);
                      else n.add(code);
                      setAirlineFilter(n);
                    }}
                  />
                  <span>
                    {data?.airlines[code] ?? code} <span className="muted">· {weekly}/sem</span>
                  </span>
                </label>
              ))}
            </fieldset>
          </div>
        )}
      </aside>

      <section className="map-main" aria-busy={loading}>
        {error && (
          <div className="notice notice-warning" role="alert">
            {error}
          </div>
        )}
        {data && (
          <RouteGlobe
            origin={{ iata: data.origin.iata, lat: data.origin.lat, lon: data.origin.lon }}
            direct={directPoints}
            oneStop={connections ? connPoints : []}
            hubs={hubs}
            selected={selected}
            mode={mode}
            onSelect={setSelected}
          />
        )}
        {loading && <p className="muted map-loading">Carregando rotas…</p>}
        {data && (
          <p className="map-legend muted">
            <span className="legend-line" /> voo direto (espessura = frequência)
            {connections && (
              <>
                <span className="legend-line is-connection" /> com 1 conexão via {data.hubs.join(", ") || "—"}
              </>
            )}
            <span className="map-source">
              {data.attribution} · aeroportos: OurAirports · mapa: Natural Earth · estados: IBGE
              {data.partial ? " · dados parciais (limite do plano gratuito)" : ""}
            </span>
          </p>
        )}

        {sel && data && (
          <article className="card dest-card">
            <div className="dest-head">
              <div>
                <span className="eyebrow">
                  {data.origin.iata} → {sel.iata}
                </span>
                <h2>
                  {sel.airport.city}
                  <span className="muted"> · {country(sel.airport.country)}</span>
                </h2>
                <p className="muted">{sel.airport.name}</p>
              </div>
              <div className="row-actions">
                <Link className="btn btn-primary btn-sm" href={`/busca?de=${data.origin.iata}&para=${sel.iata}`}>
                  Ver preços
                </Link>
                <button className="btn btn-ghost btn-sm" type="button" onClick={() => setOrigin(sel.iata)}>
                  Explorar a partir de {sel.iata}
                </button>
              </div>
            </div>
            <div className="result-row">
              <div>
                <span className="label">Voos por semana</span>
                <span className="stat num">{sel.weekly}</span>
              </div>
              <div>
                <span className="label">Duração</span>
                <span className="stat num">{sel.minDurationMin ? duration(sel.minDurationMin) : "—"}</span>
              </div>
              <div>
                <span className="label">Companhias</span>
                <span className="stat num">{sel.airlines.length}</span>
              </div>
            </div>
            <div className="table-wrap" style={{ marginTop: "var(--space-4)" }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Voo</th>
                    <th>Companhia</th>
                    <th>Partida</th>
                    <th>Chegada</th>
                    <th>Dias</th>
                  </tr>
                </thead>
                <tbody>
                  {sel.departures.slice(0, 12).map((f) => (
                    <tr key={`${f.flight}-${f.depTime}-${f.days.join()}`}>
                      <td className="num">{f.flight}</td>
                      <td>{data.airlines[f.airline] ?? f.airline}</td>
                      <td className="num">{f.depTime}</td>
                      <td className="num">{f.arrTime}</td>
                      <td>
                        <span className="days">
                          {WEEK.map((d) => (
                            <span key={d} className={f.days.includes(d) ? "on" : ""} aria-hidden="true">
                              {DAY_LABEL[d]}
                            </span>
                          ))}
                          <span className="visually-hidden">{f.days.length} dias por semana</span>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
        )}

        {selConn && data && (
          <article className="card dest-card">
            <div className="dest-head">
              <div>
                <span className="eyebrow">
                  {data.origin.iata} → {selConn.via.map((v) => v.hub).join(" ou ")} → {selConn.iata}
                </span>
                <h2>
                  {selConn.airport.city}
                  <span className="muted"> · {country(selConn.airport.country)}</span>
                </h2>
                <p className="muted">
                  Sem voo direto. Com uma conexão em {selConn.via.map((v) => v.hub).join(" ou ")}
                  {selConn.minFlyingMin ? `, cerca de ${duration(selConn.minFlyingMin)} de voo, sem contar a espera.` : "."}
                </p>
              </div>
              <Link className="btn btn-primary btn-sm" href={`/busca?de=${data.origin.iata}&para=${selConn.iata}`}>
                Ver preços
              </Link>
            </div>
          </article>
        )}

        {data && (
          <div className="card">
            <h3>Destinos diretos</h3>
            <div className="dest-list">
              {direct.map((d) => (
                <button key={d.iata} type="button" className={`dest-row ${selected === d.iata ? "is-on" : ""}`} onClick={() => setSelected(d.iata)}>
                  <span className="picker-code">{d.iata}</span>
                  <span className="dest-name">
                    {d.airport.city} <span className="muted">· {country(d.airport.country)}</span>
                  </span>
                  <span className="num muted">{d.weekly}/sem</span>
                  <span className="dest-bar" style={{ width: `${(d.weekly / (direct[0]?.weekly || 1)) * 100}%` }} aria-hidden="true" />
                </button>
              ))}
              {direct.length === 0 && <p className="muted">Nenhum destino com esses filtros.</p>}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
