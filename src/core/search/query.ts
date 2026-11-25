import type { Cabin } from "../types";
import type { FlightQuery } from "./flights";

// Validação da busca (vem da URL). Sem dependências de servidor: usada também no navegador.

const IATA = /^[A-Z]{3}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const CABINS: (Cabin | "any")[] = ["any", "economy", "premium_economy", "business", "first"];

export function parseFlightQuery(p: URLSearchParams): { ok: true; query: FlightQuery } | { ok: false; error: string } {
  const origin = (p.get("de") ?? "").toUpperCase();
  const destination = (p.get("para") ?? "").toUpperCase();
  if (!IATA.test(origin) || !IATA.test(destination)) return { ok: false, error: "Informe origem e destino." };
  if (origin === destination) return { ok: false, error: "Origem e destino devem ser diferentes." };
  const departDate = p.get("ida") ?? "";
  if (!DATE.test(departDate)) return { ok: false, error: "Data de ida inválida." };
  const returnDate = p.get("volta") || null;
  if (returnDate && (!DATE.test(returnDate) || returnDate < departDate)) return { ok: false, error: "A volta deve ser depois da ida." };
  const cabin = (p.get("cabine") ?? "any") as Cabin | "any";
  return { ok: true, query: { origin, destination, departDate, returnDate, cabin: CABINS.includes(cabin) ? cabin : "any" } };
}
