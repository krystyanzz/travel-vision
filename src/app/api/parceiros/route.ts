import { NextResponse } from "next/server";
import { airport } from "@/core/airportsDb";
import { malha, partnersForRoute, weeklyByAirline } from "@/core/partners/lookup";
import { partnersOf, programsForAirlines, unreviewedPrograms } from "@/core/partners/partners";
import { QuotaExceededError } from "@/core/providers/quota";

// Parcerias de resgate.
//   ?programa=smiles          → companhias em que o programa emite
//   ?de=GRU&para=YYZ          → quem voa direto na rota e quais programas emitem nessas companhias
//   ?destino=YYZ              → companhias que operam no destino e os programas que chegam lá
// A malha vem do cache da AirLabs; só consulta a fonte (gasta cota) com &consultar=1.

const IATA = /^[A-Z]{3}$/;

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const consult = params.get("consultar") === "1";
  const base = { unreviewed: unreviewedPrograms().map((p) => ({ id: p.id, name: p.name, alliance: p.alliance, url: p.officialPartnersUrl })) };

  const programa = params.get("programa");
  if (programa) {
    const r = partnersOf(programa);
    return r ? NextResponse.json({ ...base, ...r }) : NextResponse.json({ error: "Programa desconhecido" }, { status: 404 });
  }

  try {
    const destino = (params.get("destino") ?? "").toUpperCase();
    if (destino) {
      if (!IATA.test(destino) || !airport(destino)) return NextResponse.json({ error: "Destino inválido" }, { status: 400 });
      const { data, consulted } = await malha(destino, consult);
      if (!data) return NextResponse.json({ ...base, status: "sem_malha", destination: airport(destino) });
      const airlines = weeklyByAirline(data.flights);
      return NextResponse.json({ ...base, status: "ok", destination: airport(destino), airlines, programs: programsForAirlines(airlines.map((a) => a.code)), fetchedAt: data.fetchedAt, partial: data.partial, consulted });
    }

    const de = (params.get("de") ?? "").toUpperCase();
    const para = (params.get("para") ?? "").toUpperCase();
    if (!IATA.test(de) || !IATA.test(para)) return NextResponse.json({ error: "Informe origem e destino" }, { status: 400 });
    const r = await partnersForRoute(de, para, consult);
    return NextResponse.json({ ...base, ...r });
  } catch (e) {
    if (e instanceof QuotaExceededError) return NextResponse.json({ ...base, status: "limite" }, { status: 429 });
    console.error(e);
    return NextResponse.json({ ...base, status: "erro" }, { status: 502 });
  }
}

export const dynamic = "force-dynamic";
