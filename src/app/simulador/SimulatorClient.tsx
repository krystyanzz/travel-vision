"use client";

import { useMemo, useState } from "react";
import { brl2, int } from "@/components/format";
import { PROGRAMS, programName, routesFrom } from "@/core/miles/programs";
import { compareMilesVsCash, purchaseCostPerThousand, simulateTransfer } from "@/core/miles/simulator";
import { activeTransferBonuses, SAMPLE_PROMOTIONS } from "@/core/promotions";

function num(s: string): number {
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function NumField(props: { id: string; label: string; value: string; onChange: (v: string) => void; suffix?: string }) {
  return (
    <div className="field">
      <label htmlFor={props.id}>
        {props.label}
        {props.suffix ? ` (${props.suffix})` : ""}
      </label>
      <input id={props.id} className="input" inputMode="decimal" value={props.value} onChange={(e) => props.onChange(e.target.value)} />
    </div>
  );
}

const VERDICT = {
  milhas: { text: "Vale mais emitir com milhas", badge: "badge-success" },
  dinheiro: { text: "Vale mais pagar em dinheiro", badge: "badge-danger" },
  empate: { text: "Praticamente empate", badge: "badge-warning" },
} as const;

export function SimulatorClient() {
  const bonuses = useMemo(() => activeTransferBonuses(SAMPLE_PROMOTIONS), []);
  const banks = PROGRAMS.filter((p) => p.kind === "banco");

  // Transferência
  const [from, setFrom] = useState(banks[0].id);
  const destinations = routesFrom(from);
  const [to, setTo] = useState(destinations[0]?.to ?? "");
  const route = destinations.find((r) => r.to === to) ?? destinations[0];
  const [points, setPoints] = useState("30000");
  const [srcCost, setSrcCost] = useState("35");
  const [bonus, setBonus] = useState<string | null>(null);
  const promoBonus = route ? bonuses[`${route.from}>${route.to}`] ?? 0 : 0;
  const bonusValue = bonus ?? String(promoBonus);
  const transfer = route
    ? simulateTransfer({ points: num(points), sourceCostPerThousand: num(srcCost), ratio: route.ratio, bonusPercent: num(bonusValue) })
    : null;

  // Compra
  const [price, setPrice] = useState("1050");
  const [bought, setBought] = useState("30000");
  const [buyBonus, setBuyBonus] = useState("0");
  const buyCost = purchaseCostPerThousand(num(price), num(bought), num(buyBonus));

  // Milhas x dinheiro
  const [cash, setCash] = useState("3200");
  const [miles, setMiles] = useState("70000");
  const [taxes, setTaxes] = useState("280");
  const [myCost, setMyCost] = useState<string | null>(null);
  const myCostValue = myCost ?? String(transfer?.costPerThousand ?? 20);
  const cmp = compareMilesVsCash({ cashPrice: num(cash), miles: num(miles), taxes: num(taxes), myCostPerThousand: num(myCostValue) });

  return (
    <div className="stack">
      <section className="card" aria-labelledby="t-title">
        <h2 id="t-title" style={{ fontSize: "1.3rem" }}>
          Transferência com bônus
        </h2>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="t-from">De</label>
            <select
              id="t-from"
              className="select"
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
                setTo(routesFrom(e.target.value)[0]?.to ?? "");
                setBonus(null);
              }}
            >
              {banks.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="t-to">Para</label>
            <select
              id="t-to"
              className="select"
              value={route?.to}
              onChange={(e) => {
                setTo(e.target.value);
                setBonus(null);
              }}
            >
              {destinations.map((r) => (
                <option key={r.to} value={r.to}>
                  {programName(r.to)}
                </option>
              ))}
            </select>
          </div>
          <NumField id="t-pts" label="Pontos" value={points} onChange={setPoints} />
          <NumField id="t-cost" label="Custo dos pontos" suffix="R$/mil" value={srcCost} onChange={setSrcCost} />
          <NumField id="t-bonus" label="Bônus" suffix="%" value={bonusValue} onChange={setBonus} />
        </div>
        {promoBonus > 0 && bonus === null && (
          <p className="muted" style={{ marginTop: "var(--space-3)", fontSize: "0.85rem" }}>
            Bônus de {promoBonus}% preenchido a partir do radar de promoções.
          </p>
        )}
        {route && !route.verified && (
          <p className="muted" style={{ fontSize: "0.85rem" }}>
            Paridade {route.ratio}:1 ainda não verificada na fonte oficial do programa.
          </p>
        )}
        {transfer && (
          <div className="result-row">
            <div>
              <span className="label">Milhas recebidas</span>
              <span className="stat num">{int(transfer.milesReceived)}</span>
              <span className="muted">
                {int(transfer.baseMiles)} + {int(transfer.bonusMiles)} de bônus
              </span>
            </div>
            <div>
              <span className="label">Custo total</span>
              <span className="stat num">{brl2(transfer.totalCost)}</span>
            </div>
            <div>
              <span className="label">Custo do milheiro</span>
              <span className="stat num" style={{ color: "var(--accent)" }}>
                {brl2(transfer.costPerThousand)}
              </span>
            </div>
          </div>
        )}
      </section>

      <section className="card" aria-labelledby="b-title">
        <h2 id="b-title" style={{ fontSize: "1.3rem" }}>
          Compra de pontos ou milhas
        </h2>
        <div className="form-grid">
          <NumField id="b-price" label="Valor pago" suffix="R$" value={price} onChange={setPrice} />
          <NumField id="b-qty" label="Quantidade comprada" value={bought} onChange={setBought} />
          <NumField id="b-bonus" label="Bônus da compra" suffix="%" value={buyBonus} onChange={setBuyBonus} />
        </div>
        <div className="result-row">
          <div>
            <span className="label">Custo do milheiro</span>
            <span className="stat num" style={{ color: "var(--accent)" }}>
              {brl2(buyCost)}
            </span>
          </div>
        </div>
      </section>

      <section className="card" aria-labelledby="c-title">
        <h2 id="c-title" style={{ fontSize: "1.3rem" }}>
          Milhas x dinheiro
        </h2>
        <div className="form-grid">
          <NumField id="c-cash" label="Passagem paga" suffix="R$" value={cash} onChange={setCash} />
          <NumField id="c-miles" label="Milhas do resgate" value={miles} onChange={setMiles} />
          <NumField id="c-tax" label="Taxas do resgate" suffix="R$" value={taxes} onChange={setTaxes} />
          <NumField id="c-my" label="Seu custo do milheiro" suffix="R$" value={myCostValue} onChange={setMyCost} />
        </div>
        <div className="result-row">
          <div>
            <span className="label">Valor obtido por milheiro</span>
            <span className="stat num">{brl2(cmp.valuePerThousand)}</span>
          </div>
          <div>
            <span className="label">Custo do resgate</span>
            <span className="stat num">{brl2(cmp.awardCost)}</span>
          </div>
          <div>
            <span className="label">Economia</span>
            <span className="stat num">{brl2(cmp.savings)}</span>
            <span className={`badge ${VERDICT[cmp.verdict].badge}`} style={{ alignSelf: "flex-start", marginTop: 6 }}>
              {VERDICT[cmp.verdict].text}
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}
