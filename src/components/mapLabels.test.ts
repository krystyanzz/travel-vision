import { geoArea, geoBounds } from "d3-geo";
import type { FeatureCollection } from "geojson";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import world from "world-atlas/countries-110m.json";
import { describe, expect, it } from "vitest";
import { brazilStates, countryLabels, stateLabels } from "./mapLabels";

describe("rótulos do mapa", () => {
  it("estados do IBGE: 27 UFs, nenhuma parte com anel invertido, limites do Brasil corretos", () => {
    expect(brazilStates.features).toHaveLength(27);
    expect(brazilStates.features.filter((f) => geoArea(f) > 2 * Math.PI)).toHaveLength(0);
    const [[w, s], [e, n]] = geoBounds(brazilStates);
    expect(w).toBeGreaterThan(-75);
    expect(e).toBeLessThan(-34);
    expect(s).toBeGreaterThan(-35);
    expect(n).toBeLessThan(6);
    expect(stateLabels.map((l) => l.text)).toEqual(expect.arrayContaining(["SP", "ES", "PR", "AM"]));
  });

  it("países com nome em português, do maior para o menor", () => {
    const topo = world as unknown as Topology<{ countries: GeometryCollection }>;
    const labels = countryLabels(feature(topo, topo.objects.countries) as unknown as FeatureCollection);
    const names = labels.map((l) => l.text);
    expect(names).toEqual(expect.arrayContaining(["Brasil", "Estados Unidos", "Alemanha", "Canadá"]));
    expect(names[0]).toBe("Rússia");
    // a França é rotulada no continente, não na Guiana Francesa
    const fr = labels.find((l) => l.text === "França")!;
    expect(fr.at[1]).toBeGreaterThan(40);
  });
});
