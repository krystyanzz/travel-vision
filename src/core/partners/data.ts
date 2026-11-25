// Parcerias de RESGATE (emitir passagem com milhas/pontos do programa).
// Não é o mesmo que aliança: estar na mesma aliança não garante resgate, e
// parceiras só de acúmulo ou vendidas em interline não entram aqui.
//
// Cada linha diz de onde veio a informação. Só "oficial" e "secundaria" contam
// como parceria; "conflito" aparece com aviso e não entra nas contas.
// Pesquisa feita em 2026-11-02; revisar a cada mudança anunciada pelos programas.

export type PartnerEvidence = "oficial" | "secundaria" | "conflito";

export interface LoyaltyProgram {
  id: string;
  name: string;
  /** Companhia dona do programa (IATA), quando houver. */
  ownerAirline: string | null;
  /** Aliança da companhia dona: contexto apenas, nunca prova de resgate. */
  alliance: "Star Alliance" | "oneworld" | "SkyTeam" | null;
  officialPartnersUrl: string;
  /** Como o resgate em parceiras funciona na prática. */
  howToRedeem: string;
  /** false = lista de parceiras ainda não conferida; nenhuma parceria é exibida como confirmada. */
  partnersReviewed: boolean;
}

export interface RedemptionPartner {
  program: string;
  airline: string; // IATA
  evidence: PartnerEvidence;
  source: string; // URL
  checkedAt: string; // AAAA-MM-DD
  note?: string;
}

export const AIRLINE_NAMES: Record<string, string> = {
  G3: "GOL", LA: "LATAM", AD: "Azul", AV: "Avianca", AA: "American Airlines", AF: "Air France", KL: "KLM",
  AR: "Aerolíneas Argentinas", AC: "Air Canada", AM: "Aeroméxico", CM: "Copa Airlines", EK: "Emirates",
  UX: "Air Europa", TK: "Turkish Airlines", TP: "TAP Air Portugal", QR: "Qatar Airways", SA: "South African Airways",
  IB: "Iberia", AZ: "ITA Airways", BA: "British Airways", ET: "Ethiopian Airlines", NH: "All Nippon Airways",
  DL: "Delta Air Lines", AS: "Alaska Airlines", OS: "Austrian Airlines", CX: "Cathay Pacific", AY: "Finnair",
  JL: "Japan Airlines", LH: "Lufthansa", QF: "Qantas", RJ: "Royal Jordanian", LX: "SWISS", EY: "Etihad Airways",
  UA: "United Airlines", VS: "Virgin Atlantic", JJ: "LATAM Brasil", "2Z": "Voepass", H2: "SKY Airline", JA: "JetSMART",
  WJ: "JetSMART Argentina", "2F": "Azul Conecta",
  NI: "Portugália", FR: "Ryanair", U2: "easyJet", VY: "Vueling", EI: "Aer Lingus", S4: "Azores Airlines", SN: "Brussels Airlines",
  LO: "LOT", SK: "SAS", A3: "Aegean", EW: "Eurowings", W6: "Wizz Air", AT: "Royal Air Maroc", DT: "TAAG", KQ: "Kenya Airways",
};

/** Códigos que a malha usa para a mesma companhia (ex.: LATAM Brasil opera como JJ). */
export const AIRLINE_ALIASES: Record<string, string> = { JJ: "LA", "2F": "AD" };

