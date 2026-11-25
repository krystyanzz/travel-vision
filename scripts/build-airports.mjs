// Gera src/data/airports.json a partir do OurAirports (domínio público).
// Só aeroportos com código IATA e voos regulares.
// Uso: node scripts/build-airports.mjs

import { writeFileSync } from "node:fs";
import path from "node:path";

const SOURCE = "https://davidmegginson.github.io/ourairports-data/airports.csv";
const out = path.resolve(import.meta.dirname, "..", "src", "data", "airports.json");

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (c !== "\r") field += c;
  }
  if (field || row.length) rows.push([...row, field]);
  return rows;
}

const res = await fetch(SOURCE);
if (!res.ok) throw new Error(`HTTP ${res.status}`);
const [header, ...rows] = parseCsv(await res.text());
const col = Object.fromEntries(header.map((h, i) => [h, i]));
const SIZE = { large_airport: 3, medium_airport: 2, small_airport: 1 };

const airports = rows
  .filter((r) => r[col.iata_code]?.length === 3 && r[col.scheduled_service] === "yes" && SIZE[r[col.type]])
  .map((r) => [
    r[col.iata_code],
    r[col.name],
    r[col.municipality],
    r[col.iso_country],
    Math.round(Number(r[col.latitude_deg]) * 1e4) / 1e4,
    Math.round(Number(r[col.longitude_deg]) * 1e4) / 1e4,
    SIZE[r[col.type]],
  ])
  .sort((a, b) => a[0].localeCompare(b[0]));

writeFileSync(
  out,
  JSON.stringify({
    source: "OurAirports (domínio público) · https://ourairports.com/data/",
    generated: new Date().toISOString().slice(0, 10),
    fields: ["iata", "name", "city", "country", "lat", "lon", "size"],
    airports,
  }),
);
console.log(`${airports.length} aeroportos → ${out}`);
