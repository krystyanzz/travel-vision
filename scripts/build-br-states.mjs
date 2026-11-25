// Gera src/data/br-states.json com os limites das 27 unidades da federação.
// Fonte: IBGE, malhas territoriais e localidades (dados abertos, uso livre com citação da fonte).
// Uso: node scripts/build-br-states.mjs

import { writeFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const MALHA = "https://servicodados.ibge.gov.br/api/v3/malhas/paises/BR?intrarregiao=UF&formato=application/vnd.geo%2Bjson&qualidade=minima";
const NOMES = "https://servicodados.ibge.gov.br/api/v1/localidades/estados";

const [malha, estados] = await Promise.all([fetch(MALHA).then((r) => r.json()), fetch(NOMES).then((r) => r.json())]);
const byCode = new Map(estados.map((e) => [String(e.id), e]));

// 3 casas decimais (~100 m) bastam para um mapa-múndi e reduzem o arquivo
const round = (c) => (typeof c[0] === "number" ? [Math.round(c[0] * 1000) / 1000, Math.round(c[1] * 1000) / 1000] : c.map(round));

const features = malha.features.map((f) => {
  const e = byCode.get(String(f.properties.codarea));
  if (!e) throw new Error(`UF desconhecida: ${f.properties.codarea}`);
  return { type: "Feature", properties: { uf: e.sigla, name: e.nome }, geometry: { type: f.geometry.type, coordinates: round(f.geometry.coordinates) } };
});

const out = {
  source: "IBGE: malhas territoriais (qualidade mínima) e localidades",
  url: "https://servicodados.ibge.gov.br/api/docs/malhas",
  generatedAt: new Date().toISOString().slice(0, 10),
  type: "FeatureCollection",
  features,
};
const file = path.join(root, "src", "data", "br-states.json");
writeFileSync(file, JSON.stringify(out));
console.log(`${features.length} UFs · ${(JSON.stringify(out).length / 1024).toFixed(0)} KB → ${file}`);
