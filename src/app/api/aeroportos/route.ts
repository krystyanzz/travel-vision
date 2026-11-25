import { NextResponse } from "next/server";
import { METRO_AREAS, nearestAirport, place, searchAirports, searchPlaces } from "@/core/airportsDb";

// ?q=texto → sugestões (cidades e aeroportos); &tipo=aeroporto → só aeroportos (mapa);
// ?codigo=VIX → um lugar para exibir o nome.
// ?perto=-20.3,-40.3 → aeroporto mais próximo (coordenadas arredondadas pelo navegador; nada é guardado).
export function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const perto = params.get("perto");
  if (perto) {
    const [lat, lon] = perto.split(",").map(Number);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return NextResponse.json(null, { status: 400 });
    const a = nearestAirport(lat, lon);
    // cidade com vários aeroportos (SAO, RIO, BHZ…): começa pela cidade inteira
    const metro = a ? Object.entries(METRO_AREAS).find(([, m]) => m.airports.includes(a.iata))?.[0] : undefined;
    return NextResponse.json(a ? { ...place(metro ?? a.iata), km: a.km } : null, { headers: { "Cache-Control": "no-store" } });
  }
  const code = params.get("codigo");
  if (code) return NextResponse.json(place(code) ?? null);
  if (params.get("tipo") === "aeroporto") return NextResponse.json(searchAirports(params.get("q") ?? ""));
  return NextResponse.json(searchPlaces(params.get("q") ?? ""), { headers: { "Cache-Control": "public, max-age=3600" } });
}
