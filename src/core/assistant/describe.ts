import type { Missing, Parsed } from "./parse";

// Textos do assistente: o resumo do que entendeu ("Entendi: …") e a pergunta do que falta.

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const day = (d: string) => `${Number(d.slice(8))}/${d.slice(5, 7)}`;
const month = (m: string) => `${MONTHS[Number(m.slice(5)) - 1]}/${m.slice(0, 4)}`;
const range = (a: number, b: number) => (a === b ? `${a} dias` : `${a} a ${b} dias`);

export function summary(p: Parsed): string {
  const parts: string[] = [];
  if (p.intent === "simulador") return "Entendi: cálculo do custo do milheiro.";
  if (p.intent === "ajuda") return "";
  const route = `${p.origin?.label ?? "?"} → ${p.destination?.label ?? (p.intent === "explorar" ? "qualquer destino" : "?")}`;
  parts.push(p.intent === "parceiros" ? `programas que levam a ${p.destination?.label ?? "?"}` : route);
  if (p.departDate) parts.push(p.returnDate ? `${day(p.departDate)} a ${day(p.returnDate)}` : day(p.departDate));
  else if (p.dateWindow) parts.push(`entre ${day(p.dateWindow.from)} e ${day(p.dateWindow.to)}`);
  else if (p.period) parts.push(p.period.fromMonth === p.period.toMonth ? month(p.period.fromMonth) : `${month(p.period.fromMonth)} a ${month(p.period.toMonth)}`);
  if (p.intent === "ferias" || p.intent === "explorar") {
    if (p.duration) parts.push(`ficando ${range(p.duration.min, p.duration.max)}`);
  } else if (p.intent === "buscar") parts.push(p.tripType === "ida_e_volta" ? "ida e volta" : "só ida");
  if (p.directOnly) parts.push("só direto");
  if (p.maxPrice) parts.push(`até R$ ${p.maxPrice.toLocaleString("pt-BR")}`);
  if (p.cabin && p.cabin !== "economy") parts.push(p.cabin === "business" ? "executiva" : p.cabin === "first" ? "primeira classe" : "premium");
  if (p.program) parts.push(`com milhas (${p.program})`);
  return `Entendi: ${parts.join(" · ")}`;
}

const QUESTIONS: Record<Missing, string> = {
  destino: "Para onde você quer ir?",
  origem: "De onde você sai?",
  data: "Para quando? Ex.: dia 10/12, de 10 a 20/12, ou em março.",
  periodo: "Em que época? Ex.: em março, no 1º semestre ou nos próximos 6 meses.",
};

/** A próxima pergunta, ou null se já dá para buscar. Ambiguidade vem primeiro. */
export function nextQuestion(p: Parsed): { text: string; options?: { code: string; label: string }[] } | null {
  const amb = p.ambiguous[0];
  if (amb) return { text: `Qual ${amb.field === "origem" ? "origem" : "destino"} você quis dizer com "${amb.text}"?`, options: amb.options };
  if (p.intent === null) return { text: "Não entendi o pedido. Experimente: \"quanto fica pra Lisboa dia 10/12\" ou \"mês mais barato pra Madri em 2027\"." };
  const m = p.missing[0];
  return m ? { text: QUESTIONS[m] } : null;
}

/** Frase final de "presumi isto", para o usuário saber o que pode mudar. */
export function assumptions(p: Parsed): string | null {
  const a = [...p.assumed];
  if (p.originFromHome && p.origin) a.unshift(`saindo de ${p.origin.label}`);
  return a.length ? `Considerei ${a.join(", ")}. É só me dizer se quiser outra coisa.` : null;
}
