import { readFileSync } from "node:fs";
import path from "node:path";

// Configuração de monitoramento (config/monitor.json), lida a cada execução
// para que mudanças valham sem reiniciar o agendador.

export interface MonitorConfig {
  airports: string[];
  routes: { origin: string; destination: string }[];
  monthsAhead: number;
  currencies: string[];
}

const IATA = /^[A-Z]{3}$/;

export function loadMonitorConfig(file = path.join(process.cwd(), "config", "monitor.json")): MonitorConfig {
  const raw = JSON.parse(readFileSync(file, "utf8")) as Partial<MonitorConfig>;
  const up = (s: unknown) => String(s ?? "").trim().toUpperCase();
  return {
    airports: (raw.airports ?? []).map(up).filter((a) => IATA.test(a)),
    routes: (raw.routes ?? [])
      .map((r) => ({ origin: up(r.origin), destination: up(r.destination) }))
      .filter((r) => IATA.test(r.origin) && IATA.test(r.destination) && r.origin !== r.destination),
    monthsAhead: Math.max(1, Math.min(12, Number(raw.monthsAhead ?? 3))),
    currencies: (raw.currencies ?? ["USD"]).map(up).filter((c) => IATA.test(c)),
  };
}

/** Meses a consultar: o atual e os seguintes (AAAA-MM). */
export function monthsFrom(now: Date, count: number): string[] {
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + i, 1));
    return d.toISOString().slice(0, 7);
  });
}
