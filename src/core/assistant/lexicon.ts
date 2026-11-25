// Vocabulário do assistente: tudo normalizado (minúsculas, sem acento).

export const norm = (s: string) =>
  s
    .replace(/º/g, "o")
    .replace(/ª/g, "a")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

export const MONTHS: Record<string, number> = {
  janeiro: 1, jan: 1, fevereiro: 2, fev: 2, marco: 3, mar: 3, abril: 4, abr: 4, maio: 5, mai: 5, junho: 6, jun: 6,
  julho: 7, jul: 7, agosto: 8, ago: 8, setembro: 9, set: 9, outubro: 10, out: 10, novembro: 11, nov: 11, dezembro: 12, dez: 12,
};
/** Abreviações de mês que também são palavras comuns: só valem perto de um número ("10 de set", "set/27"). */
export const AMBIGUOUS_MONTH_ABBR = new Set(["mar", "set", "out", "dez", "mai"]);

export const NUMBER_WORDS: Record<string, number> = {
  um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10,
  onze: 11, doze: 12, treze: 13, quatorze: 14, catorze: 14, quinze: 15, dezesseis: 16, dezessete: 17, dezoito: 18,
  dezenove: 19, vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50,
};

/**
 * Nomes em português, apelidos e grafias comuns → código (cidade com vários aeroportos ou aeroporto).
 * Têm prioridade sobre a base de aeroportos (que usa nomes em inglês para cidades de fora).
 */
export const CITY_ALIASES: Record<string, string> = {
  // Brasil
  "sao paulo": "SAO", sampa: "SAO", sp: "SAO", guarulhos: "GRU", congonhas: "CGH", viracopos: "VCP", campinas: "VCP",
  "rio de janeiro": "RIO", rio: "RIO", rj: "RIO", galeao: "GIG", "santos dumont": "SDU",
  "belo horizonte": "BHZ", bh: "BHZ", confins: "CNF",
  brasilia: "BSB", df: "BSB", salvador: "SSA", recife: "REC", fortaleza: "FOR", "porto alegre": "POA", poa: "POA",
  curitiba: "CWB", florianopolis: "FLN", floripa: "FLN", vitoria: "VIX", "vitoria da conquista": "VDC", manaus: "MAO",
  belem: "BEL", goiania: "GYN", cuiaba: "CGB", "campo grande": "CGR", maceio: "MCZ", "joao pessoa": "JPA", aracaju: "AJU",
  teresina: "THE", "sao luis": "SLZ", "porto seguro": "BPS", ilheus: "IOS", navegantes: "NVT", "foz do iguacu": "IGU",
  foz: "IGU", londrina: "LDB", maringa: "MGF", uberlandia: "UDI", "ribeirao preto": "RAO", "porto velho": "PVH",
  macapa: "MCP", "rio branco": "RBR", "boa vista": "BVB", palmas: "PMW", "juazeiro do norte": "JDO", "fernando de noronha": "FEN",
  noronha: "FEN", "jericoacoara": "JJD", jeri: "JJD", "porto de galinhas": "REC", "chapeco": "XAP", joinville: "JOI",
  "caxias do sul": "CXJ", "montes claros": "MOC", "governador valadares": "GVR", "imperatriz": "IMP", santarem: "STM",
  // Exterior
  lisboa: "LIS", porto: "OPO", madri: "MAD", madrid: "MAD", barcelona: "BCN", paris: "PAR", londres: "LON", roma: "ROM",
  milao: "MIL", veneza: "VCE", florenca: "FLR", berlim: "BER", frankfurt: "FRA", munique: "MUC", amsterda: "AMS", amsterdam: "AMS",
  bruxelas: "BRU", zurique: "ZRH", genebra: "GVA", viena: "VIE", praga: "PRG", atenas: "ATH", istambul: "IST", dublin: "DUB",
  "nova york": "NYC", "nova iorque": "NYC", ny: "NYC", miami: "MIA", orlando: "MCO", "fort lauderdale": "FLL",
  "los angeles": "LAX", "san francisco": "SFO", "las vegas": "LAS", chicago: "CHI", washington: "WAS", boston: "BOS",
  houston: "IAH", dallas: "DFW", atlanta: "ATL", toronto: "YYZ", montreal: "YUL", vancouver: "YVR",
  "cidade do mexico": "MEX", cancun: "CUN", "buenos aires": "BUE", santiago: "SCL", "santiago do chile": "SCL", lima: "LIM",
  bogota: "BOG", montevideu: "MVD", "punta del este": "PDP", assuncao: "ASU", "la paz": "LPB", cusco: "CUZ", cartagena: "CTG",
  medellin: "MDE", panama: "PTY", "cidade do panama": "PTY", "punta cana": "PUJ", havana: "HAV", "san andres": "ADZ",
  bariloche: "BRC", mendoza: "MDZ", ushuaia: "USH", "el calafate": "FTE", dubai: "DXB", doha: "DOH", "abu dhabi": "AUH",
  toquio: "TYO", "cidade do cabo": "CPT", joanesburgo: "JNB", "tel aviv": "TLV", cairo: "CAI", marrakech: "RAK",
  sydney: "SYD", melbourne: "MEL", bangkok: "BKK", singapura: "SIN", "hong kong": "HKG", seul: "ICN", pequim: "BJS",
  xangai: "SHA", "nova delhi": "DEL", maldivas: "MLE", "cidade da guatemala": "GUA",
};
CITY_ALIASES.pequim = "PEK";

