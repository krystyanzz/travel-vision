import { describe, expect, it } from "vitest";
import { compareRoute, isCashOpportunity, toBrl, type FxRate, type PricedFare } from "./compare";
import { isDue, policyBlock, runRobot } from "./engine";
import { parsePtax } from "./robots/bcbPtax";
import { parseTravelpayouts } from "./robots/travelpayouts";
import { openStore } from "./store";
import type { FareObservation, Robot, RobotOutput } from "./types";

const fare = (over: Partial<FareObservation> = {}): FareObservation => ({
  kind: "cash",
  origin: "GRU",
  destination: "LIS",
  departDate: "2030-03-10",
  departAt: "2030-03-10T22:00:00-03:00",
  returnDate: null,
  carrier: "TP",
  flightNumbers: "TP88",
  stops: 0,
  durationMin: 600,
  cabin: "economy",
  program: null,
  cashAmount: 3000,
  cashCurrency: "BRL",
  miles: null,
  taxesAmount: null,
  taxesCurrency: null,
  seats: null,
  availability: "nao_confirmada",
  deepLink: null,
  observedAt: "2030-01-01T10:00:00Z",
  ...over,
});

function fakeRobot(outputs: (RobotOutput | Error)[], over: Partial<Robot> = {}): Robot {
  let i = 0;
  return {
    id: "fake",
    name: "Fake",
    produces: "fares_cash",
    everyMinutes: 60,
    source: { id: "fake-src", name: "Fake", access: "api_oficial", termsUrl: "", commercialUse: "confirmado", attribution: "" },
    notReady: () => null,
    run: async () => {
      const o = outputs[Math.min(i++, outputs.length - 1)];
      if (o instanceof Error) throw o;
      return o;
    },
    ...over,
  };
}

const clock = (iso: string) => () => new Date(iso);

describe("motor dos robôs", () => {
  it("grava, deduplica e detecta queda de preço com alerta", async () => {
    const store = openStore(":memory:");
    const robot = fakeRobot([
      { fares: [fare(), fare()], calls: 1, partial: false, itemErrors: [] },
      { fares: [fare({ cashAmount: 2500, observedAt: "2030-01-01T16:00:00Z" })], calls: 1, partial: false, itemErrors: [] },
    ]);
    const r1 = await runRobot(robot, store, { now: clock("2030-01-01T10:00:00Z") });
    expect(r1).toMatchObject({ status: "ok", newItems: 1 });
    const r2 = await runRobot(robot, store, { now: clock("2030-01-01T16:00:00Z") });
    expect(r2).toMatchObject({ status: "ok", newItems: 0, changes: 1 });
    expect(store.faresForRoute("GRU", "LIS")).toHaveLength(1);
    expect(store.faresForRoute("GRU", "LIS")[0].cash_amount).toBe(2500);
    const ev = store.recentEvents(5);
    expect(ev[0].type).toBe("price_drop");
    expect(store.fareHistory(store.faresForRoute("GRU", "LIS")[0].key as string)).toHaveLength(2);
  });

  it("falha da fonte vira erro registrado, sem dados inventados, e aplica espera crescente", async () => {
    const store = openStore(":memory:");
    const robot = fakeRobot([new Error("HTTP 503")]);
    const r = await runRobot(robot, store, { now: clock("2030-01-01T10:00:00Z") });
    expect(r.status).toBe("error");
    expect(store.latestFares()).toHaveLength(0);
    expect(store.recentErrors()[0].message).toBe("HTTP 503");
    // 1 falha: espera 2x a frequência (120 min)
    expect(isDue(robot, store, new Date("2030-01-01T11:30:00Z"))).toBe(false);
    expect(isDue(robot, store, new Date("2030-01-01T12:01:00Z"))).toBe(true);
  });

  it("não roda robô de navegador sem permissão documentada", async () => {
    const store = openStore(":memory:");
    const robot = fakeRobot([{ calls: 0, partial: false, itemErrors: [] }], {
      source: { id: "x", name: "X", access: "navegador", termsUrl: "", commercialUse: "a_confirmar", attribution: "" },
    });
    expect(policyBlock(robot)).toMatch(/permissão/);
    expect((await runRobot(robot, store)).status).toBe("skipped");
    expect(store.recentRuns()).toHaveLength(0);
  });

  it("malha: coleta parcial não remove rotas; coleta completa detecta rota extinta", async () => {
    const store = openStore(":memory:");
    const flight = (destination: string) => ({ origin: "VIX", destination, airline: "G3", flight: `G3${destination}`, depTime: "10:00", arrTime: "11:00", durationMin: 60, days: ["mon"] });
    const robot = fakeRobot([
      { schedules: [{ origin: "VIX", flights: [flight("GRU"), flight("BSB")], partial: false, fetchedAt: "2030-01-01T00:00:00Z" }], calls: 1, partial: false, itemErrors: [] },
      { schedules: [{ origin: "VIX", flights: [flight("GRU")], partial: true, fetchedAt: "2030-01-02T00:00:00Z" }], calls: 1, partial: true, itemErrors: [] },
      { schedules: [{ origin: "VIX", flights: [flight("GRU")], partial: false, fetchedAt: "2030-01-03T00:00:00Z" }], calls: 1, partial: false, itemErrors: [] },
    ]);
    await runRobot(robot, store);
    await runRobot(robot, store);
    expect(store.scheduleSummary()[0].destinations).toBe(2);
    await runRobot(robot, store);
    expect(store.scheduleSummary()[0].destinations).toBe(1);
    expect(store.recentEvents(1)[0].type).toBe("route_removed");
  });

  it("datas passadas viram histórico", async () => {
    const store = openStore(":memory:");
    const robot = fakeRobot([
      { fares: [fare({ departDate: "2030-01-05" })], calls: 1, partial: false, itemErrors: [] },
      { fares: [fare({ departDate: "2030-02-01" })], calls: 1, partial: false, itemErrors: [] },
    ]);
    await runRobot(robot, store, { now: clock("2030-01-01T00:00:00Z") });
    await runRobot(robot, store, { now: clock("2030-01-10T00:00:00Z") });
    expect(store.latestFares().map((f) => f.depart_date)).toEqual(["2030-02-01"]);
  });
});

