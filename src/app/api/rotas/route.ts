import { NextResponse } from "next/server";
import { QuotaExceededError } from "@/core/providers/quota";
import { ProviderError } from "@/core/providers/types";
import { routeMap } from "@/core/routes/registry";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const de = (url.searchParams.get("de") ?? "").toUpperCase();
  if (!/^[A-Z]{3}$/.test(de)) return NextResponse.json({ error: "Informe um aeroporto (código IATA)" }, { status: 400 });

  try {
    return NextResponse.json(await routeMap(de, url.searchParams.get("conexoes") === "1"));
  } catch (e) {
    if (e instanceof RangeError) return NextResponse.json({ error: "Aeroporto não encontrado" }, { status: 404 });
    if (e instanceof QuotaExceededError) {
      const msg =
        e.providerId === "airlabs"
          ? "Limite diário de consultas de rotas atingido. Aeroportos já consultados continuam disponíveis; os demais voltam amanhã."
          : "Muitas consultas em pouco tempo. Tente em instantes.";
      return NextResponse.json({ error: msg }, { status: 429, headers: { "Retry-After": String(Math.ceil(e.retryAfterMs / 1000)) } });
    }
    if (e instanceof ProviderError) {
      console.error(e.message);
      return NextResponse.json({ error: "O fornecedor de rotas não respondeu ou a cota acabou." }, { status: 502 });
    }
    if (e instanceof Error && e.message.includes("AIRLABS_API_KEY")) {
      return NextResponse.json({ error: "Mapa de rotas indisponível: chave da AirLabs não configurada." }, { status: 503 });
    }
    throw e;
  }
}
