const brlFmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const brl2Fmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const intFmt = new Intl.NumberFormat("pt-BR");

export const brl = (n: number) => brlFmt.format(n);
export const brl2 = (n: number) => brl2Fmt.format(n);
export const int = (n: number) => intFmt.format(n);

export function time(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function duration(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
}

export function shortDate(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}
