import { describe, expect, it } from "vitest";
import { openStore } from "../robots/store";
import { parse } from "./parse";
import { buildReply } from "./reply";

const today = new Date();
const inDays = (n: number) => new Date(today.getTime() + n * 86_400_000).toISOString().slice(0, 10);
const ctx = { today, home: "VIX" };

describe("assistente: respostas", () => {
  it("preço numa data: usa só o que está no banco e aponta a mais barata", async () => {
    const store = openStore(":memory:");
    const D = inDays(30);
    const base = { kind: "cash" as const, origin: "VIX", destination: "LIS", departDate: D, returnDate: null, cabin: "economy" as const, program: null, cashCurrency: "BRL",
      miles: null, taxesAmount: null, taxesCurrency: null, seats: null, availability: "nao_confirmada" as const, deepLink: null, observedAt: new Date().toISOString() };
    store.upsertFares("serpapi-google", "g", [
      { ...base, departAt: `${D}T15:25:00`, carrier: "AD", flightNumbers: "AD4281+AD8750", stops: 1, durationMin: 785, cashAmount: 2269 },
      { ...base, departAt: `${D}T12:05:00`, carrier: "LA", flightNumbers: "LA3595+LA8146", stops: 1, durationMin: 915, cashAmount: 2897 },
    ]);
    const r = await buildReply(store, parse(`VIX pra Lisboa dia ${Number(D.slice(8))}/${D.slice(5, 7)}`, ctx));
    expect(r.text).toMatch(/Achei 2 opções reais/);
    expect(r.text).toMatch(/R\$\s?2\.269/);
    expect(r.cards).toHaveLength(2);
    expect(r.link?.href).toContain(`/busca?de=VIX&para=LIS&ida=${D}`);
  });

  it("sem dado: diz que não tem, sem inventar número", async () => {
    const r = await buildReply(openStore(":memory:"), parse(`VIX pra Madri dia 10/${String(today.getMonth() + 1).padStart(2, "0")}`, ctx));
    expect(r.text).toMatch(/Ainda não tenho preço real/);
    expect(r.cards.every((c) => c.price === null || /R\$/.test(c.price))).toBe(true);
  });

  it("faltando a data: pergunta, com sugestões", async () => {
    const r = await buildReply(openStore(":memory:"), parse("passagem pra lisboa", ctx));
    expect(r.text).toMatch(/Para quando/);
    expect(r.suggestions.length).toBeGreaterThan(0);
  });

  it("milheiro: R$ 35 com 80% de bônus dá R$ 19,44", async () => {
    const t = "quanto vale meu milheiro se paguei R$ 35 com 80% de bônus?";
    const r = await buildReply(openStore(":memory:"), parse(t, ctx), { rawText: t });
    expect(r.text).toMatch(/19,44/);
  });
});
