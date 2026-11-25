"use client";

import { useMemo, useState } from "react";
import { brl2, int, shortDate } from "@/components/format";
import { useWallet } from "@/components/useWallet";
import { PROGRAMS, programName } from "@/core/miles/programs";
import { expiringWithin, reachableMiles } from "@/core/miles/wallet";
import { activeTransferBonuses, SAMPLE_PROMOTIONS } from "@/core/promotions";

export function WalletClient() {
  const { entries, setEntries, consent, setConsent, eraseAll, loaded } = useWallet();
  const [programId, setProgramId] = useState(PROGRAMS[0].id);
  const [balance, setBalance] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [cost, setCost] = useState("");

  const bonuses = useMemo(() => activeTransferBonuses(SAMPLE_PROMOTIONS), []);
  const expiring = useMemo(() => expiringWithin(entries, 60), [entries]);
  const airlines = PROGRAMS.filter((p) => p.kind === "aereo");

  if (!loaded) return null;

  if (!consent) {
    return (
      <div className="card" style={{ maxWidth: 680 }}>
        <h3>Antes de começar</h3>
        <p className="muted">
          Para lembrar sua carteira, vamos guardar programas, saldos, validades e custos <strong>apenas neste
          navegador</strong>. Esses dados servem só para calcular o que você consegue emitir e não são enviados aos
          nossos servidores. Você pode apagar tudo a qualquer momento.
        </p>
        <div className="row-actions">
          <button className="btn btn-primary" type="button" onClick={() => setConsent(true)}>
            Concordo e quero usar a carteira
          </button>
          <a className="btn btn-ghost" href="/privacidade">
            Ler a política
          </a>
        </div>
      </div>
    );
  }

  function add(e: React.FormEvent) {
    e.preventDefault();
    const b = Number(balance);
    if (!Number.isFinite(b) || b <= 0) return;
    setEntries([
      ...entries,
      { programId, balance: Math.floor(b), expiresAt: expiresAt || undefined, costPerThousand: cost ? Number(cost) : undefined },
    ]);
    setBalance("");
    setExpiresAt("");
    setCost("");
  }

  return (
    <div className="stack">
      <form className="card form-grid" onSubmit={add} aria-label="Adicionar saldo">
        <div className="field">
          <label htmlFor="w-prog">Programa</label>
          <select id="w-prog" className="select" value={programId} onChange={(e) => setProgramId(e.target.value)}>
            {PROGRAMS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="w-bal">Saldo</label>
          <input id="w-bal" className="input" inputMode="numeric" value={balance} onChange={(e) => setBalance(e.target.value.replace(/\D/g, ""))} placeholder="25000" required />
        </div>
        <div className="field">
          <label htmlFor="w-exp">Vence em</label>
          <input id="w-exp" className="input" type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="w-cost">Custo do milheiro (R$)</label>
          <input id="w-cost" className="input" inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value.replace(",", "."))} placeholder="opcional" />
        </div>
        <button className="btn btn-primary" type="submit">
          Adicionar
        </button>
      </form>

      {expiring.length > 0 && (
        <div className="notice notice-warning" role="status">
          <strong>Atenção:</strong>
          <span>
            {expiring.map((e) => `${int(e.balance)} ${programName(e.programId)} vencem em ${shortDate(e.expiresAt!)}`).join(" · ")}
          </span>
        </div>
      )}

      <div className="card">
        <h3>Saldos</h3>
        {entries.length === 0 ? (
          <p className="muted">Nenhum saldo ainda. Adicione o primeiro acima.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Programa</th>
                  <th>Saldo</th>
                  <th>Validade</th>
                  <th>Custo do milheiro</th>
                  <th>
                    <span className="visually-hidden">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e, i) => (
                  <tr key={i}>
                    <td>{programName(e.programId)}</td>
                    <td className="num">{int(e.balance)}</td>
                    <td>{e.expiresAt ? shortDate(e.expiresAt) : "—"}</td>
                    <td className="num">{e.costPerThousand !== undefined ? brl2(e.costPerThousand) : "—"}</td>
                    <td>
                      <button className="btn btn-ghost btn-sm" type="button" onClick={() => setEntries(entries.filter((_, j) => j !== i))}>
                        Remover
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div>
        <h2>O que você consegue reunir em cada companhia</h2>
        <p className="muted">
          Saldo direto + transferências dos programas de banco, já com os bônus vigentes do radar. Ao integrar o
          primeiro fornecedor de disponibilidade com milhas (Fase 2), esta seção lista os voos que você consegue emitir.
        </p>
        <div className="grid grid-3">
          {airlines.map((p) => {
            const r = reachableMiles(entries, p.id, bonuses);
            return (
              <div key={p.id} className="card">
                <span className="badge">{p.name}</span>
                <div className="stat num" style={{ margin: "var(--space-3) 0" }}>
                  {int(r.total)} <span className="muted" style={{ fontSize: "0.9rem" }}>milhas</span>
                </div>
                <ul className="reach-list">
                  <li>Saldo direto: {int(r.direct)}</li>
                  {r.viaTransfer.map((t) => (
                    <li key={t.fromProgramId}>
                      + {int(t.milesObtained)} via {programName(t.fromProgramId)}
                      {t.bonusPercent > 0 && <span className="badge badge-success" style={{ marginLeft: 6 }}>+{t.bonusPercent}%</span>}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card">
        <h3>Seus dados</h3>
        <p className="muted">Apaga todos os saldos e retira o consentimento neste navegador.</p>
        <button className="btn btn-ghost" type="button" onClick={eraseAll}>
          Apagar minha carteira
        </button>
      </div>
    </div>
  );
}
