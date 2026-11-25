import { loadMonitorConfig } from "../monitor";
import { SourceUnavailableError, type FxObservation, type Robot } from "../types";

// Câmbio oficial PTAX do Banco Central do Brasil (Olinda, dados abertos).
// Usado para converter preços em outra moeda, sempre exibindo a cotação e a data.

const API = "https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata";

interface PtaxRow {
  cotacaoCompra: number;
  cotacaoVenda: number;
  dataHoraCotacao: string; // "2026-10-30 13:09:27.123" (horário de Brasília)
  tipoBoletim: string;
}

const mdY = (d: Date) => `${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}-${d.getUTCFullYear()}`;

export function parsePtax(currency: string, rows: PtaxRow[]): FxObservation[] {
  return rows
    .filter((r) => r.cotacaoCompra > 0 && r.cotacaoVenda > 0 && r.dataHoraCotacao)
    .map((r) => ({
      currency,
      base: "BRL" as const,
      buy: r.cotacaoCompra,
      sell: r.cotacaoVenda,
      quotedAt: `${r.dataHoraCotacao.replace(" ", "T").slice(0, 19)}-03:00`,
      bulletin: r.tipoBoletim,
    }));
}

export const bcbPtaxRobot: Robot = {
  id: "bcb-ptax",
  name: "Câmbio PTAX (Banco Central)",
  produces: "fx",
  everyMinutes: 6 * 60,
  source: {
    id: "bcb-ptax",
    name: "Banco Central do Brasil, PTAX (dados abertos)",
    access: "dados_abertos",
    termsUrl: "https://dadosabertos.bcb.gov.br/dataset/dolar-americano-usd-todos-os-boletins-diarios",
    commercialUse: "confirmado",
    attribution: "Câmbio: PTAX, Banco Central do Brasil",
  },
  notReady: () => null,

  async run(ctx) {
    const { currencies } = loadMonitorConfig();
    const end = ctx.now;
    const start = new Date(end.getTime() - 7 * 86_400_000); // cobre fins de semana e feriados
    const fx: FxObservation[] = [];
    const itemErrors = [];
    let calls = 0;
    for (const currency of currencies) {
      const qs = [
        `@moeda='${currency}'`,
        `@dataInicial='${mdY(start)}'`,
        `@dataFinalCotacao='${mdY(end)}'`,
        "$format=json",
        "$select=cotacaoCompra,cotacaoVenda,dataHoraCotacao,tipoBoletim",
      ].join("&");
      const url = `${API}/CotacaoMoedaPeriodo(moeda=@moeda,dataInicial=@dataInicial,dataFinalCotacao=@dataFinalCotacao)?${qs}`;
      try {
        calls++;
        const res = await fetch(url, { signal: ctx.signal, headers: { accept: "application/json" } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = (await res.json()) as { value?: PtaxRow[] };
        const rows = parsePtax(currency, body.value ?? []);
        fx.push(...rows);
        ctx.log(`${currency}: ${rows.length} boletins`);
      } catch (e) {
        itemErrors.push({ target: currency, message: e instanceof Error ? e.message : String(e) });
      }
    }
    if (!fx.length && itemErrors.length) throw new SourceUnavailableError("bcb-ptax", itemErrors[0].message, true);
    return { fx, calls, partial: false, itemErrors };
  },
};
