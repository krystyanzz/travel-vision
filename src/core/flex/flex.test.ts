import { describe, expect, it } from "vitest";
import { addDays, computeWindows, SALES_HORIZON_DAYS, type FlexQuery, type OneWayPrice, type RoundTripPrice } from "./engine";

const TODAY = "2027-01-10";
const q = (over: Partial<FlexQuery> = {}): FlexQuery => ({
  origin: "VIX", destination: "MAD", fromMonth: "2027-03", toMonth: "2027-03", minDays: 14, maxDays: 21, ...over,
});
let n = 0;
const ow = (date: string, brl: number, over: Partial<OneWayPrice> = {}): OneWayPrice => ({
  date, brl, stops: 1, carrier: "LA", sourceId: "tp", observedAt: "2027-01-09T10:00:00Z", key: `k${n++}`, ...over,
});
const rt = (departDate: string, returnDate: string, brl: number, over: Partial<RoundTripPrice> = {}): RoundTripPrice => ({
  departDate, returnDate, brl, stops: 1, returnStops: 1, carrier: "AV", sourceId: "google", observedAt: "2027-01-10T08:00:00Z", key: `r${n++}`, ...over,
});

describe("Férias flexíveis: motor de janelas", () => {
  it("combina ida e volta dentro da duração (dois bilhetes) e pega a volta mais barata da janela", () => {
    const r = computeWindows(q(), {
      outbound: [ow("2027-03-01", 1000)],
      inbound: [ow("2027-03-10", 100), /* curta demais */ ow("2027-03-18", 900), ow("2027-03-20", 700), ow("2027-03-25", 50) /* longa demais */],
      roundTrips: [],
    }, TODAY);
    expect(r.windows[0]).toMatchObject({ departDate: "2027-03-01", returnDate: "2027-03-20", days: 19, totalBrl: 1700, ticket: "dois_bilhetes" });
  });

  it("bilhete único de ida e volta ganha quando é mais barato", () => {
    const r = computeWindows(q(), {
      outbound: [ow("2027-03-01", 1000)],
      inbound: [ow("2027-03-20", 700)],
      roundTrips: [rt("2027-03-01", "2027-03-16", 1500)],
    }, TODAY);
    expect(r.windows[0]).toMatchObject({ ticket: "ida_e_volta", totalBrl: 1500, days: 15, sources: ["google"] });
  });

  it("janela do Google Explore de 13 dias entra numa busca de 14 a 21 (folga de 1 dia), outra fonte não", () => {
    const base = { outbound: [], inbound: [] };
    expect(computeWindows(q(), { ...base, roundTrips: [rt("2027-03-04", "2027-03-17", 3972, { approxDuration: true })] }, TODAY).windows).toHaveLength(1);
    expect(computeWindows(q(), { ...base, roundTrips: [rt("2027-03-04", "2027-03-17", 3972)] }, TODAY).windows).toHaveLength(0);
  });

  it("filtros: só direto, teto de preço e dias da semana para sair", () => {
    const data = {
      outbound: [ow("2027-03-05", 900, { stops: 0 }), ow("2027-03-06", 500, { stops: 1 })], // 05/03/2027 é sexta, 06 sábado
      inbound: [ow("2027-03-22", 800, { stops: 0 }), ow("2027-03-23", 400, { stops: 0 })],
      roundTrips: [],
    };
    expect(computeWindows(q(), data, TODAY).windows[0].departDate).toBe("2027-03-06");
    expect(computeWindows(q({ directOnly: true }), data, TODAY).windows.map((w) => w.departDate)).toEqual(["2027-03-05"]);
    expect(computeWindows(q({ maxPrice: 1000 }), data, TODAY).windows.map((w) => w.totalBrl)).toEqual([900]);
    const fri = computeWindows(q({ weekdays: [5] }), data, TODAY);
    expect(fri.windows.map((w) => w.departDate)).toEqual(["2027-03-05"]);
    expect(fri.days.find((d) => d.date === "2027-03-06")!.status).toBe("fora_do_filtro");
  });

  it("top 5 não repete quase a mesma viagem (saídas com menos de 3 dias de diferença)", () => {
    const outbound = ["2027-03-01", "2027-03-02", "2027-03-03", "2027-03-08", "2027-03-15"].map((d, i) => ow(d, 1000 + i));
    const inbound = Array.from({ length: 40 }, (_, i) => ow(addDays("2027-03-10", i), 500));
    const r = computeWindows(q(), { outbound, inbound, roundTrips: [] }, TODAY);
    expect(r.windows.map((w) => w.departDate)).toEqual(["2027-03-01", "2027-03-08", "2027-03-15"]);
  });

  it("dias passados, ainda não à venda e sem dado; cobertura e melhor de cada mês", () => {
    const today = "2027-03-20";
    const horizonMonth = addDays(today, SALES_HORIZON_DAYS + 40).slice(0, 7);
    const r = computeWindows(q({ fromMonth: "2027-03", toMonth: horizonMonth }), { outbound: [ow("2027-03-25", 800)], inbound: [ow("2027-04-10", 600)], roundTrips: [] }, today);
    const day = (d: string) => r.days.find((x) => x.date === d)!.status;
    expect(day("2027-03-01")).toBe("passado");
    expect(day("2027-03-25")).toBe("ok");
    expect(day("2027-03-26")).toBe("sem_dado");
    expect(r.months[0]).toMatchObject({ month: "2027-03", status: "ok", coverage: 0.08 }); // 1 de 12 dias abertos (20 a 31)
    expect(r.months.at(-1)!.status).toBe("ainda_nao_a_venda");
    expect(r.months.find((m) => m.month === "2027-05")!.status).toBe("sem_dado");
  });

  it("sem nenhum preço: nenhuma janela, nada inventado", () => {
    const r = computeWindows(q(), { outbound: [], inbound: [], roundTrips: [] }, TODAY);
    expect(r.windows).toHaveLength(0);
    expect(r.days.every((d) => d.best === null)).toBe(true);
    expect(r.coverage).toBe(0);
  });
});

