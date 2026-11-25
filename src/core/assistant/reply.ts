import { flexSearch } from "../flex/load";
import { airlineName, partnersOf, programsForAirlines } from "../partners/partners";
import { malha, partnersForRoute, weeklyByAirline } from "../partners/lookup";
import { exploreAnywhere, exploreDuration } from "../robots/robots/serpapiExplore";
import type { Store } from "../robots/store";
import { dayPrices, searchFlights, type Trip } from "../search/flights";
import { assumptions, nextQuestion, summary } from "./describe";
import type { Parsed } from "./parse";

// Resposta do assistente: roda o motor certo para o que foi entendido e monta a frase
// e os cartões. Todo número vem do motor (banco alimentado pelos robôs); sem dado, diz isso.

export interface ReplyCard {
  title: string;
  subtitle: string;
  price: string | null;
  note?: string;
  href?: string;
  badge?: string;
}

export interface AssistantReply {
  parsed: Parsed;
  summary: string;
  text: string;
  question: { text: string; options?: { code: string; label: string }[] } | null;
  assumptions: string | null;
  cards: ReplyCard[];
  link: { label: string; href: string } | null;
  /** Coleta a fazer em segundo plano; depois o cliente pede a resposta de novo com `parsed`. */
  refresh: { url: string; method: "GET" | "POST" } | null;
  suggestions: string[];
}

