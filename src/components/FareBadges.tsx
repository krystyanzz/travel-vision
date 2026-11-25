import type { Availability } from "@/core/robots/types";

// Indicadores visuais padronizados para dados coletados pelos robôs.

export const AVAILABILITY_LABEL: Record<Availability, string> = {
  confirmada: "Disponibilidade confirmada",
  nao_confirmada: "Preço encontrado, disponibilidade não confirmada",
  historico: "Dado histórico",
  estimativa: "Estimativa / simulação",
};

const AVAILABILITY_CLASS: Record<Availability, string> = {
  confirmada: "badge-success",
  nao_confirmada: "badge-warning",
  historico: "",
  estimativa: "badge-danger",
};

export function AvailabilityBadge({ value }: { value: Availability }) {
  return <span className={`badge ${AVAILABILITY_CLASS[value]}`}>{AVAILABILITY_LABEL[value]}</span>;
}

export function FreshBadge() {
  return (
    <span className="badge badge-success" title="Consultado nas últimas 6 horas">
      <span className="live-dot" aria-hidden /> Atualizado recentemente
    </span>
  );
}

export function OpportunityBadge() {
  return <span className="badge badge-opportunity">Oportunidade</span>;
}

export function ago(iso: string | null | undefined): string {
  if (!iso) return "nunca";
  const min = Math.round((Date.now() - Date.parse(iso)) / 60_000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 48) return `há ${h} h`;
  return `há ${Math.round(h / 24)} dias`;
}

export function dateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function money(amount: number, currency: string): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
}
