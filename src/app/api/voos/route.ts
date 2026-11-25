import { NextResponse } from "next/server";
import { defaultStore } from "@/core/robots/store";
import { searchFlights } from "@/core/search/flights";
import { parseFlightQuery } from "@/core/search/query";

// Busca consolidada (dinheiro + milhas) a partir do banco alimentado pelos robôs.
export function GET(req: Request) {
  const parsed = parseFlightQuery(new URL(req.url).searchParams);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  return NextResponse.json(searchFlights(defaultStore(), parsed.query));
}