describe("parsers das fontes", () => {
  it("Travelpayouts: preço real com disponibilidade não confirmada e link do parceiro", () => {
    const rows = parseTravelpayouts(
      [
        { origin: "SAO", destination: "LIS", origin_airport: "GRU", destination_airport: "LIS", price: 2890, airline: "TP", flight_number: 88, departure_at: "2030-03-10T22:05:00-03:00", transfers: 0, duration_to: 600, link: "/search/SAO1003LIS1?t=x" },
        { origin: "SAO", destination: "LIS", departure_at: "2030-03-11" }, // sem preço: descartado
      ],
      "brl",
      "2030-01-01T00:00:00Z",
      "12345",
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ origin: "GRU", cashAmount: 2890, cashCurrency: "BRL", flightNumbers: "TP88", availability: "nao_confirmada", stops: 0 });
    expect(rows[0].deepLink).toBe("https://www.aviasales.com/search/SAO1003LIS1?t=x&marker=12345");
  });

  it("Travelpayouts: formato real da resposta (só ida com conexão, vendedor)", () => {
    // linha real de GRU → LIS, 02/11/2026 (link encurtado)
    const [r] = parseTravelpayouts(
      [{ flight_number: "1562", link: "/search/GRU0212LIS1?t=x", origin_airport: "GRU", destination_airport: "LIS", departure_at: "2026-12-02T05:25:00-03:00", airline: "G3", destination: "LIS", origin: "SAO", price: 1897, gate: "Trip.com", return_transfers: 0, duration: 795, duration_to: 640, duration_back: 0, transfers: 1 } as never],
      "brl",
      "2026-11-03T00:00:00Z",
    );
    expect(r).toMatchObject({ origin: "GRU", destination: "LIS", departDate: "2026-12-02", flightNumbers: "G31562", stops: 1, durationMin: 795, cashAmount: 1897, cashCurrency: "BRL", seller: "Trip.com" });
    expect(r.deepLink).toBe("https://www.aviasales.com/search/GRU0212LIS1?t=x");
  });

  it("PTAX: converte data e hora de Brasília", () => {
    const [r] = parsePtax("USD", [{ cotacaoCompra: 5.4, cotacaoVenda: 5.41, dataHoraCotacao: "2030-01-02 13:05:21.5", tipoBoletim: "Fechamento" }]);
    expect(r).toMatchObject({ currency: "USD", sell: 5.41, quotedAt: "2030-01-02T13:05:21-03:00" });
  });
});

