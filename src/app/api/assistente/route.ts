import { NextResponse } from "next/server";
import { parse, type Parsed } from "@/core/assistant/parse";
import { buildReply } from "@/core/assistant/reply";
import { defaultStore } from "@/core/robots/store";

// Assistente de viagem (próprio, sem IA externa). Nada da conversa é guardado no servidor.
//   { text, previous?, home? } → entende a frase e responde
//   { parsed }                 → responde de novo o mesmo pedido (depois de uma coleta em segundo plano)

const IATA = /^[A-Z]{3}$/;

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { text?: string; previous?: Parsed | null; home?: string | null; parsed?: Parsed } | null;
  if (!body) return NextResponse.json({ error: "Pedido inválido" }, { status: 400 });
  const store = defaultStore();

  if (body.parsed) return NextResponse.json(await buildReply(store, body.parsed));

  const text = (body.text ?? "").slice(0, 300).trim();
  if (!text) return NextResponse.json({ error: "Escreva o que você procura." }, { status: 400 });
  const home = body.home && IATA.test(body.home) ? body.home : null;
  const parsed = parse(text, { today: new Date(), home, previous: body.previous ?? null });
  return NextResponse.json(await buildReply(store, parsed, { rawText: text, canRefresh: true }));
}

export const dynamic = "force-dynamic";
