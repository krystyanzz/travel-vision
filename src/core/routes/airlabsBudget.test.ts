import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { QuotaExceededError } from "../providers/quota";
import { createAirlabsProvider } from "./airlabs";

const route = (airline: string, n: number) => ({
  airline_iata: airline, flight_iata: `${airline}${n}`, cs_flight_iata: null, dep_iata: "VIX", arr_iata: "GRU",
  dep_time: "10:00", arr_time: "11:30", duration: 90, days: ["mon"],
});

function provider(dailyCallBudget: number, monthlyReserve = 0) {
  return createAirlabsProvider({
    apiKey: "teste", cacheDir: mkdtempSync(path.join(tmpdir(), "airlabs-")), pageSize: 50, maxCalls: 30,
    candidateAirlines: ["G3", "AD"], candidatesAreExhaustive: true, dailyCallBudget, monthlyReserve,
  });
}

afterEach(() => vi.unstubAllGlobals());

describe("orçamento de consultas da AirLabs", () => {
  it("para no teto diário e devolve o que já coletou como parcial", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      const airline = new URL(url).searchParams.get("airline_iata");
      return new Response(JSON.stringify({ request: { has_more: !airline, key: { limits_total: 900 } }, response: [route(airline ?? "LA", 1)] }));
    });
    vi.stubGlobal("fetch", fetchMock);
    const r = await provider(2).departures("VIX");
    expect(fetchMock).toHaveBeenCalledTimes(2); // 1ª página + 1 companhia; a 3ª consulta é recusada
    expect(r.partial).toBe(true);
    expect(r.flights.length).toBe(1); // a 2ª consulta (companhia LA, da 1ª página) repete o mesmo voo
  });

  it("recusa quando a cota mensal informada chega à reserva", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ request: { has_more: false, key: { limits_total: 10 } }, response: [route("LA", 1)] }))));
    const p = provider(100, 20);
    await p.departures("VIX"); // a resposta informa 10 restantes
    await expect(p.departures("CNF")).rejects.toBeInstanceOf(QuotaExceededError);
  });
});
