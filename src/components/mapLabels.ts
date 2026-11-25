import { geoArea, geoCentroid, type GeoPath } from "d3-geo";
import type { Feature, FeatureCollection, MultiPolygon, Polygon, Position } from "geojson";
import { numericToAlpha2 } from "i18n-iso-countries";
import brStates from "@/data/br-states.json";

// Rótulos do mapa: nomes de países em português (Intl, a partir do código ISO
// numérico do Natural Earth) e estados do Brasil (IBGE). Tudo pré-calculado
// uma vez; a cada quadro o globo só projeta e escolhe o que cabe.

export interface PlaceLabel {
  text: string;
  /** Ponto do rótulo: centro do maior polígono (evita, ex., a Guiana Francesa puxar a França). */
  at: [number, number];
  /** Maior polígono, usado para medir quanto espaço o lugar ocupa na tela. */
  shape: Polygon;
  /** Área real (esferorradianos), para dar prioridade aos lugares maiores. */
  area: number;
}

type AreaFeature = Feature<Polygon | MultiPolygon>;

function largestPolygon(f: AreaFeature): Polygon {
  if (f.geometry.type === "Polygon") return f.geometry;
  let best: Polygon | null = null;
  let bestArea = -1;
  for (const coordinates of f.geometry.coordinates) {
    const p: Polygon = { type: "Polygon", coordinates };
    const a = geoArea(p);
    if (a > bestArea) {
      bestArea = a;
      best = p;
    }
  }
  return best!;
}

let regionNames: Intl.DisplayNames | null = null;
function countryName(numericId: string | number | undefined, fallback: string): string {
  const alpha2 = numericId != null ? numericToAlpha2(numericId) : undefined;
  if (!alpha2) return fallback;
  try {
    regionNames ??= new Intl.DisplayNames(["pt-BR"], { type: "region" });
    return regionNames.of(alpha2) ?? fallback;
  } catch {
    return fallback;
  }
}

export function countryLabels(countries: FeatureCollection): PlaceLabel[] {
  return (countries.features as AreaFeature[])
    .filter((f) => f.geometry && (f.geometry.type === "Polygon" || f.geometry.type === "MultiPolygon"))
    .map((f) => {
      const shape = largestPolygon(f);
      return {
        text: countryName(f.id, (f.properties?.name as string) ?? ""),
        at: geoCentroid(shape) as [number, number],
        shape,
        area: geoArea(f),
      };
    })
    .filter((l) => l.text && l.text !== "Antártida")
    .sort((a, b) => b.area - a.area);
}

// O d3-geo espera o anel externo no sentido horário (o contrário do GeoJSON/RFC 7946,
// que o IBGE segue). Sem inverter, o polígono vira "o mundo menos o estado". A malha
// mistura sentidos entre partes do mesmo estado (ex.: ilhas do PR), então cada parte
// é conferida separadamente.
function rewindPolygon(rings: Position[][]): Position[][] {
  return geoArea({ type: "Polygon", coordinates: rings }) > 2 * Math.PI ? rings.map((r) => [...r].reverse()) : rings;
}

function rewind(f: AreaFeature): AreaFeature {
  const geometry: Polygon | MultiPolygon =
    f.geometry.type === "Polygon"
      ? { type: "Polygon", coordinates: rewindPolygon(f.geometry.coordinates) }
      : { type: "MultiPolygon", coordinates: f.geometry.coordinates.map(rewindPolygon) };
  return { ...f, geometry };
}

export const brazilStates: FeatureCollection<Polygon | MultiPolygon, { uf: string; name: string }> = {
  type: "FeatureCollection",
  features: (brStates.features as unknown as Feature<Polygon | MultiPolygon, { uf: string; name: string }>[]).map(
    (f) => rewind(f as AreaFeature) as Feature<Polygon | MultiPolygon, { uf: string; name: string }>,
  ),
};

export const stateLabels: PlaceLabel[] = brazilStates.features
  .map((f) => {
    const shape = largestPolygon(f as AreaFeature);
    return { text: f.properties.uf, at: geoCentroid(shape) as [number, number], shape, area: geoArea(f) };
  })
  .sort((a, b) => b.area - a.area);

export interface PlacedLabel {
  text: string;
  x: number;
  y: number;
}

/**
 * Escolhe os rótulos que cabem: o lugar precisa ter, na tela, largura para o texto,
 * e nenhum rótulo pode encostar em outro (nem nas caixas já ocupadas).
 */
export function placeLabels(
  labels: PlaceLabel[],
  path: GeoPath,
  project: (p: [number, number]) => [number, number] | null,
  visible: (lon: number, lat: number) => boolean,
  opts: { charWidth: number; height: number; minFit: number; occupied: { x0: number; y0: number; x1: number; y1: number }[]; max: number },
): PlacedLabel[] {
  const out: PlacedLabel[] = [];
  for (const l of labels) {
    if (out.length >= opts.max) break;
    if (!visible(l.at[0], l.at[1])) continue;
    const xy = project(l.at);
    if (!xy) continue;
    const width = l.text.length * opts.charWidth;
    const bounds = path.bounds(l.shape);
    const shapeWidth = bounds[1][0] - bounds[0][0];
    if (!Number.isFinite(shapeWidth) || shapeWidth < width * opts.minFit) continue;
    // tenta o centro e, se colidir (ex.: com um código de aeroporto), um pouco acima ou abaixo, dentro do lugar
    const h = opts.height;
    for (const dy of [0, -1.4 * h, 1.4 * h, -2.8 * h, 2.8 * h]) {
      const y = xy[1] + dy;
      if (y < bounds[0][1] || y > bounds[1][1]) continue;
      const box = { x0: xy[0] - width / 2 - 2, y0: y - h / 2 - 1, x1: xy[0] + width / 2 + 2, y1: y + h / 2 + 1 };
      if (opts.occupied.some((b) => box.x0 < b.x1 && box.x1 > b.x0 && box.y0 < b.y1 && box.y1 > b.y0)) continue;
      opts.occupied.push(box);
      out.push({ text: l.text, x: xy[0], y });
      break;
    }
  }
  return out;
}
