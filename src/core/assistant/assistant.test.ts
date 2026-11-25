import { describe, expect, it } from "vitest";
import { CITY_ALIASES } from "./lexicon";
import { CORPUS, type Expect } from "./corpus";
import { nextQuestion, summary } from "./describe";
import { parse, type Parsed } from "./parse";
import { place } from "../airportsDb";

const ctx = { today: new Date("2026-11-05T12:00:00Z"), home: "VIX" };

function view(p: Parsed): Required<Expect> {
  return {
    i: p.intent, o: p.origin?.code ?? "", d: p.destination?.code ?? null, ida: p.departDate, volta: p.returnDate,
    jan: p.dateWindow ? `${p.dateWindow.from}..${p.dateWindow.to}` : "", per: p.period ? `${p.period.fromMonth}..${p.period.toMonth}` : "",
    dur: p.duration ? `${p.duration.min}-${p.duration.max}` : "", dir: p.directOnly, teto: p.maxPrice ?? 0, tipo: p.tripType ?? "",
    prog: p.program ?? "", falta: p.missing[0] ?? "", amb: p.ambiguous.map((a) => a.text).join(","), seg: p.followUp,
  };
}

function run(text: string, before?: string) {
  const previous = before ? parse(before, ctx) : null;
  return parse(text, { ...ctx, previous });
}

describe("assistante: banco de frases", () => {
  const results = CORPUS.map(([text, exp, before]) => {
    const got = view(run(text, before));
    const wrong = (Object.keys(exp) as (keyof Expect)[]).filter((k) => got[k] !== exp[k]);
    return { text, exp, got, wrong };
  });
  const failures = results.filter((r) => r.wrong.length);
  const rate = 1 - failures.length / results.length;

  it("tem pelo menos 150 frases", () => {
    expect(CORPUS.length).toBeGreaterThanOrEqual(150);
  });

  it("entende pelo menos 90% das frases", () => {
    if (failures.length) {
      console.log(
        `Acerto: ${(rate * 100).toFixed(1)}% (${results.length - failures.length}/${results.length})\n` +
          failures.map((f) => `  ✗ "${f.text}"\n    ${f.wrong.map((k) => `${k}: esperado ${JSON.stringify(f.exp[k])}, veio ${JSON.stringify(f.got[k])}`).join(" · ")}`).join("\n"),
      );
    }
    expect(rate).toBeGreaterThanOrEqual(0.9);
  });
});

describe("assistente: regras", () => {
  it("todo apelido de cidade aponta para um lugar da base", () => {
    const broken = Object.entries(CITY_ALIASES).filter(([, code]) => !place(code)).map(([k, c]) => `${k}→${c}`);
    expect(broken).toEqual([]);
  });

  it("'se for' não vira Fortaleza (FOR), mas 'FOR' em maiúsculas vira", () => {
    expect(run("e se for em julho?", "VIX pra Lisboa dia 10/12").destination?.code).toBe("LIS");
    expect(run("VIX pra FOR dia 10/12").destination?.code).toBe("FOR");
  });

  it("'no natal' é época; 'pra natal' é a cidade", () => {
    expect(run("lisboa no natal").destination?.code).toBe("LIS");
    expect(run("voo pra natal dia 10/12").destination?.code).toBe("NAT");
  });

  it("nunca chuta: pergunta o que falta e mostra o que entendeu", () => {
    const p = run("passagem pra lisboa");
    expect(nextQuestion(p)?.text).toMatch(/Para quando/);
    expect(summary(run("VIX pra Lisboa dia 10/12"))).toBe("Entendi: Vitória (VIX) → Lisboa (LIS) · 10/12 · só ida");
    expect(nextQuestion(run("asdfgh"))?.text).toMatch(/Não entendi/);
  });
});
