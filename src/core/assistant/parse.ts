import { allAirports, METRO_AREAS, place } from "../airportsDb";
import type { Cabin } from "../types";
import { AMBIGUOUS_MONTH_ABBR, CARNIVAL, CITY_ALIASES, MONTHS, norm, NUMBER_WORDS, PROGRAM_NAMES, PT_LABELS, SEASONS, STOPWORDS } from "./lexicon";

// Entendimento de pedidos de viagem em português, feito por regras (sem IA externa).
// Cada pedaço reconhecido (preço, datas, duração, cidades…) é retirado do texto para
// não ser contado duas vezes. O resultado diz o que entendeu, o que faltou e o que
// foi presumido; quem chama decide se pergunta ou se já busca.

export type Intent = "buscar" | "ferias" | "explorar" | "parceiros" | "simulador" | "ajuda";
export type Missing = "destino" | "origem" | "data" | "periodo";

export interface PlaceRef {
  code: string;
  label: string; // "Lisboa (LIS)"
}

export interface Parsed {
  intent: Intent | null;
  origin: PlaceRef | null;
  originFromHome: boolean;
  destination: PlaceRef | null;
  departDate: string | null;
  returnDate: string | null;
  /** Ida flexível dentro destes dias (ex.: "semana que vem", "no Natal"). */
  dateWindow: { from: string; to: string } | null;
  period: { fromMonth: string; toMonth: string } | null;
  duration: { min: number; max: number } | null;
  tripType: "ida" | "ida_e_volta" | null;
  directOnly: boolean;
  maxPrice: number | null;
  cabin: Cabin | null;
  program: string | null;
  followUp: boolean;
  missing: Missing[];
  ambiguous: { field: "origem" | "destino"; text: string; options: PlaceRef[] }[];
  assumed: string[];
}

export interface ParseContext {
  today: Date;
  /** Origem padrão (cidade do usuário). */
  home?: string | null;
  /** Pedido anterior da conversa, para entender "e se for em julho?". */
  previous?: Parsed | null;
}

// ---------- datas ----------

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;
const ym = (y: number, m: number) => `${y}-${pad(m)}`;
const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const addDays = (d: string, n: number) => {
  const t = new Date(`${d}T12:00:00Z`);
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
};
const addMonths = (month: string, n: number) => {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
};
const validDate = (y: number, m: number, d: number) => m >= 1 && m <= 12 && d >= 1 && d <= lastDay(y, m);

const MONTH_RE = Object.keys(MONTHS).sort((a, b) => b.length - a.length).join("|");
const NUMWORD_RE = Object.keys(NUMBER_WORDS).sort((a, b) => b.length - a.length).join("|");
const NUM = `(?:\\d{1,2}|${NUMWORD_RE})`;
const toNum = (s: string) => (/^\d+$/.test(s) ? Number(s) : (NUMBER_WORDS[s] ?? NaN));
const WEEKDAYS: Record<string, number> = { domingo: 0, segunda: 1, terca: 2, quarta: 3, quinta: 4, sexta: 5, sabado: 6 };

// ---------- cidades ----------

let cityIndex: Map<string, PlaceRef[]> | null = null;
let codeSet: Set<string> | null = null;

const ref = (code: string): PlaceRef | null => {
  const p = place(code);
  return p ? { code: p.code, label: `${PT_LABELS[p.code] ?? p.city} (${p.code})` } : null;
};

