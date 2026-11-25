import { NextResponse } from "next/server";
import { refreshRoute } from "@/core/robots/engine";
import { ROBOTS } from "@/core/robots/registry";
import { defaultStore } from "@/core/robots/store";
import { dayPrices } from "@/core/search/flights";

// Menor preço real por dia (só ida), nos dois sentidos, para o calendário de escolha de datas.
//   ?de=GRU&para=SCL&meses=2026-12,2027-01
//   &atualizar=1 → antes, pede às fontes conectadas os meses que ainda não têm preço
//                  (limite de 1 vez a cada 15 min por rota e meses, no motor)
const IATA = /^[A-Z]{3}$/;
const MONTH = /^\d{4}-\d{2}$/;

export async function GET(req: Request) {
  const p = new URL(req.url).searchParams;
  const de = (p.get("de") ?? "").toUpperCase();
  const para = (p.get("para") ?? "").toUpperCase();
  const meses = (p.get("meses") ?? "").split(",").filter((m) => MONTH.test(m)).slice(0, 3);
  if (!IATA.test(de) || !IATA.test(para) || de === para || !meses.length) return NextResponse.json({ error: "Parâmetros inválidos" }, { status: 400 });
  const store = defaultStore();

  let refreshed = false;
  if (p.get("atualizar") === "1") {
    const pending = (from: string, to: string) => meses.filter((m) => !Object.keys(dayPrices(store, from, to, [m])).length);
    const ida = pending(de, para);
    const volta = pending(para, de);
    if (ida.length) refreshed = (await refreshRoute(ROBOTS, store, { origin: de, destination: para, months: ida })).refreshed || refreshed;
    if (volta.length) refreshed = (await refreshRoute(ROBOTS, store, { origin: para, destination: de, months: volta })).refreshed || refreshed;
  }
  return NextResponse.json({ ida: dayPrices(store, de, para, meses), volta: dayPrices(store, para, de, meses), refreshed });
}
