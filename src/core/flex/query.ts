import type { FlexQuery } from "./engine";

// Validação do pedido de Férias flexíveis (vem da URL). Sem dependência de servidor.
//   ?de=VIX&para=MAD&de_mes=2027-01&ate_mes=2027-12&min=14&max=21&direto=1&teto=4000&dias=5,6

const IATA = /^[A-Z]{3}$/;
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
export const MAX_MONTHS = 12;
export const MAX_DAYS = 45;

const monthsBetween = (a: string, b: string) => {
  const [ay, am] = a.split("-").map(Number);
  const [by, bm] = b.split("-").map(Number);
  return (by - ay) * 12 + (bm - am);
};

export function parseFlexQuery(p: URLSearchParams, today = new Date()): { ok: true; query: FlexQuery } | { ok: false; error: string } {
  const origin = (p.get("de") ?? "").toUpperCase();
  const destination = (p.get("para") ?? "").toUpperCase();
  if (!IATA.test(origin) || !IATA.test(destination)) return { ok: false, error: "Informe origem e destino." };
  if (origin === destination) return { ok: false, error: "Origem e destino devem ser diferentes." };

  const now = today.toISOString().slice(0, 7);
  const fromMonth = p.get("de_mes") ?? now;
  const toMonth = p.get("ate_mes") ?? fromMonth;
  if (!MONTH.test(fromMonth) || !MONTH.test(toMonth)) return { ok: false, error: "Período inválido (use meses no formato AAAA-MM)." };
  if (toMonth < fromMonth) return { ok: false, error: "O mês final deve ser depois do inicial." };
  if (toMonth < now) return { ok: false, error: "Esse período já passou." };
  if (monthsBetween(fromMonth, toMonth) >= MAX_MONTHS) return { ok: false, error: `Escolha um período de até ${MAX_MONTHS} meses.` };

  const minDays = Number(p.get("min") ?? 14);
  const maxDays = Number(p.get("max") ?? minDays);
  if (!Number.isInteger(minDays) || !Number.isInteger(maxDays) || minDays < 1 || maxDays > MAX_DAYS || maxDays < minDays) {
    return { ok: false, error: `Duração inválida: de 1 a ${MAX_DAYS} dias, com o mínimo menor ou igual ao máximo.` };
  }

  const teto = p.get("teto");
  const maxPrice = teto ? Number(teto) : null;
  if (maxPrice !== null && (!Number.isFinite(maxPrice) || maxPrice <= 0)) return { ok: false, error: "Teto de preço inválido." };
  const weekdays = (p.get("dias") ?? "")
    .split(",")
    .filter(Boolean)
    .map(Number)
    .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);

  return {
    ok: true,
    query: {
      origin,
      destination,
      fromMonth: fromMonth < now ? now : fromMonth,
      toMonth,
      minDays,
      maxDays,
      directOnly: p.get("direto") === "1",
      maxPrice,
      weekdays,
    },
  };
}

/** Meses do período (AAAA-MM), do primeiro ao último. */
export function flexMonths(q: Pick<FlexQuery, "fromMonth" | "toMonth">): string[] {
  const out: string[] = [];
  let [y, m] = q.fromMonth.split("-").map(Number);
  const [ty, tm] = q.toMonth.split("-").map(Number);
  while (y < ty || (y === ty && m <= tm)) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    if (++m > 12) {
      m = 1;
      y++;
    }
  }
  return out;
}