/** Nome em português (com acento) para cidades de fora; as brasileiras já vêm certas da base. */
export const PT_LABELS: Record<string, string> = {
  LIS: "Lisboa", OPO: "Porto", MAD: "Madri", BCN: "Barcelona", PAR: "Paris", LON: "Londres", ROM: "Roma", MIL: "Milão",
  VCE: "Veneza", FLR: "Florença", BER: "Berlim", MUC: "Munique", AMS: "Amsterdã", BRU: "Bruxelas", ZRH: "Zurique",
  GVA: "Genebra", VIE: "Viena", PRG: "Praga", ATH: "Atenas", IST: "Istambul", DUB: "Dublin", NYC: "Nova York",
  WAS: "Washington", CHI: "Chicago", MEX: "Cidade do México", CUN: "Cancún", BUE: "Buenos Aires", SCL: "Santiago",
  BOG: "Bogotá", MVD: "Montevidéu", ASU: "Assunção", PTY: "Cidade do Panamá", HAV: "Havana", TYO: "Tóquio",
  CPT: "Cidade do Cabo", JNB: "Joanesburgo", CAI: "Cairo", SIN: "Singapura", HKG: "Hong Kong", ICN: "Seul", PEK: "Pequim",
  SHA: "Xangai", DEL: "Nova Délhi", MLE: "Maldivas", DXB: "Dubai", DOH: "Doha", AUH: "Abu Dhabi", MCO: "Orlando",
  MIA: "Miami", YYZ: "Toronto", LIM: "Lima", BRC: "Bariloche", CTG: "Cartagena", PUJ: "Punta Cana",
};

/** Feriados e épocas (o ano é decidido pela próxima ocorrência). */
export const SEASONS: Record<string, { from: [number, number]; to: [number, number] }> = {
  natal: { from: [12, 20], to: [12, 26] },
  reveillon: { from: [12, 26], to: [1, 3] },
  "ano novo": { from: [12, 26], to: [1, 3] },
  "fim de ano": { from: [12, 18], to: [1, 5] },
  "ferias de julho": { from: [7, 1], to: [7, 31] },
  "ferias de janeiro": { from: [1, 1], to: [1, 31] },
  "ferias de verao": { from: [12, 15], to: [2, 28] },
  pascoa: { from: [3, 25], to: [4, 25] },
};
/** Carnaval: data da terça-feira; a janela vai de sexta a quarta de cinzas. */
export const CARNIVAL: Record<number, string> = { 2026: "2026-02-17", 2027: "2027-02-09", 2028: "2028-02-29", 2029: "2029-02-13" };

/** Palavras que nunca são cidade quando aparecem sozinhas. */
export const STOPWORDS = new Set([
  "de", "da", "do", "das", "dos", "em", "no", "na", "nos", "nas", "para", "pra", "pro", "a", "o", "e", "ou", "um", "uma",
  "com", "sem", "ate", "dia", "dias", "mes", "meses", "ano", "voo", "voos", "ida", "volta", "mais", "menos", "barato", "mas",
  "bom", "boa", "oi", "ola", "obrigado", "obrigada", "valeu", "sim", "nao", "tudo", "bem", "isso", "esse", "essa", "ai",
  "barata", "quanto", "qual", "quais", "quero", "ir", "ficar", "viagem", "passagem", "passagens", "sao", "que", "se", "me",
  "eu", "the", "por", "pelo", "pela", "agora", "hoje", "amanha", "semana", "semanas", "fim", "direto", "escala",
]);

export const PROGRAM_NAMES: Record<string, string> = {
  smiles: "smiles", "latam pass": "latampass", latampass: "latampass", "azul fidelidade": "azul", tudoazul: "azul",
  "tudo azul": "azul", "tap miles": "tap", "miles&go": "tap", "iberia club": "iberia", aeroplan: "aeroplan",
  mileageplus: "united", aadvantage: "aadvantage", lifemiles: "lifemiles", "flying blue": "flyingblue",
};