describe("motor de comparação", () => {
  const usd: FxRate = { currency: "USD", sell: 5, quotedAt: "2030-01-01T13:00:00-03:00", sourceId: "bcb-ptax" };
  const base = { origin: "GRU", destination: "LIS", departDate: "2030-03-10", carrier: "TP", observedAt: "2030-01-01T10:00:00Z" };
  const cash: PricedFare = { ...base, key: "c", sourceId: "tp", kind: "cash", program: null, cashAmount: 4000, cashCurrency: "BRL", miles: null, taxesAmount: null, taxesCurrency: null, availability: "nao_confirmada" };
  const award: PricedFare = { ...base, key: "a", sourceId: "prog", kind: "award", program: "x", cashAmount: null, cashCurrency: null, miles: 70000, taxesAmount: 100, taxesCurrency: "USD", availability: "confirmada" };

  it("converte só com cotação registrada", () => {
    expect(toBrl(100, "USD", [usd])?.brl).toBe(500);
    expect(toBrl(100, "EUR", [usd])).toBeNull();
  });

  it("calcula valor do milheiro, custo por ponto e avisa sobre fontes e disponibilidade", () => {
    const [c] = compareRoute([cash, award], [usd], 20);
    // (4000 - 500) / 70 = 50 por milheiro
    expect(c.valuePerThousand).toBe(50);
    expect(c.centsPerPoint).toBe(5);
    expect(c.withMyCost).toMatchObject({ awardCost: 1900, savings: 2100, verdict: "milhas" });
    expect(c.warnings).toEqual(expect.arrayContaining(["Disponibilidade da tarifa em dinheiro não confirmada", "Fontes diferentes: tp e prog"]));
  });

  it("ignora estimativas e históricos", () => {
    expect(compareRoute([{ ...cash, availability: "estimativa" }, award], [usd])).toHaveLength(0);
  });

  it("oportunidade exige amostras suficientes", () => {
    expect(isCashOpportunity(100, [100, 200, 300])).toBe(false);
    expect(isCashOpportunity(100, [100, 200, 210, 220, 230, 240, 250, 260])).toBe(true);
  });
});

describe("Google Flights via SerpAPI", () => {
  it("lê o formato da resposta: conexões, chegada local, número dos voos", async () => {
    const { parseSerpGoogle } = await import("./robots/serpapiGoogle");
    const rows = parseSerpGoogle(
      {
        search_metadata: { google_flights_url: "https://www.google.com/travel/flights?x" },
        best_flights: [
          {
            flights: [
              { departure_airport: { id: "VIX", time: "2026-12-01 06:10" }, arrival_airport: { id: "GRU", time: "2026-12-01 07:40" }, airline: "LATAM", flight_number: "LA 3301", travel_class: "Economy" },
              { departure_airport: { id: "GRU", time: "2026-12-01 21:00" }, arrival_airport: { id: "LIS", time: "2026-12-02 10:55" }, airline: "LATAM", flight_number: "LA 8146", travel_class: "Economy" },
            ],
            total_duration: 1005,
            price: 4120,
          },
        ],
        other_flights: [{ flights: [], price: 10 }], // sem trechos: descartado
      },
      "2026-11-04T00:00:00Z",
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      origin: "VIX", destination: "LIS", departDate: "2026-12-01", departAt: "2026-12-01T06:10:00", arriveAt: "2026-12-02T10:55:00",
      carrier: "LA", flightNumbers: "LA3301+LA8146", stops: 1, durationMin: 1005, cabin: "economy", cashAmount: 4120, cashCurrency: "BRL",
      seller: "Google Flights", deepLink: "https://www.google.com/travel/flights?x",
    });
  });

  it("o agendador não roda robôs só sob demanda", async () => {
    const { tick } = await import("./engine");
    const store = openStore(":memory:");
    let ran = 0;
    const r = fakeRobot([{ calls: 0, partial: false, itemErrors: [] }], { onDemandOnly: true, run: async () => { ran++; return { calls: 0, partial: false, itemErrors: [] }; } });
    expect(await tick([r], store)).toHaveLength(0);
    expect(ran).toBe(0);
  });
});