/** Nome normalizado → lugares possíveis (cidade com vários aeroportos primeiro, depois o maior aeroporto). */
function cities(): Map<string, PlaceRef[]> {
  if (cityIndex) return cityIndex;
  const m = new Map<string, PlaceRef[]>();
  const metroOf = new Map<string, string>();
  for (const [code, mm] of Object.entries(METRO_AREAS)) for (const a of mm.airports) metroOf.set(a, code);
  const byCity = new Map<string, { code: string; size: number; country: string }[]>();
  for (const a of allAirports()) {
    if (a.size < 2 || !a.city) continue;
    const k = norm(a.city.split(",")[0].split("(")[0].trim());
    const list = byCity.get(k) ?? [];
    list.push({ code: metroOf.get(a.iata) ?? a.iata, size: a.size, country: a.country });
    byCity.set(k, list);
  }
  for (const [k, list] of byCity) {
    // um lugar por país: o maior; vários países = nome ambíguo (ex.: Santiago)
    const best = new Map<string, { code: string; size: number }>();
    for (const x of list.sort((a, b) => b.size - a.size)) if (!best.has(x.country)) best.set(x.country, x);
    const refs = [...best.values()].sort((a, b) => b.size - a.size).map((x) => ref(x.code)).filter((r): r is PlaceRef => !!r);
    if (refs.length) m.set(k, refs);
  }
  for (const [k, code] of Object.entries(CITY_ALIASES)) {
    const r = ref(code);
    if (r) m.set(k, [r]); // apelidos e nomes em português ganham da base
  }
  cityIndex = m;
  return m;
}

/** Códigos IATA aceitos em minúsculas só se não forem palavras comuns (ex.: "for", "mar"). */
const COMMON3 = new Set(["mas", "bom", "mau", "sim", "nao", "pai", "mae", "tia", "avo", "ver", "ter", "ser", "dar", "vir", "ali", "nos", "vos", "oba", "for", "foi", "vai", "tem", "sou", "era", "bem", "boa", "mal", "sol", "mar", "lua", "rua", "paz", "fim", "ano", "seu", "sua", "meu", "mim", "num", "nem", "por", "pra", "pro", "ate", "dez", "uns", "dia", "mes", "ida", "voo", "com", "sem", "que", "sao", "uma", "sai", "via", "mil", "pax", "top", "lis"]);

function codes(): Set<string> {
  if (codeSet) return codeSet;
  codeSet = new Set([...allAirports().filter((a) => a.size >= 2).map((a) => a.iata), ...Object.keys(METRO_AREAS)]);
  return codeSet;
}

// ---------- o parser ----------