const brl = (n: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(n);
const WD = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const dayLabel = (d: string) => `${WD[new Date(`${d}T12:00:00Z`).getUTCDay()]}, ${Number(d.slice(8))}/${d.slice(5, 7)}`;
const dur = (min: number | null) => (min ? `${Math.floor(min / 60)}h${min % 60 ? String(min % 60).padStart(2, "0") : ""}` : null);
const stops = (n: number | null) => (n === 0 ? "direto" : n != null ? `${n} escala${n > 1 ? "s" : ""}` : null);
const carriers = (code: string | null) => (!code ? "Companhia não informada" : code.toLowerCase() === "multi" ? "Várias companhias" : code.split("/").map(airlineName).join(" e "));
const city = (label: string | undefined) => (label ?? "").replace(/\s*\([A-Z]{3}\)$/, "");
const monthsOf = (from: string, to: string) => {
  const out: string[] = [];
  let m = from.slice(0, 7);
  while (m <= to.slice(0, 7) && out.length < 13) {
    out.push(m);
    const [y, mo] = m.split("-").map(Number);
    m = mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, "0")}`;
  }
  return out;
};

const EXAMPLES = [
  "quanto fica pra Lisboa dia 10/12?",
  "mês mais barato pra Madri em 2027",
  "2 semanas em Paris no 1º semestre",
  "para onde é mais barato ir em março?",
];

function base(p: Parsed): AssistantReply {
  return { parsed: p, summary: summary(p), text: "", question: nextQuestion(p), assumptions: assumptions(p), cards: [], link: null, refresh: null, suggestions: [] };
}

function tripCard(t: Trip, origin: string, destination: string): ReplyCard {
  const leg = (l: Trip["out"]) => [carriers(l.carrier), stops(l.stops), dur(l.durationMin)].filter(Boolean).join(" · ");
  const ida = t.out.departAt ? `${dayLabel(t.out.date)} ${t.out.departAt.slice(11, 16)}` : dayLabel(t.out.date);
  const href = `/busca?de=${origin}&para=${destination}&ida=${t.out.date}${t.back ? `&volta=${t.back.date}` : ""}`;
  return {
    title: t.back ? `${ida} → ${dayLabel(t.back.date)}` : ida,
    subtitle: t.back ? `Ida: ${leg(t.out)} · Volta: ${leg(t.back)}` : leg(t.out),
    price: t.kind === "cash" ? (t.totalBrl != null ? brl(t.totalBrl) : null) : t.totalMiles != null ? `${t.totalMiles.toLocaleString("pt-BR")} milhas` : null,
    note: t.ticket === "dois_bilhetes" ? "2 bilhetes só de ida" : t.ticket === "ida_e_volta" ? "bilhete único" : undefined,
    href,
    badge: t.kind === "award" ? (t.programName ?? "milhas") : undefined,
  };
}

export async function buildReply(store: Store, p: Parsed, opts: { rawText?: string; canRefresh?: boolean } = {}): Promise<AssistantReply> {
  const r = base(p);
  const today = new Date().toISOString().slice(0, 10);

  if (p.intent === "ajuda") {
    r.text = "Eu acho passagens com preços reais. Me diga para onde quer ir e quando, do seu jeito. Por exemplo:";
    r.suggestions = EXAMPLES;
    return r;
  }
  if (r.question) {
    r.text = r.question.text;
    if (p.missing[0] === "data") r.suggestions = ["dia 10/12", "de 10 a 20/12", "em março", "o mais barato em 2027"];
    if (p.intent === null) r.suggestions = EXAMPLES;
    return r;
  }

  if (p.intent === "simulador") {
    const raw = opts.rawText ?? "";
    const price = p.maxPrice ?? Number(/(\d+(?:[.,]\d+)?)\s*reais/.exec(raw)?.[1]?.replace(",", ".") ?? NaN);
    const bonus = Number(/(\d+)\s*%/.exec(raw)?.[1] ?? NaN);
    if (Number.isFinite(price) && price > 0) {
      const b = Number.isFinite(bonus) ? bonus : 0;
      const cost = Math.round((price / (1 + b / 100)) * 100) / 100;
      r.text = `Pagando ${brl(price)} por 1.000 pontos${b ? ` e transferindo com ${b}% de bônus` : ""} (paridade 1:1), cada 1.000 milhas saem por ${cost.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}.`;
    } else r.text = "Me diga quanto pagou por 1.000 pontos e o bônus de transferência (ex.: \"R$ 35 com 80% de bônus\") ou use o simulador completo.";
    r.link = { label: "Abrir o simulador de milhas", href: "/simulador" };
    return r;
  }

  const o = p.origin!.code;
  const d = p.destination?.code ?? "";

  if (p.intent === "parceiros") {
    if (p.program && !d) {
      const pp = partnersOf(p.program);
      r.text = pp ? `Com ${pp.program.name} dá para emitir em ${pp.partners.length} companhias.` : "Não conheço esse programa.";
      r.cards = (pp?.partners ?? []).slice(0, 8).map((x) => ({ title: x.airlineName, subtitle: x.evidence === "oficial" ? "fonte oficial" : "fonte secundária", price: null }));
      r.link = { label: "Ver o mapa de parceiros", href: "/explorar#parceiros" };
      return r;
    }
    const rp = await partnersForRoute(o, d);
    if (rp.status === "ok") {
      r.text = `Voam direto de ${city(p.origin!.label)} para ${city(p.destination!.label)}: ${rp.airlines.map((a) => a.name).join(", ")}. ${rp.programs.length ? `Dá para emitir com ${rp.programs.map((m) => m.program.name).join(", ")}.` : "Nenhum programa validado emite nessas companhias."}`;
      r.cards = rp.programs.map((m) => ({ title: m.program.name, subtitle: `em ${m.via.map((v) => `${v.airlineName} (${v.evidence === "oficial" ? "fonte oficial" : "fonte secundária"})`).join(", ")}`, price: null, note: m.program.howToRedeem }));
    } else {
      // sem voo direto (ou sem malha da origem): quem opera no destino, com conexão
      const dest = await malha(d, false);
      const airlines = dest.data ? weeklyByAirline(dest.data.flights) : [];
      const programs = programsForAirlines(airlines.map((a) => a.code));
      const why = rp.status === "sem_voo_direto" ? `Não há voo direto de ${city(p.origin!.label)} para ${city(p.destination!.label)}` : `Ainda não tenho a malha aérea de ${city(p.origin!.label)}`;
      if (programs.length) {
        r.text = `${why}, mas com conexão as companhias que voam para ${city(p.destination!.label)} incluem ${airlines.slice(0, 5).map((a) => a.name).join(", ")}. Dá para emitir com ${programs.map((m) => m.program.name).join(", ")}.`;
        r.cards = programs.map((m) => ({ title: m.program.name, subtitle: `em ${m.via.map((v) => `${v.airlineName} (${v.evidence === "oficial" ? "fonte oficial" : "fonte secundária"})`).join(", ")}`, price: null, note: m.program.howToRedeem }));
      } else {
        r.text = `${why}, e ainda não tenho a malha de ${city(p.destination!.label)} para saber quais programas chegam lá.`;
        // consulta a malha do destino em segundo plano (gasta cota da AirLabs, com teto diário) e responde de novo
        if (opts.canRefresh && !dest.data) r.refresh = { url: `/api/parceiros?destino=${d}&consultar=1`, method: "GET" };
      }
    }
    r.link = { label: "Abrir o mapa de parceiros", href: "/explorar#parceiros" };
    return r;
  }

  if (p.intent === "explorar") {
    const month = p.period && p.period.fromMonth === p.period.toMonth ? Number(p.period.fromMonth.slice(5)) : p.dateWindow ? Number(p.dateWindow.from.slice(5, 7)) : 0;
    const length = exploreDuration(p.duration?.min ?? 6, p.duration?.max ?? 9);
    const res = await exploreAnywhere(o, month, length);
    let opts2 = res.options;
    if (p.maxPrice) opts2 = opts2.filter((x) => x.price <= p.maxPrice!);
    if (p.directOnly) opts2 = opts2.filter((x) => x.stops === 0);
    if (res.status !== "ok") {
      r.text = res.status === "limite" ? "Atingi o limite de consultas de hoje para descobrir destinos. Tente amanhã ou escolha um destino." : "Não consegui consultar destinos agora.";
      return r;
    }
    const period = month ? ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"][month - 1] : "nos próximos 6 meses";
    r.text = opts2.length
      ? `Saindo de ${city(p.origin!.label)}, ${length === 1 ? "num fim de semana" : length === 2 ? "por cerca de 1 semana" : "por cerca de 2 semanas"}, os destinos mais baratos ${month ? `em ${period}` : period} são estes (ida e volta, Google, consultado agora):`
      : "Não achei destinos com esses filtros.";
    r.cards = opts2.slice(0, 8).map((x) => ({
      title: `${x.name}${x.country ? ` · ${x.country}` : ""}`,
      subtitle: `${dayLabel(x.departDate)} → ${dayLabel(x.returnDate)}${x.airline ? ` · ${x.airline}` : ""}${stops(x.stops) ? ` · ${stops(x.stops)}` : ""}`,
      price: brl(x.price),
      href: `/busca?de=${o}&para=${x.code}&ida=${x.departDate}&volta=${x.returnDate}`,
    }));
    return r;
  }

  if (p.intent === "ferias") {
    const from = p.period?.fromMonth ?? p.dateWindow!.from.slice(0, 7);
    const to = p.period?.toMonth ?? p.dateWindow!.to.slice(0, 7);
    const q = { origin: o, destination: d, fromMonth: from < today.slice(0, 7) ? today.slice(0, 7) : from, toMonth: to, minDays: p.duration!.min, maxDays: p.duration!.max, directOnly: p.directOnly, maxPrice: p.maxPrice };
    const res = flexSearch(store, q);
    const qs = new URLSearchParams({ de: o, para: d, de_mes: q.fromMonth, ate_mes: q.toMonth, min: String(q.minDays), max: String(q.maxDays) });
    if (q.directOnly) qs.set("direto", "1");
    if (q.maxPrice) qs.set("teto", String(q.maxPrice));
    const best = res.windows[0];
    r.text = best
      ? `A melhor janela que encontrei para ficar ${q.minDays === q.maxDays ? `${q.minDays}` : `${q.minDays} a ${q.maxDays}`} dias em ${city(p.destination!.label)} é ${dayLabel(best.departDate)} → ${dayLabel(best.returnDate)} (${best.days} dias): ${brl(best.totalBrl)} ida e volta, ${carriers(best.carrier)}.`
      : `Ainda não tenho preço real para essa viagem no período.`;
    r.cards = res.windows.slice(0, 4).map((w) => ({
      title: `${dayLabel(w.departDate)} → ${dayLabel(w.returnDate)}`,
      subtitle: `${w.days} dias · ${carriers(w.carrier)}${stops(w.stops) ? ` · ${stops(w.stops)}` : ""}`,
      price: brl(w.totalBrl),
      note: w.ticket === "ida_e_volta" ? "bilhete único" : "2 bilhetes",
      href: `/busca?de=${o}&para=${d}&ida=${w.departDate}&volta=${w.returnDate}`,
    }));
    r.link = { label: "Ver mês a mês nas Férias flexíveis", href: `/ferias?${qs}` };
    if (opts.canRefresh) r.refresh = { url: `/api/ferias/atualizar?${qs}`, method: "POST" };
    r.suggestions = ["e só voo direto?", "e em 3 semanas?", "e no segundo semestre?"];
    return r;
  }

  // ---- buscar ----
  if (!p.departDate && p.dateWindow) {
    // o dia mais barato da janela
    const from = p.dateWindow.from < today ? today : p.dateWindow.from;
    const prices = dayPrices(store, o, d, monthsOf(from, p.dateWindow.to));
    const days = Object.entries(prices).filter(([day]) => day >= from && day <= p.dateWindow!.to).sort((a, b) => a[1] - b[1]);
    const qsCal = new URLSearchParams({ de: o, para: d, meses: monthsOf(from, p.dateWindow.to).slice(0, 3).join(",") });
    if (opts.canRefresh) r.refresh = { url: `/api/calendario?${qsCal}&atualizar=1`, method: "GET" };
    if (!days.length) {
      r.text = `Ainda não tenho preço real para ${city(p.destination!.label)} entre ${dayLabel(from)} e ${dayLabel(p.dateWindow.to)}.`;
      r.link = { label: "Abrir a busca", href: `/busca?de=${o}&para=${d}&ida=${from}` };
      return r;
    }
    const [bestDay, bestPrice] = days[0];
    r.text = `O dia mais barato para ir de ${city(p.origin!.label)} a ${city(p.destination!.label)} entre ${dayLabel(from)} e ${dayLabel(p.dateWindow.to)} é ${dayLabel(bestDay)}: a partir de ${brl(bestPrice)} só ida.`;
    r.cards = days.slice(0, 5).map(([day, price]) => ({ title: dayLabel(day), subtitle: "menor preço do dia, só ida", price: brl(price), href: `/busca?de=${o}&para=${d}&ida=${day}` }));
    r.link = { label: `Ver os voos de ${dayLabel(bestDay)}`, href: `/busca?de=${o}&para=${d}&ida=${bestDay}` };
    return r;
  }

  const res = searchFlights(store, { origin: o, destination: d, departDate: p.departDate!, returnDate: p.returnDate, cabin: p.cabin ?? "any" });
  let trips = res.trips.filter((t) => !p.program || t.program === p.program);
  if (p.directOnly) trips = trips.filter((t) => (t.out.stops ?? 1) === 0 && (!t.back || (t.back.stops ?? 1) === 0));
  if (p.maxPrice) trips = trips.filter((t) => t.totalBrl == null || t.totalBrl <= p.maxPrice!);
  const qs = new URLSearchParams({ de: o, para: d, ida: p.departDate! });
  if (p.returnDate) qs.set("volta", p.returnDate);
  if (opts.canRefresh && res.onDemand) r.refresh = { url: `/api/voos/atualizar?${qs}`, method: "POST" };
  r.link = { label: "Ver todos os voos e filtros", href: `/busca?${qs}` };
  const when = p.returnDate ? `de ${dayLabel(p.departDate!)} a ${dayLabel(p.returnDate)}` : `em ${dayLabel(p.departDate!)}`;
  if (!trips.length) {
    const nearby = res.legs[0].nearby.filter((n) => n.lowestBrl !== null);
    r.text = `Ainda não tenho preço real de ${city(p.origin!.label)} para ${city(p.destination!.label)} ${when}${p.directOnly ? " em voo direto" : ""}.${nearby.length ? " Há preço em datas próximas:" : ""}`;
    r.cards = nearby.slice(0, 4).map((n) => ({ title: dayLabel(n.date), subtitle: "menor preço do dia, só ida", price: brl(n.lowestBrl!), href: `/busca?de=${o}&para=${d}&ida=${n.date}` }));
    return r;
  }
  const t = trips[0];
  const first = [carriers(t.out.carrier), stops(t.out.stops), t.back ? (dur(t.out.durationMin) ? `ida em ${dur(t.out.durationMin)}` : null) : dur(t.out.durationMin)].filter(Boolean).join(", ");
  r.text = `Achei ${trips.length} ${trips.length === 1 ? "opção real" : "opções reais"} de ${city(p.origin!.label)} para ${city(p.destination!.label)} ${when}. A mais barata: ${t.totalBrl != null ? brl(t.totalBrl) : "—"}${p.returnDate ? " ida e volta" : ""} (${first}).`;
  r.cards = trips.slice(0, 3).map((x) => tripCard(x, o, d));
  r.suggestions = p.returnDate ? ["e só voo direto?", "e saindo um dia antes?"] : ["e voltando uma semana depois?", "e só voo direto?"];
  return r;
}
