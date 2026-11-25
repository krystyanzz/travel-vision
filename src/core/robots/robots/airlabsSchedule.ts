import { routesProvider } from "../../routes/registry";
import { loadMonitorConfig } from "../monitor";
import { SourceUnavailableError, type Robot } from "../types";

// Malha aérea programada dos aeroportos monitorados (AirLabs Routes API).
// Não traz preço: serve ao mapa de rotas e para detectar rotas novas ou extintas.
// O adaptador guarda as rotas em cache por 7 dias, por isso a frequência padrão é semanal.

export const airlabsScheduleRobot: Robot = {
  id: "airlabs-malha",
  name: "Malha aérea (AirLabs)",
  produces: "schedules",
  everyMinutes: 7 * 24 * 60,
  source: {
    id: "airlabs",
    name: "AirLabs Routes API",
    access: "api_oficial",
    termsUrl: "https://airlabs.co/terms-of-service",
    commercialUse: "a_confirmar",
    attribution: "Rotas: AirLabs",
  },
  notReady: () => (process.env.AIRLABS_API_KEY ? null : "AIRLABS_API_KEY não configurada"),

  async run(ctx) {
    const provider = routesProvider();
    if (!provider) throw new SourceUnavailableError("airlabs", "AIRLABS_API_KEY não configurada", false);
    const before = provider.callsMade?.() ?? 0;
    const { airports } = loadMonitorConfig();
    const schedules = [];
    const itemErrors = [];
    let partial = false;
    for (const origin of airports) {
      if (ctx.signal.aborted) break;
      try {
        const r = await provider.departures(origin);
        partial ||= r.partial;
        schedules.push({
          origin,
          partial: r.partial,
          fetchedAt: r.fetchedAt,
          flights: r.flights.map((f) => ({
            origin,
            destination: f.arr,
            airline: f.airline,
            flight: f.flight,
            depTime: f.depTime,
            arrTime: f.arrTime,
            durationMin: f.durationMin,
            days: f.days,
          })),
        });
        ctx.log(`${origin}: ${r.flights.length} voos regulares${r.partial ? " (parcial)" : ""}, coletado em ${r.fetchedAt}`);
      } catch (e) {
        itemErrors.push({ target: origin, message: e instanceof Error ? e.message : String(e) });
      }
    }
    if (!schedules.length && itemErrors.length) {
      throw new SourceUnavailableError("airlabs", `Nenhum aeroporto respondeu: ${itemErrors[0].message}`, true);
    }
    return { schedules, calls: (provider.callsMade?.() ?? 0) - before, partial, itemErrors };
  },
};