export function parse(text: string, ctx: ParseContext): Parsed {
  const today = ctx.today.toISOString().slice(0, 10);
  const [ty, tm, td] = today.split("-").map(Number);
  const original = text;
  // pontuação some, menos ponto/vírgula entre números ("R$ 4.000", "2,5 mil")
  let s = ` ${norm(text).replace(/(?<!\d)[.,]|[.,](?!\d)|[?!;:()"“”'`]/g, " ").replace(/\s+/g, " ").trim()} `;

  const take = (re: RegExp, fn: (m: RegExpExecArray) => boolean | void) => {
    const g = new RegExp(re.source, re.flags.includes("g") ? re.flags : `${re.flags}g`);
    let m: RegExpExecArray | null;
    const spans: [number, number][] = [];
    while ((m = g.exec(s))) {
      if (fn(m) !== false) spans.push([m.index, m.index + m[0].length]);
      if (m[0].length === 0) g.lastIndex++;
    }
    for (const [a, b] of spans.reverse()) s = `${s.slice(0, a)} ${" ".repeat(b - a)} ${s.slice(b)}`;
  };
  const has = (re: RegExp) => re.test(s);

  const out: Parsed = {
    intent: null, origin: null, originFromHome: false, destination: null, departDate: null, returnDate: null, dateWindow: null,
    period: null, duration: null, tripType: null, directOnly: false, maxPrice: null, cabin: null, program: null, followUp: false,
    missing: [], ambiguous: [], assumed: [],
  };

  // quando o mês não tem ano: a próxima ocorrência
  const yearFor = (m: number, d = 1) => (m > tm || (m === tm && d >= td) ? ty : ty + 1);
  const monthOf = (name: string) => MONTHS[name];

  // ---- intenções com palavras-chave (antes de tirar pedaços do texto) ----
  const kw = {
    simulador: has(/milheiro|vale a pena (comprar|transferir)|bonus de transferencia|transferir (pontos|milhas)|custo (do|por) (milheiro|ponto)/),
    parceiros: has(/\bprogramas?\b|parceir|que milhas|quais milhas|com que milhas|emitir com/),
    ajuda: has(/^\s*(oi|ola|ajuda|help|bom dia|boa tarde|boa noite|e ai)\s*$|o que (voce|vc) faz|como (voce|vc) funciona|como funciona/),
    explorar: has(/para onde|pra onde|qualquer lugar|qualquer destino|algum lugar|onde ir|que destino|destinos? (mais )?barat/),
    cheapest: has(/mais barat|baratinh|mais em conta|(melhor|menor) preco|melhor (epoca|mes|periodo|data|janela|dia)|quando (ir|viajar|sai|fica|e) mais barato|qual (o )?mes|que mes|em que mes|epoca|quando e melhor/),
    priceAsk: has(/quanto (fica|custa|esta|sai|ta|e)|preco|passagem|valor/),
  };
  const followMarker = has(/^\s*(e|mas|agora|entao|e se|e pra|e de|e com|e no|e na|e em)\b/);

  // ---- preço máximo ----
  take(/\b(?:ate|no maximo|maximo de|abaixo de|menos de|por menos de|teto de|gastando ate|pagando ate|orcamento de)\s*(?:r\$\s*)?(\d+(?:[.,]\d+)?)\s*(mil|k)?\s*(reais|r\$)?(?!\s*\/)/, (m) => {
    let v = Number(m[1].replace(/\.(?=\d{3}\b)/g, "").replace(",", "."));
    if (m[2]) v *= 1000;
    if (!m[2] && !m[3] && !/r\$/.test(m[0]) && v < 100) return false; // "até 20" é data, não preço
    out.maxPrice = Math.round(v);
  });
  take(/r\$\s*(\d+(?:[.,]\d+)?)\s*(mil|k)?/, (m) => {
    if (out.maxPrice) return false;
    let v = Number(m[1].replace(/\.(?=\d{3}\b)/g, "").replace(",", "."));
    if (m[2]) v *= 1000;
    out.maxPrice = Math.round(v);
  });

  // ---- programa, cabine, direto, tipo de viagem ----
  for (const [name, id] of Object.entries(PROGRAM_NAMES).sort((a, b) => b[0].length - a[0].length)) {
    take(new RegExp(`\\b${name.replace(/[&]/g, "\\$&")}\\b`), () => {
      out.program ??= id;
    });
  }
  take(/\b(classe )?executiva\b|\bbusiness\b/, () => void (out.cabin = "business"));
  take(/\bprimeira classe\b|\bfirst class\b/, () => void (out.cabin = "first"));
  take(/\bpremium( economy)?\b/, () => void (out.cabin = "premium_economy"));
  take(/\b(classe )?economica\b/, () => void (out.cabin = "economy"));
  take(/\b(voos? )?diretos?\b|\bsem escalas?\b|\bsem conexao\b|\bnon stop\b/, () => void (out.directOnly = true));
  take(/\b(so|somente|apenas) (de )?ida\b|\bsem volta\b|\bone way\b|\bida simples\b/, () => void (out.tripType = "ida"));
  take(/\bida e volta\b/, () => void (out.tripType = "ida_e_volta"));

  // ---- épocas: Natal, Réveillon, Carnaval, férias de julho… ----
  take(new RegExp(`\\b(?:no|na|de|o|a|neste|nesse|para o|pro|pelo|durante o|feriado de)\\s+(carnaval)(?:\\s+(?:de\\s+)?(\\d{4}))?\\b`), (m) => {
    const y = m[2] ? Number(m[2]) : (CARNIVAL[ty] && CARNIVAL[ty] >= today ? ty : ty + 1);
    const tue = CARNIVAL[y];
    if (!tue) return false;
    out.dateWindow = { from: addDays(tue, -4), to: addDays(tue, 1) };
  });
  for (const [name, w] of Object.entries(SEASONS).sort((a, b) => b[0].length - a[0].length)) {
    const prefix = name === "natal" ? "(?:no|de|o|neste|nesse|para o|pro|pelo|durante o|feriado de)\\s+" : "(?:no|na|de|o|a|em|neste|nesse|para o|pro|pelo|nas|durante o|durante as)?\\s*";
    take(new RegExp(`\\b${prefix}${name}(?:\\s+(?:de\\s+)?(\\d{4}))?\\b`), (m) => {
      const fy = m[1] ? Number(m[1]) : yearFor(w.from[0], w.from[1]);
      const toY = w.to[0] < w.from[0] ? fy + 1 : fy;
      out.dateWindow = { from: iso(fy, w.from[0], w.from[1]), to: iso(toY, w.to[0], w.to[1]) };
    });
  }

  // ---- períodos relativos (antes da duração, para "daqui a 2 meses" não virar duração) ----
  take(new RegExp(`\\bdaqui a\\s+(${NUM})\\s+(dias|semanas|meses|mes)\\b`), (m) => {
    const n = toNum(m[1]);
    if (m[2] === "dias") out.departDate = addDays(today, n);
    else if (m[2] === "semanas") out.dateWindow = { from: addDays(today, n * 7), to: addDays(today, n * 7 + 6) };
    else out.period = { fromMonth: addMonths(today.slice(0, 7), n), toMonth: addMonths(today.slice(0, 7), n) };
  });
  take(new RegExp(`\\b(?:nos )?proximos\\s+(${NUM})\\s+(meses|dias)\\b`), (m) => {
    const n = toNum(m[1]);
    if (m[2] === "dias") out.dateWindow = { from: today, to: addDays(today, n) };
    else out.period = { fromMonth: today.slice(0, 7), toMonth: addMonths(today.slice(0, 7), n - 1) };
  });
  take(/\b(?:nos )?proximos meses\b/, () => void (out.period = { fromMonth: today.slice(0, 7), toMonth: addMonths(today.slice(0, 7), 5) }));

  // ---- duração ----
  const unit = (u: string) => (u.startsWith("semana") ? 7 : u.startsWith("mes") ? 30 : 1);
  take(new RegExp(`\\b(?:entre|de)?\\s*(${NUM})\\s*(?:a|ou|-|e)\\s*(${NUM})\\s*(dias|semanas|meses)\\b`), (m) => {
    const u = unit(m[3]);
    const a = toNum(m[1]) * u;
    const b = toNum(m[2]) * u;
    if (!a || !b) return false;
    out.duration = { min: Math.min(a, b), max: Math.max(a, b) };
  });
  take(new RegExp(`\\b(?:por|durante|uns|umas|cerca de|ficar|fico|ficando)?\\s*(${NUM}|um|uma)\\s+(dias|dia|semanas|semana|meses|mes)\\b`), (m) => {
    if (out.duration) return false;
    const n = toNum(m[1]);
    if (!n) return false;
    const d = n * unit(m[2]);
    // "uma semana" = de 6 a 9 dias; "2 semanas" = de 13 a 16; "15 dias" = exato
    out.duration = m[2].startsWith("semana") ? { min: d - 1, max: d + 2 } : m[2].startsWith("mes") ? { min: d - 2, max: d + 1 } : { min: d, max: d };
  });

  // ---- fins de semana e semanas ----
  const nextWeekday = (wd: number, from = today) => {
    const t = new Date(`${from}T12:00:00Z`);
    const diff = (wd - t.getUTCDay() + 7) % 7 || 7;
    return addDays(from, diff);
  };
  take(/\b(?:(?:neste|nesse|este|esse|o|no|proximo)\s+)?fim de semana(?:\s+que vem)?\b|\bfinal de semana\b/, (m) => {
    const fri = nextWeekday(5, addDays(today, -1));
    const nextOne = /proximo|que vem/.test(m[0]);
    const start = nextOne && fri <= addDays(today, 2) ? addDays(fri, 7) : fri;
    out.dateWindow ??= { from: start, to: addDays(start, 1) };
  });
  take(/\b(?:semana que vem|proxima semana)\b/, () => {
    const mon = nextWeekday(1);
    out.dateWindow ??= { from: mon, to: addDays(mon, 6) };
  });
  take(/\b(?:mes que vem|proximo mes)\b/, () => {
    const next = addMonths(today.slice(0, 7), 1);
    out.period ??= { fromMonth: next, toMonth: next };
  });

  // ---- datas ----
  const setDate = (d: string, role: "ida" | "volta" | null) => {
    if (role === "volta" || (role === null && out.departDate && !out.returnDate)) out.returnDate = d;
    else out.departDate ??= d;
  };
  const roleOf = (prefix: string | undefined) => (prefix && /volt|retorn|regress/.test(prefix) ? "volta" : prefix && /\bida\b|indo|saindo|partindo/.test(prefix) ? "ida" : null);
  const PRE = `((?:\\b(?:ida|indo|saindo|partindo|volta|voltando|retorno|retornando|regresso)\\b\\s*(?:no|em|dia|de|na)?\\s*)?)`;

  // intervalos: "de 1 a 4 de dezembro", "10/12 a 20/12", "do dia 3 ao dia 18 de março"
  take(new RegExp(`\\b(?:de|do dia|entre os dias|entre|dia|dos dias)?\\s*(\\d{1,2})(?:\\/(\\d{1,2}))?\\s*(?:a|ao dia|ate o dia|ate|e|-)\\s*(?:dia\\s*)?(\\d{1,2})(?:\\/(\\d{1,2}))?(?:\\/(\\d{2,4}))?(?:\\s+de\\s+(${MONTH_RE}))?(?:\\s+(?:de\\s+)?(\\d{4}))?\\b`), (m) => {
    const d1 = Number(m[1]);
    const d2 = Number(m[3]);
    const month2 = m[4] ? Number(m[4]) : m[6] ? monthOf(m[6]) : null;
    if (!month2) return false; // sem mês: não é data (ex.: "1 a 2" solto)
    const month1 = m[2] ? Number(m[2]) : month2;
    const y1 = m[7] ? Number(m[7]) : m[5] ? Number(m[5].length === 2 ? `20${m[5]}` : m[5]) : yearFor(month1, d1);
    let y2 = y1 + (month2 < month1 ? 1 : 0);
    if (!validDate(y1, month1, d1) || !validDate(y2, month2, d2)) return false;
    out.departDate = iso(y1, month1, d1);
    out.returnDate = iso(y2, month2, d2);
    if (out.returnDate < out.departDate) {
      y2 += 1;
      out.returnDate = iso(y2, month2, d2);
    }
  });
  // dd/mm(/aaaa)
  take(new RegExp(`${PRE}\\b(\\d{1,2})\\/(\\d{1,2})(?:\\/(\\d{2,4}))?\\b`), (m) => {
    const d = Number(m[2]);
    const mo = Number(m[3]);
    const y = m[4] ? Number(m[4].length === 2 ? `20${m[4]}` : m[4]) : yearFor(mo, d);
    if (!validDate(y, mo, d)) return false;
    setDate(iso(y, mo, d), roleOf(m[1]));
  });
  // "10 de dezembro (de 2026)", "dia 10 de dez"
  take(new RegExp(`${PRE}\\b(?:dia\\s+)?(\\d{1,2})\\s+de\\s+(${MONTH_RE})(?:\\s+(?:de\\s+)?(\\d{4}))?\\b`), (m) => {
    const d = Number(m[2]);
    const mo = monthOf(m[3]);
    const y = m[4] ? Number(m[4]) : yearFor(mo, d);
    if (!validDate(y, mo, d)) return false;
    setDate(iso(y, mo, d), roleOf(m[1]));
  });
  // hoje, amanhã, depois de amanhã
  take(new RegExp(`${PRE}\\b(depois de amanha|amanha|hoje)\\b`), (m) => {
    setDate(addDays(today, m[2] === "hoje" ? 0 : m[2] === "amanha" ? 1 : 2), roleOf(m[1]));
  });
  // "na sexta", "proximo sabado"
  take(new RegExp(`${PRE}\\b(?:(?:na|no|nessa|nesse|proxima|proximo|esta|este)\\s+)?(domingo|segunda|terca|quarta|quinta|sexta|sabado)(?:-feira)?(?:\\s+que vem)?\\b`), (m) => {
    setDate(nextWeekday(WEEKDAYS[m[2]]), roleOf(m[1]));
  });

  // ---- meses e anos ----
  const monthYear = (name: string, y?: string) => {
    const mo = monthOf(name);
    const yy = y ? Number(y) : yearFor(mo, lastDay(ty, mo));
    return ym(yy, mo);
  };
  take(new RegExp(`\\b(inicio|comeco|meados|meio|fim|final) de (${MONTH_RE})(?:\\s+(?:de\\s+)?(\\d{4}))?\\b`), (m) => {
    const month = monthYear(m[2], m[3]);
    const [yy, mo] = month.split("-").map(Number);
    const [a, b] = /inicio|comeco/.test(m[1]) ? [1, 10] : /meados|meio/.test(m[1]) ? [10, 20] : [20, lastDay(yy, mo)];
    out.dateWindow = { from: iso(yy, mo, a), to: iso(yy, mo, b) };
  });
  take(new RegExp(`\\b(?:entre|de|do|desde)\\s+(${MONTH_RE})(?:\\s+(?:de\\s+)?(\\d{4}))?\\s+(?:e|a|ate|ao|ou)\\s+(${MONTH_RE})(?:\\s+(?:de\\s+)?(\\d{4}))?\\b`), (m) => {
    const from = monthYear(m[1], m[2] ?? m[4]);
    let to = monthYear(m[3], m[4]);
    if (to < from) to = addMonths(to, 12);
    out.period = { fromMonth: from, toMonth: to };
  });
  take(new RegExp(`\\b(${MONTH_RE})\\s+ou\\s+(${MONTH_RE})(?:\\s+(?:de\\s+)?(\\d{4}))?\\b`), (m) => {
    const from = monthYear(m[1], m[3]);
    let to = monthYear(m[2], m[3]);
    if (to < from) to = addMonths(to, 12);
    out.period = { fromMonth: from, toMonth: to };
  });
  take(/\b(1o|1|primeiro)\s*semestre(?:\s+(?:de\s+)?(\d{4}))?\b/, (m) => {
    const y = m[2] ? Number(m[2]) : tm <= 6 ? ty : ty + 1;
    out.period = { fromMonth: ym(y, 1), toMonth: ym(y, 6) };
  });
  take(/\b(2o|2|segundo)\s*semestre(?:\s+(?:de\s+)?(\d{4}))?\b/, (m) => {
    // sem ano e já perto do fim do ano: o 2º semestre que interessa é o do ano seguinte
    const y = m[2] ? Number(m[2]) : tm >= 10 ? ty + 1 : ty;
    out.period = { fromMonth: ym(y, 7), toMonth: ym(y, 12) };
  });
  take(/\b(?:ano que vem|proximo ano)\b/, () => void (out.period = { fromMonth: ym(ty + 1, 1), toMonth: ym(ty + 1, 12) }));
  take(new RegExp(`\\b(?:em|no mes de|mes de|para|pra|de)?\\s*(${MONTH_RE})(?:\\s*(?:de|\\/)\\s*(\\d{2,4}))?\\b`), (m) => {
    if (AMBIGUOUS_MONTH_ABBR.has(m[1]) && !m[2]) return false; // "mar", "dez", "set" soltos não são mês
    const y = m[2] ? (m[2].length === 2 ? `20${m[2]}` : m[2]) : undefined;
    const month = monthYear(m[1], y);
    if (out.period) out.period = { fromMonth: out.period.fromMonth < month ? out.period.fromMonth : month, toMonth: out.period.toMonth > month ? out.period.toMonth : month };
    else out.period = { fromMonth: month, toMonth: month };
  });
  take(/\b(?:em|no ano de|ano de|para|pra|de)?\s*(20\d{2})\b/, (m) => {
    const y = Number(m[1]);
    if (out.period || out.departDate) return false;
    out.period = { fromMonth: ym(y, 1), toMonth: ym(y, 12) };
  });
  // "dia 10" sem mês: o mês do período citado ou a próxima ocorrência do dia
  take(new RegExp(`${PRE}\\bdia\\s+(\\d{1,2})\\b`), (m) => {
    const d = Number(m[2]);
    const role = roleOf(m[1]);
    let y = ty;
    let mo = tm;
    const anchor = out.departDate ?? ctx.previous?.departDate ?? null;
    if ((role === "volta" || (role === null && out.departDate)) && anchor) {
      [y, mo] = anchor.split("-").map(Number);
      if (iso(y, mo, Math.min(d, lastDay(y, mo))) <= anchor) [y, mo] = addMonths(anchor.slice(0, 7), 1).split("-").map(Number);
    } else if (out.period && out.period.fromMonth === out.period.toMonth) [y, mo] = out.period.fromMonth.split("-").map(Number);
    else if (d < td) [y, mo] = addMonths(today.slice(0, 7), 1).split("-").map(Number);
    if (!validDate(y, mo, d)) return false;
    setDate(iso(y, mo, d), role);
    if (out.period && out.period.fromMonth === out.period.toMonth) out.period = null;
  });

  // ---- cidades (no que sobrou do texto) ----
  const tokens = s.split(/\s+/).filter(Boolean);
  type Hit = { start: number; end: number; options: PlaceRef[]; text: string };
  const hits: Hit[] = [];
  const idx = cities();
  const iata = codes();
  for (let i = 0; i < tokens.length; i++) {
    let found: Hit | null = null;
    for (let n = Math.min(4, tokens.length - i); n >= 1 && !found; n--) {
      const phrase = tokens.slice(i, i + n).join(" ");
      if (n === 1 && STOPWORDS.has(phrase)) continue;
      if (n === 1 && phrase.length < 3 && !CITY_ALIASES[phrase]) continue;
      const opts = idx.get(phrase);
      if (opts) found = { start: i, end: i + n, options: opts, text: phrase };
      else if (n === 1 && phrase.length === 3) {
        const code = phrase.toUpperCase();
        const upperInOriginal = new RegExp(`\\b${code}\\b`).test(original);
        if (iata.has(code) && (upperInOriginal || !COMMON3.has(phrase))) {
          const r = ref(code);
          if (r) found = { start: i, end: i + 1, options: [r], text: phrase };
        }
      }
    }
    if (found) {
      hits.push(found);
      i = found.end - 1;
    }
  }
  const ORIGIN_MARK = new Set(["de", "do", "da", "saindo", "partindo", "desde", "origem"]);
  const DEST_MARK = new Set(["para", "pra", "pro", "p", "ate", "a", "em", "destino", "rumo", "conhecer", "visitar", "ir"]);
  const roles = hits.map((h) => {
    const prev = tokens[h.start - 1] ?? "";
    const prev2 = tokens[h.start - 2] ?? "";
    if (ORIGIN_MARK.has(prev) || ORIGIN_MARK.has(prev2) && prev === "de") return "origem" as const;
    if (DEST_MARK.has(prev)) return "destino" as const;
    return null;
  });
  const assign = (h: Hit, field: "origem" | "destino") => {
    if (h.options.length > 1) out.ambiguous.push({ field, text: h.text, options: h.options });
    const r = h.options[0];
    if (field === "origem") out.origin ??= r;
    else out.destination ??= r;
  };
  hits.forEach((h, i) => roles[i] && assign(h, roles[i]!));
  const free = hits.filter((_, i) => !roles[i]);
  if (free.length) {
    if (!out.destination && !out.origin && free.length >= 2) {
      assign(free[0], "origem");
      assign(free[1], "destino");
    } else if (!out.destination) assign(free[0], "destino");
    else if (!out.origin) assign(free[0], "origem");
  }

  // ---- conversa: "e se for em julho?" herda o pedido anterior ----
  const prev = ctx.previous ?? null;
  const gotSomething = !!(out.departDate || out.returnDate || out.period || out.dateWindow || out.duration || out.directOnly || out.maxPrice || out.cabin || out.program || out.tripType);
  const newTopic = kw.simulador || kw.parceiros || kw.ajuda || kw.explorar;
  const shortTweak = !hits.length && gotSomething && tokens.length <= 6;
  if (prev && !newTopic && (followMarker || shortTweak)) {
    out.followUp = true;
    const newTime = !!(out.departDate || out.period || out.dateWindow);
    out.origin ??= prev.origin;
    out.originFromHome = !hits.some((_, i) => roles[i] === "origem") && prev.originFromHome && out.origin === prev.origin;
    out.destination ??= prev.destination;
    if (!newTime) {
      out.departDate = prev.departDate;
      out.returnDate ??= prev.returnDate;
      out.period = prev.period;
      out.dateWindow = prev.dateWindow;
    }
    // trocou a época de uma busca com datas: mantém a duração da viagem anterior
    if (newTime && !out.departDate && !out.duration && prev.departDate && prev.returnDate) {
      const days = Math.round((Date.parse(prev.returnDate) - Date.parse(prev.departDate)) / 86_400_000);
      out.duration = { min: days, max: days };
    }
    out.duration ??= prev.duration;
    out.tripType ??= out.returnDate ? "ida_e_volta" : prev.tripType;
    out.directOnly ||= prev.directOnly;
    out.maxPrice ??= prev.maxPrice;
    out.cabin ??= prev.cabin;
    out.program ??= prev.program;
  }

  // ---- intenção ----
  const specificDate = !!out.departDate;
  if (kw.simulador) out.intent = "simulador";
  else if (kw.parceiros && !specificDate) out.intent = "parceiros";
  else if (kw.ajuda && !hits.length && !gotSomething) out.intent = "ajuda";
  else if (!out.destination && kw.explorar) out.intent = "explorar";
  else if (specificDate) out.intent = "buscar";
  else if ((out.period || out.dateWindow) && (out.duration || (kw.cheapest && out.tripType !== "ida") || out.tripType === "ida_e_volta")) out.intent = "ferias";
  else if (out.period || out.dateWindow) {
    // "em janeiro", "semana que vem", "no Natal" sem duração: o dia mais barato para ir
    out.intent = "buscar";
    if (!out.dateWindow && out.period) {
      const [ly, lm] = out.period.toMonth.split("-").map(Number);
      const from = `${out.period.fromMonth}-01`;
      out.dateWindow = { from: from < today ? today : from, to: iso(ly, lm, lastDay(ly, lm)) };
    }
  } else if (out.duration || kw.cheapest) out.intent = "ferias";
  else if (kw.priceAsk || out.destination) out.intent = out.destination && prev?.intent && out.followUp ? prev.intent : "buscar";
  else if (out.followUp && prev) out.intent = prev.intent;
  else if (hits.length) out.intent = "buscar"; // só a cidade ("voos de vitória"): pergunta o resto

  // ---- origem padrão, tipo de viagem, o que falta ----
  if (!out.origin && ctx.home && out.intent !== "simulador" && out.intent !== "ajuda") {
    out.origin = ref(ctx.home);
    out.originFromHome = !!out.origin;
  }
  if (out.returnDate) out.tripType = "ida_e_volta";
  if (out.intent === "buscar" && !out.tripType) {
    out.tripType = "ida";
    out.assumed.push("só ida");
  }
  if (out.origin && out.destination && out.origin.code === out.destination.code) out.destination = null;

  const needsRoute = out.intent === "buscar" || out.intent === "ferias";
  if ((needsRoute || out.intent === "explorar") && !out.origin) out.missing.push("origem");
  if (needsRoute && !out.destination) out.missing.push("destino");
  if (out.intent === "buscar" && !out.departDate && !out.dateWindow) out.missing.push("data");
  if (out.intent === "ferias") {
    if (!out.period && !out.dateWindow) {
      out.period = { fromMonth: today.slice(0, 7), toMonth: addMonths(today.slice(0, 7), 5) };
      out.assumed.push("próximos 6 meses");
    }
    if (!out.duration) {
      out.duration = { min: 14, max: 21 };
      out.assumed.push("de 14 a 21 dias");
    }
  }
  if (out.intent === "explorar") {
    if (!out.period && !out.dateWindow) {
      out.period = { fromMonth: today.slice(0, 7), toMonth: addMonths(today.slice(0, 7), 5) };
      out.assumed.push("próximos 6 meses");
    }
    if (!out.duration) {
      out.duration = { min: 6, max: 9 };
      out.assumed.push("1 semana");
    }
  }
  if (out.intent === null && !hits.length && !gotSomething) out.intent = null;
  return out;
}
