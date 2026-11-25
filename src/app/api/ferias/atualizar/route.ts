import { NextResponse } from "next/server";
import { flexMonths, parseFlexQuery } from "@/core/flex/query";
import { refreshRoute } from "@/core/robots/engine";
import { ROBOTS } from "@/core/robots/registry";
import { defaultStore } from "@/core/robots/store";

// Coleta para as Férias flexíveis: Google Travel Explore nos próximos 6 meses do período
// e Aviasales (ida e volta do ano + só ida mês a mês, nos dois sentidos).
// Limitada a uma vez a cada 15 min por rota, período e duração (no motor).
export async function POST(req: Request) {
  const parsed = parseFlexQuery(new URL(req.url).searchParams);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const q = parsed.query;
  const out = await refreshRoute(ROBOTS, defaultStore(), {
    origin: q.origin,
    destination: q.destination,
    months: [],
    flex: { months: flexMonths(q), minDays: q.minDays, maxDays: q.maxDays },
  });
  return NextResponse.json({
    refreshed: out.refreshed,
    message: out.message,
    sources: out.reports.map((r) => ({ robot: r.robotId, status: r.status, message: r.message })),
  });
}
