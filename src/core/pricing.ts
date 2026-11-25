import type { CalendarDay, PriceLevel } from "./types";

function quantile(sorted: number[], q: number): number {
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

/** Classifica um preço contra a distribuição observada (quartis). */
export function priceLevel(price: number, reference: number[]): PriceLevel {
  const s = reference.filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (s.length < 4) return "normal";
  if (price <= quantile(s, 0.25)) return "baixo";
  if (price >= quantile(s, 0.75)) return "alto";
  return "normal";
}

export function calendarLevels(days: CalendarDay[]): Record<string, PriceLevel> {
  const values = days.map((d) => d.lowestAmount).filter((n): n is number => n !== null);
  return Object.fromEntries(
    days.filter((d) => d.lowestAmount !== null).map((d) => [d.date, priceLevel(d.lowestAmount!, values)]),
  );
}