export const LOYALTY_PROGRAMS: LoyaltyProgram[] = [
  {
    id: "smiles", name: "Smiles", ownerAirline: "G3", alliance: null,
    officialPartnersUrl: "https://www.smiles.com.br/portal/companhias-aereas-parceiras",
    howToRedeem: "Busca no site ou app da Smiles; a disponibilidade em parceiras depende do assento-prêmio liberado pela operadora.",
    partnersReviewed: true,
  },
  {
    id: "latampass", name: "LATAM Pass", ownerAirline: "LA", alliance: null,
    officialPartnersUrl: "https://latampass.latam.com/pt_br/companhias-aereas-parceiras",
    howToRedeem: "Voos LATAM no site (preço dinâmico). Parceiras pela tabela fixa via Central de Vendas (WhatsApp); não aparecem no buscador comum.",
    partnersReviewed: true,
  },
  {
    id: "azul", name: "Azul Fidelidade", ownerAirline: "AD", alliance: null,
    officialPartnersUrl: "https://www.voeazul.com.br/br/pt/programa-fidelidade",
    howToRedeem: "Parceiras pelo Azul Pelo Mundo; só é possível emitir quando a busca encontra assento-prêmio.",
    partnersReviewed: true,
  },
  { id: "tap", name: "TAP Miles&Go", ownerAirline: "TP", alliance: "Star Alliance", officialPartnersUrl: "https://www.flytap.com/pt-br/miles-and-go", howToRedeem: "Site da TAP.", partnersReviewed: false },
  { id: "iberia", name: "Iberia Club", ownerAirline: "IB", alliance: "oneworld", officialPartnersUrl: "https://www.iberia.com/br/iberia-club/", howToRedeem: "Site da Iberia.", partnersReviewed: false },
  { id: "aeroplan", name: "Air Canada Aeroplan", ownerAirline: "AC", alliance: "Star Alliance", officialPartnersUrl: "https://www.aircanada.com/aeroplan", howToRedeem: "Site da Air Canada.", partnersReviewed: false },
  { id: "united", name: "United MileagePlus", ownerAirline: "UA", alliance: "Star Alliance", officialPartnersUrl: "https://www.united.com/en/us/fly/mileageplus/airline-partners.html", howToRedeem: "Site da United.", partnersReviewed: false },
  { id: "aadvantage", name: "American Airlines AAdvantage", ownerAirline: "AA", alliance: "oneworld", officialPartnersUrl: "https://www.aa.com/i18n/aadvantage-program/miles/partners/airline/airline-partners.jsp", howToRedeem: "Site da American Airlines.", partnersReviewed: false },
  { id: "lifemiles", name: "LifeMiles", ownerAirline: "AV", alliance: "Star Alliance", officialPartnersUrl: "https://www.lifemiles.com", howToRedeem: "Site da LifeMiles.", partnersReviewed: false },
  { id: "flyingblue", name: "Flying Blue", ownerAirline: "AF", alliance: "SkyTeam", officialPartnersUrl: "https://www.flyingblue.com", howToRedeem: "Site da Air France-KLM.", partnersReviewed: false },
];

const SMILES_PAGE = "https://www.smiles.com.br/portal/companhias-aereas-parceiras";
const LATAM_GUIDE = "https://cartoeseviagens.com.br/companhias-parceiras-latam-pass";
const AZUL_GUIDE = "https://cartoeseviagens.com.br/companhias-parceiras-da-azul";

const rows = (program: string, airlines: string[], evidence: PartnerEvidence, source: string, note?: string): RedemptionPartner[] =>
  airlines.map((airline) => ({ program, airline, evidence, source, checkedAt: "2026-11-02", note }));

export const REDEMPTION_PARTNERS: RedemptionPartner[] = [
  // Página oficial: as parceiras listadas permitem "resgatar passagens"; regras por companhia em páginas próprias.
  ...rows("smiles", ["G3", "AV", "AA", "AF", "KL", "AR", "AC", "AM", "CM", "EK", "UX", "TK", "TP", "QR", "SA", "IB", "AZ", "BA", "ET", "NH"], "oficial", SMILES_PAGE),
  // Guia verificado em 09/2026 (a página oficial não traz a lista completa de resgate).
  ...rows("latampass", ["LA"], "oficial", "https://www.latam.com"),
  ...rows("latampass", ["DL", "AM", "OS", "BA", "CX", "AY", "IB", "JL", "LH", "QF", "QR", "RJ", "LX"], "secundaria", LATAM_GUIDE),
  ...rows("latampass", ["AS"], "conflito", "https://www.panrotas.com.br/aviacao/parcerias/2025/09/latam-e-alaska-airlines-anunciam-fim-da-parceria-em-outubro_221042.html", "Fim da parceria anunciado em 09/2025; um guia de 09/2026 ainda a lista."),
  ...rows("latampass", ["VS", "AR"], "conflito", LATAM_GUIDE, "Parceira de acúmulo; resgate não confirmado na página brasileira."),
  ...rows("azul", ["AD"], "oficial", "https://www.voeazul.com.br"),
  ...rows("azul", ["AC", "CM", "EK", "EY", "TP", "TK", "UA"], "secundaria", AZUL_GUIDE, "Lista oficial de 7 parceiras citada pelo guia; listas maiores são inventário comercial, não resgate."),
];
