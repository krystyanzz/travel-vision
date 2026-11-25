import { describe, expect, it } from "vitest";
import { place, searchPlaces } from "./airportsDb";

describe("busca de lugares", () => {
  const codes = (q: string) => searchPlaces(q).map((p) => p.code);

  it("prioriza aeroportos brasileiros e começo de palavra", () => {
    expect(codes("gu")[0]).toBe("GRU");
    expect(codes("vit")[0]).toBe("VIX");
    expect(codes("gr")[0]).toBe("GRU");
  });

  it("cidade com vários aeroportos vem antes dos aeroportos dela", () => {
    expect(codes("sao").slice(0, 3)).toEqual(["SAO", "GRU", "CGH"]);
    expect(codes("rio").slice(0, 3)).toEqual(["RIO", "GIG", "SDU"]);
  });

  it("ignora acentos e resolve códigos para exibição", () => {
    expect(codes("florianopolis")[0]).toBe("FLN");
    expect(place("sao")).toMatchObject({ kind: "city", city: "São Paulo" });
    expect(place("VIX")).toMatchObject({ kind: "airport", city: "Vitória" });
    expect(place("ZZZ")).toBeUndefined();
  });
});
