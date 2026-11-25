import { NextResponse } from "next/server";
import { flexSearch } from "@/core/flex/load";
import { parseFlexQuery } from "@/core/flex/query";
import { policyBlock } from "@/core/robots/engine";
import { ROBOTS } from "@/core/robots/registry";
import { defaultStore } from "@/core/robots/store";

// Férias flexíveis: as janelas mais baratas no período, a partir do banco (só preços reais).
export function GET(req: Request) {
  const parsed = parseFlexQuery(new URL(req.url).searchParams);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const result = flexSearch(defaultStore(), parsed.query);
  const onDemand = ROBOTS.some((r) => r.collectRoute && !policyBlock(r) && !r.notReady());
  return NextResponse.json({ ...result, onDemand });
}

export const dynamic = "force-dynamic";
