"use client";

import { geoDistance, geoEqualEarth, geoGraticule10, geoOrthographic, geoPath, type GeoProjection } from "d3-geo";
import type { FeatureCollection } from "geojson";
import { useEffect, useMemo, useRef, useState } from "react";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import world from "world-atlas/countries-110m.json";
import { brazilStates, countryLabels, placeLabels, stateLabels } from "./mapLabels";

// Mapa de rotas desenhado no próprio app (SVG + d3-geo), sem servidor de mapas:
// contornos do Natural Earth (domínio público) via world-atlas.

export interface GlobePoint {
  iata: string;
  lat: number;
  lon: number;
  weight: number; // voos por semana (0 para destinos com conexão)
  via?: string; // hub, para destinos com uma conexão
}

const topo = world as unknown as Topology<{ countries: GeometryCollection }>;
const countries = feature(topo, topo.objects.countries) as unknown as FeatureCollection;
const graticule = geoGraticule10();
const COUNTRY_LABELS = countryLabels(countries);

const W = 800;
const H = 620;

export function RouteGlobe(props: {
  origin: { iata: string; lat: number; lon: number };
  direct: GlobePoint[];
  oneStop: GlobePoint[];
  hubs: { iata: string; lat: number; lon: number }[];
  selected: string | null;
  mode: "globo" | "mapa";
  onSelect: (iata: string) => void;
}) {
  const { origin, direct, oneStop, selected, mode } = props;
  const [rotation, setRotation] = useState<[number, number]>([-origin.lon, -origin.lat * 0.6]);
  const [zoom, setZoom] = useState(1);
  const drag = useRef<{ x: number; y: number; r: [number, number] } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const rotationRef = useRef(rotation);
  rotationRef.current = rotation;
  // unidades do viewBox por pixel de tela: mantém os rótulos legíveis no celular
  const [unit, setUnit] = useState(1);
  useEffect(() => {
    const el = svgRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([e]) => setUnit(W / Math.max(1, e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // gira suavemente até a nova origem
  useEffect(() => {
    const target: [number, number] = [-origin.lon, -origin.lat * 0.6];
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setRotation(target);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const from = rotationRef.current;
    const dLon = ((((target[0] - from[0]) % 360) + 540) % 360) - 180;
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / 900);
      const e = 1 - Math.pow(1 - k, 3);
      setRotation([from[0] + dLon * e, from[1] + (target[1] - from[1]) * e]);
      if (k < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [origin.iata, origin.lat, origin.lon]);

  // enquadra as rotas: aproxima até o destino mais distante ocupar o globo visível
  const fitZoom = useMemo(() => {
    const pts = [...direct, ...oneStop];
    if (!pts.length) return 1;
    const far = Math.max(...pts.map((p) => geoDistance([origin.lon, origin.lat], [p.lon, p.lat])));
    return Math.max(0.9, Math.min(5, 250 / (290 * Math.sin(Math.min(far * 1.15, Math.PI / 2)))));
  }, [direct, oneStop, origin.lat, origin.lon]);

  useEffect(() => {
    setZoom(mode === "globo" ? fitZoom : 1);
  }, [fitZoom, mode]);

  const projection: GeoProjection = useMemo(() => {
    if (mode === "mapa") {
      return geoEqualEarth().rotate([rotation[0], 0]).fitExtent([[12, 12], [W - 12, H - 12]], { type: "Sphere" }).scale(155 * zoom).translate([W / 2, H / 2]);
    }
    return geoOrthographic().rotate(rotation).scale(290 * zoom).translate([W / 2, H / 2]).clipAngle(90);
  }, [mode, rotation, zoom]);

  const path = useMemo(() => geoPath(projection), [projection]);
  const center: [number, number] = [-rotation[0], -rotation[1]];
  const visible = (lon: number, lat: number) => mode === "mapa" || geoDistance([lon, lat], center) < Math.PI / 2 - 0.02;

  const maxWeight = Math.max(1, ...direct.map((d) => d.weight));
  const width = (w: number) => 0.8 + 3.2 * Math.sqrt(w / maxWeight);
  const arc = (a: { lon: number; lat: number }, b: { lon: number; lat: number }) =>
    path({ type: "LineString", coordinates: [[a.lon, a.lat], [b.lon, b.lat]] }) ?? undefined;
  const hubById = new Map(props.hubs.map((h) => [h.iata, h]));

  function onPointerDown(e: React.PointerEvent) {
    drag.current = { x: e.clientX, y: e.clientY, r: rotation };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current) return;
    const k = 0.35 / zoom;
    const { x, y, r } = drag.current;
    setRotation([r[0] + (e.clientX - x) * k, mode === "mapa" ? 0 : Math.max(-80, Math.min(80, r[1] - (e.clientY - y) * k))]);
  }

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      setZoom((z) => Math.max(0.8, Math.min(6, z * (e.deltaY < 0 ? 1.12 : 1 / 1.12))));
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  }, []);

  const label = (p: { iata: string; lon: number; lat: number }, strong: boolean) => {
    const xy = projection([p.lon, p.lat]);
    if (!xy || !visible(p.lon, p.lat)) return null;
    return (
      <text x={xy[0] + 7} y={xy[1] - 7} className={`globe-label ${strong ? "is-strong" : ""}`}>
        {p.iata}
      </text>
    );
  };

  const topLabels = new Set(direct.slice(0, 12).map((d) => d.iata));

  // Estados aparecem quando o Brasil fica grande o bastante na tela; siglas, mais perto ainda.
  const brazilWidth = useMemo(() => {
    const b = path.bounds(brazilStates);
    return Number.isFinite(b[1][0] - b[0][0]) ? (b[1][0] - b[0][0]) / unit : 0;
  }, [path, unit]);
  const showStates = brazilWidth > 170;
  const showStateLabels = brazilWidth > 300;

  const placed = useMemo(() => {
    const project = (p: [number, number]) => projection(p) as [number, number] | null;
    // reserva o espaço dos códigos de aeroporto e dos pontos, que têm prioridade
    const occupied = [origin, ...direct.filter((d) => topLabels.has(d.iata) || d.iata === selected)].flatMap((p) => {
      const xy = projection([p.lon, p.lat]);
      return xy && visible(p.lon, p.lat) ? [{ x0: xy[0] - 8, y0: xy[1] - 22 * unit, x1: xy[0] + 44 * unit, y1: xy[1] + 8 }] : [];
    });
    // países primeiro: o nome do país tem prioridade sobre a sigla do estado
    const countries = placeLabels(COUNTRY_LABELS, path, project, visible, { charWidth: 6.6 * unit, height: 12 * unit, minFit: 0.85, occupied, max: 45 });
    const states = showStateLabels
      ? placeLabels(stateLabels, path, project, visible, { charWidth: 7.4 * unit, height: 11 * unit, minFit: 1.1, occupied, max: 27 })
      : [];
    return { states, countries };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projection, path, unit, showStateLabels, direct, selected, origin.lat, origin.lon]);

  return (
    <div className="globe-wrap">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="globe"
        role="img"
        aria-label={`Mapa de rotas a partir de ${origin.iata}: ${direct.length} destinos diretos`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
      >
        <defs>
          <radialGradient id="globe-shade" cx="40%" cy="35%" r="70%">
            <stop offset="0%" stopColor="var(--globe-ocean-hi)" />
            <stop offset="100%" stopColor="var(--globe-ocean)" />
          </radialGradient>
        </defs>
        <path d={path({ type: "Sphere" }) ?? undefined} fill={mode === "globo" ? "url(#globe-shade)" : "var(--globe-ocean)"} className="globe-sphere" />
        <path d={path(graticule) ?? undefined} className="globe-graticule" />
        <path d={path(countries) ?? undefined} className="globe-land" />
        {showStates && <path d={path(brazilStates) ?? undefined} className="globe-state-borders" />}
        {/* fronteiras por cima dos estados, para o limite do país continuar mais forte */}
        <path d={path(countries) ?? undefined} className="globe-country-borders" />
        <g className="globe-place-labels" aria-hidden>
          {placed.countries.map((l) => (
            <text key={`p-${l.text}`} x={l.x} y={l.y} className="globe-country-label" style={{ fontSize: 10 * unit, strokeWidth: 3 * unit }}>
              {l.text}
            </text>
          ))}
          {placed.states.map((l) => (
            <text key={`s-${l.text}`} x={l.x} y={l.y} className="globe-state-label" style={{ fontSize: 9.5 * unit, strokeWidth: 2.5 * unit }}>
              {l.text}
            </text>
          ))}
        </g>

        {oneStop.map((d) => {
          const hub = d.via ? hubById.get(d.via) : undefined;
          return hub ? <path key={`c-${d.iata}`} d={arc(hub, d)} className={`globe-arc is-connection ${selected === d.iata ? "is-selected" : ""}`} /> : null;
        })}
        {direct.map((d) => (
          <path key={`a-${d.iata}`} d={arc(origin, d)} className={`globe-arc ${selected === d.iata ? "is-selected" : ""}`} strokeWidth={width(d.weight)} />
        ))}

        {oneStop.map((d) => {
          const xy = projection([d.lon, d.lat]);
          if (!xy || !visible(d.lon, d.lat)) return null;
          return (
            <circle key={`co-${d.iata}`} cx={xy[0]} cy={xy[1]} r={selected === d.iata ? 5 : 2.6} className="globe-dot is-connection" onClick={() => props.onSelect(d.iata)}>
              <title>{`${d.iata} · via ${d.via}`}</title>
            </circle>
          );
        })}
        {direct.map((d) => {
          const xy = projection([d.lon, d.lat]);
          if (!xy || !visible(d.lon, d.lat)) return null;
          return (
            <circle key={`d-${d.iata}`} cx={xy[0]} cy={xy[1]} r={selected === d.iata ? 6.5 : 4} className={`globe-dot ${selected === d.iata ? "is-selected" : ""}`} onClick={() => props.onSelect(d.iata)}>
              <title>{`${d.iata} · ${d.weight} voos/semana`}</title>
            </circle>
          );
        })}

        {(() => {
          const xy = projection([origin.lon, origin.lat]);
          return xy && visible(origin.lon, origin.lat) ? (
            <g className="globe-origin">
              <circle cx={xy[0]} cy={xy[1]} r="12" className="globe-origin-halo" />
              <circle cx={xy[0]} cy={xy[1]} r="6" />
            </g>
          ) : null;
        })()}

        {direct.filter((d) => topLabels.has(d.iata) || d.iata === selected).map((d) => <g key={`l-${d.iata}`}>{label(d, d.iata === selected)}</g>)}
        {selected && oneStop.find((d) => d.iata === selected) && label(oneStop.find((d) => d.iata === selected)!, true)}
        {label(origin, true)}
      </svg>
      <div className="globe-controls">
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setZoom((z) => Math.min(6, z * 1.3))} aria-label="Aproximar">
          +
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setZoom((z) => Math.max(0.8, z / 1.3))} aria-label="Afastar">
          −
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => {
            setZoom(mode === "globo" ? fitZoom : 1);
            setRotation([-origin.lon, -origin.lat * 0.6]);
          }}
        >
          Centralizar
        </button>
      </div>
    </div>
  );
}
