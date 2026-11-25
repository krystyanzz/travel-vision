import data from "../data/airports.json";

// Base de aeroportos do OurAirports (domínio público), gerada por
// scripts/build-airports.mjs.

export interface AirportInfo {
  iata: string;
  name: string;
  city: string;
  country: string; // ISO 3166-1 alfa-2
  lat: number;
  lon: number;
  size: 1 | 2 | 3;
}

type Row = [string, string, string, string, number, number, number];

const index = new Map<string, AirportInfo>(
  (data.airports as Row[]).map(([iata, name, city, country, lat, lon, size]) => [
    iata,
    { iata, name, city, country, lat, lon, size: size as 1 | 2 | 3 },
  ]),
);

export function airport(iata: string): AirportInfo | undefined {
  return index.get(iata.toUpperCase());
}

/** Busca por código, cidade ou nome, priorizando aeroportos maiores. */
export function searchAirports(query: string, limit = 8): AirportInfo[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const nq = norm(q);
  const scored: [number, AirportInfo][] = [];
  const wordStart = (s: string) => norm(s).split(/[^a-z0-9]+/).some((w) => w.startsWith(nq));
  for (const a of index.values()) {
    let score = 0;
    // código exato pesa, mas não passa de uma cidade brasileira grande com o mesmo começo ("vit" → VIX antes de VIT)
    if (a.iata.toLowerCase() === q) score = 60;
    else if (norm(a.city).startsWith(nq)) score = 50;
    else if (a.iata.toLowerCase().startsWith(nq)) score = 46; // "gr" → GRU
    else if (wordStart(a.name) || wordStart(a.city)) score = 45; // ex.: "gua" → Guarulhos
    else if (norm(a.name).includes(nq) || norm(a.city).includes(nq)) score = 20;
    // público brasileiro: aeroportos do Brasil sobem na lista
    if (score) scored.push([score + a.size * 5 + (a.country === "BR" ? 12 : 0), a]);
  }
  return scored.sort((x, y) => y[0] - x[0]).slice(0, limit).map(([, a]) => a);
}

export const AIRPORTS_SOURCE = data.source;

// ---------- lugares (cidade com vários aeroportos + aeroportos) ----------

/** Códigos IATA de cidade com mais de um aeroporto comercial relevante. */
export const METRO_AREAS: Record<string, { city: string; country: string; airports: string[] }> = {
  SAO: { city: "São Paulo", country: "BR", airports: ["GRU", "CGH", "VCP"] },
  RIO: { city: "Rio de Janeiro", country: "BR", airports: ["GIG", "SDU"] },
  BHZ: { city: "Belo Horizonte", country: "BR", airports: ["CNF", "PLU"] },
  BUE: { city: "Buenos Aires", country: "AR", airports: ["EZE", "AEP"] },
  NYC: { city: "Nova York", country: "US", airports: ["JFK", "EWR", "LGA"] },
  WAS: { city: "Washington", country: "US", airports: ["IAD", "DCA", "BWI"] },
  CHI: { city: "Chicago", country: "US", airports: ["ORD", "MDW"] },
  LON: { city: "Londres", country: "GB", airports: ["LHR", "LGW", "STN", "LTN", "LCY"] },
  PAR: { city: "Paris", country: "FR", airports: ["CDG", "ORY"] },
  ROM: { city: "Roma", country: "IT", airports: ["FCO", "CIA"] },
  MIL: { city: "Milão", country: "IT", airports: ["MXP", "LIN", "BGY"] },
  TYO: { city: "Tóquio", country: "JP", airports: ["HND", "NRT"] },
};

export interface Place {
  code: string;
  kind: "city" | "airport";
  /** Nome principal: a cidade. */
  city: string;
  /** Detalhe: nome do aeroporto ou "todos os aeroportos". */
  detail: string;
  country: string; // ISO alfa-2
  /** Para cidades: aeroportos incluídos. */
  airports?: string[];
}

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function metroPlace(code: string): Place {
  const m = METRO_AREAS[code];
  return { code, kind: "city", city: m.city, detail: `Todos os aeroportos (${m.airports.join(", ")})`, country: m.country, airports: m.airports };
}

function airportPlace(a: AirportInfo): Place {
  return { code: a.iata, kind: "airport", city: a.city || a.name, detail: a.name, country: a.country };
}

/** Resolve um código (aeroporto ou cidade) para exibição. */
export function place(code: string): Place | undefined {
  const c = code.toUpperCase();
  if (METRO_AREAS[c]) return metroPlace(c);
  const a = airport(c);
  return a ? airportPlace(a) : undefined;
}

/**
 * Busca por código, cidade ou nome do aeroporto. A cidade com vários aeroportos
 * aparece antes dos aeroportos dela, que vêm logo em seguida.
 */
export function searchPlaces(query: string, limit = 8): Place[] {
  const q = query.trim();
  if (q.length < 2) return [];
  const nq = norm(q);
  const metros = Object.keys(METRO_AREAS).filter((code) => code.toLowerCase() === nq || norm(METRO_AREAS[code].city).startsWith(nq));
  const out: Place[] = [];
  const seen = new Set<string>();
  const push = (p: Place) => {
    if (seen.has(p.code) || out.length >= limit) return;
    seen.add(p.code);
    out.push(p);
  };
  for (const code of metros) {
    push(metroPlace(code));
    for (const a of METRO_AREAS[code].airports) {
      const info = airport(a);
      if (info) push(airportPlace(info));
    }
  }
  for (const a of searchAirports(q, limit + out.length)) push(airportPlace(a));
  return out;
}

/**
 * Aeroporto comercial mais próximo de um ponto (médio ou grande, com código IATA).
 * Usado para preencher a origem a partir da localização do usuário.
 */
export function nearestAirport(lat: number, lon: number, maxKm = 150): (AirportInfo & { km: number }) | null {
  const rad = Math.PI / 180;
  let best: AirportInfo | null = null;
  let bestKm = Infinity;
  for (const a of index.values()) {
    if (a.size < 2) continue;
    const dLat = (a.lat - lat) * rad;
    const dLon = (a.lon - lon) * rad;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat * rad) * Math.cos(a.lat * rad) * Math.sin(dLon / 2) ** 2;
    const km = 2 * 6371 * Math.asin(Math.sqrt(h));
    // um aeroporto grande vale um pouco mais longe que um médio (ex.: GRU antes de um regional)
    const score = km - (a.size === 3 ? 25 : 0);
    if (score < bestKm) {
      bestKm = score;
      best = a;
    }
  }
  if (!best) return null;
  const km = bestKm + (best.size === 3 ? 25 : 0);
  return km <= maxKm ? { ...best, km: Math.round(km) } : null;
}

/** Todos os aeroportos da base (para índices de nomes, como o do assistente). */
export function allAirports(): AirportInfo[] {
  return [...index.values()];
}
