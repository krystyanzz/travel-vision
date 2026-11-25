import { NextResponse } from "next/server";
import { refreshRoute } from "@/core/robots/engine";
import { ROBOTS } from "@/core/robots/registry";
import { defaultStore } from "@/core/robots/store";
import { parseFlightQuery } from "@/core/search/query";

// Atualização sob demanda: pede às fontes conectadas os preços da rota e dos meses buscados.
// Limitada a uma vez a cada 15 min por rota (protege a cota das fontes).
export async function POST(req: Request) {
  const parsed = parseFlightQuery(new URL(req.url).searchParams);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const q = parsed.query;
  const store = defaultStore();
  const roundTrip = q.returnDate ? { departMonth: q.departDate.slice(0, 7), returnMonth: q.returnDate.slice(0, 7) } : undefined;
  const out = await refreshRoute(ROBOTS, store, { origin: q.origin, destination: q.destination, months: [q.departDate.slice(0, 7)], dates: [q.departDate], roundTrip });
  let back = null;
  if (q.returnDate && out.reports.length) {
    // volta como só ida também: permite montar ida + volta com dois bilhetes
    back = await refreshRoute(ROBOTS, store, { origin: q.destination, destination: q.origin, months: [q.returnDate.slice(0, 7)], dates: [q.returnDate] });
  }
  return NextResponse.json({ refreshed: out.refreshed || !!back?.refreshed, message: out.message });
}
