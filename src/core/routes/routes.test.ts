import { describe, expect, it } from "vitest";
import { airport, searchAirports } from "../airportsDb";
import { aggregateDestinations, oneStopDestinations } from "./aggregate";
import type { RouteFlight, Weekday } from "./types";

const f = (airline: string, flight: string, dep: string, arr: string, depTime: string, days: Weekday[], durationMin = 100): RouteFlight => ({
  airline,
  flight,
  dep,
  arr,
  depTime,
  arrTime: "00:00",
  durationMin,
  days,
});

describe("aggregateDestinations", () => {
  it("soma voos semanais por destino e por companhia, sem duplicar o mesmo voo", () => {
    const flights = [
      f("G3", "G31751", "VIX", "BSB", "17:45", ["mon", "tue", "wed"]),
      f("G3", "G31751", "VIX", "BSB", "17:45", ["wed", "tue", "mon"]), // repetido em outra ordem
      f("JJ", "JJ3867", "VIX", "BSB", "18:05", ["mon", "tue", "wed", "thu", "fri", "sat", "sun"], 110),
      f("AD", "AD4000", "VIX", "VCP", "06:00", ["mon"]),
    ];
    const [bsb, vcp] = aggregateDestinations(flights);
    expect(bsb.iata).toBe("BSB");
    expect(bsb.weekly).toBe(10);
    expect(bsb.airlines).toEqual([
      { code: "JJ", weekly: 7 },
      { code: "G3", weekly: 3 },
    ]);
    expect(bsb.minDurationMin).toBe(100);
    expect(vcp.weekly).toBe(1);
  });
});

describe("oneStopDestinations", () => {
  it("lista destinos só alcançáveis por hub, sem repetir os diretos", () => {
    const direct = aggregateDestinations([f("G3", "G3A", "VIX", "GRU", "08:00", ["mon"], 90), f("G3", "G3B", "VIX", "BSB", "09:00", ["mon"], 110)]);
    const hubs = {
      GRU: aggregateDestinations([f("LA", "LA1", "GRU", "LIS", "22:00", ["mon"], 600), f("LA", "LA2", "GRU", "BSB", "10:00", ["mon"])]),
      BSB: aggregateDestinations([f("TP", "TP1", "BSB", "LIS", "21:00", ["mon"], 560), f("G3", "G3C", "BSB", "VIX", "07:00", ["mon"])]),
    };
    const r = oneStopDestinations("VIX", direct, hubs);
    expect(r.map((d) => d.iata)).toEqual(["LIS"]);
    expect(r[0].via.map((v) => v.hub).sort()).toEqual(["BSB", "GRU"]);
    expect(r[0].minFlyingMin).toBe(670); // 110 + 560, menor que 90 + 600
  });
});

describe("base de aeroportos", () => {
  it("encontra por código e por cidade sem acento", () => {
    expect(airport("vix")?.city).toBe("Vitória");
    expect(searchAirports("vitoria")[0]?.iata).toBe("VIX");
  });
});