describe("Férias flexíveis: fontes, pedido e carregamento", () => {
  it("Google Explore: lê a janela e as opções (formato real da Fase 0)", async () => {
    const { parseExplore, exploreDuration, exploreMonths } = await import("../robots/robots/serpapiExplore");
    const rows = parseExplore(
      { start_date: "2027-03-04", end_date: "2027-03-18", google_flights_link: "https://www.google.com/travel/flights?x",
        flights: [{ departure_airport: { id: "GRU" }, arrival_airport: { id: "MAD" }, duration: 1095, price: 3972, number_of_stops: 1, airline: "Avianca", airline_code: "AV" }] },
      "2026-11-05T00:00:00Z",
    );
    expect(rows[0]).toMatchObject({ origin: "GRU", destination: "MAD", departDate: "2027-03-04", returnDate: "2027-03-18", carrier: "AV", stops: 1, cashAmount: 3972, flightNumbers: null });
    expect(exploreDuration(14, 21)).toBe(3);
    expect(exploreDuration(6, 9)).toBe(2);
    expect(exploreDuration(2, 4)).toBe(1);
    expect(exploreMonths(["2026-11", "2027-03", "2027-04", "2027-05"], new Date("2026-11-05T12:00:00Z"))).toEqual(["2026-11", "2027-03", "2027-04"]);
  });

  it("Aviasales: calendário do ano e últimas ida e volta viram tarifas de bilhete único", async () => {
    const { parseYearRoundTrips } = await import("../robots/robots/travelpayouts");
    const rows = parseYearRoundTrips(
      [{ origin: "SAO", destination: "MAD", airline: "AZ", departure_at: "2027-03-06T15:45:00-03:00", return_at: "2027-03-19T11:40:00+01:00", price: 3766, flight_number: 675, transfers: 1 }],
      [{ origin: "SAO", destination: "MAD", depart_date: "2027-04-01", return_date: "2027-04-14", value: 3523, number_of_changes: 1, gate: "Trip.com" }],
      "2026-11-05T00:00:00Z",
    );
    expect(rows.map((r) => [r.origin, r.departDate, r.returnDate, r.cashAmount])).toEqual([["SAO", "2027-03-06", "2027-03-19", 3766], ["SAO", "2027-04-01", "2027-04-14", 3523]]);
  });

  it("valida o pedido da URL", async () => {
    const { parseFlexQuery } = await import("./query");
    const now = new Date("2026-11-05T12:00:00Z");
    const ok = parseFlexQuery(new URLSearchParams("de=vix&para=mad&de_mes=2027-01&ate_mes=2027-12&min=14&max=21&direto=1&dias=5,6"), now);
    expect(ok).toMatchObject({ ok: true, query: { origin: "VIX", destination: "MAD", minDays: 14, maxDays: 21, directOnly: true, weekdays: [5, 6] } });
    expect(parseFlexQuery(new URLSearchParams("de=VIX&para=MAD&de_mes=2027-01&ate_mes=2028-02"), now).ok).toBe(false); // mais de 12 meses
    expect(parseFlexQuery(new URLSearchParams("de=VIX&para=MAD&min=21&max=14"), now).ok).toBe(false);
    expect(parseFlexQuery(new URLSearchParams("de=VIX&para=MAD&de_mes=2026-01&ate_mes=2026-03"), now).ok).toBe(false); // já passou
  });

  it("carrega do banco: ida e volta com código de cidade e só ida nos dois sentidos", async () => {
    const { openStore } = await import("../robots/store");
    const { flexSearch } = await import("./load");
    const store = openStore(":memory:");
    const base = { kind: "cash" as const, departAt: null, carrier: "LA", flightNumbers: null, stops: 1, durationMin: null, cabin: "economy" as const, program: null,
      cashCurrency: "BRL", miles: null, taxesAmount: null, taxesCurrency: null, seats: null, availability: "nao_confirmada" as const, deepLink: null, observedAt: "2027-01-09T00:00:00Z" };
    store.upsertFares("travelpayouts", "tp", [
      { ...base, origin: "SAO", destination: "MAD", departDate: "2027-03-06", returnDate: "2027-03-20", cashAmount: 3500 },
      { ...base, origin: "GRU", destination: "MAD", departDate: "2027-03-02", returnDate: null, cashAmount: 1500 },
      { ...base, origin: "MAD", destination: "GRU", departDate: "2027-03-18", returnDate: null, cashAmount: 1200 },
    ]);
    const r = flexSearch(store, { origin: "SAO", destination: "MAD", fromMonth: "2027-03", toMonth: "2027-03", minDays: 14, maxDays: 21 }, "2027-01-10");
    expect(r.windows.map((w) => [w.departDate, w.returnDate, w.totalBrl, w.ticket])).toEqual([
      ["2027-03-02", "2027-03-18", 2700, "dois_bilhetes"],
      ["2027-03-06", "2027-03-20", 3500, "ida_e_volta"],
    ]);
  });
});
