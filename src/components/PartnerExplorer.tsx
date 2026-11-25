"use client";

import { useEffect, useState } from "react";
import { LOYALTY_PROGRAMS } from "@/core/partners/data";
import type { ProgramMatch, ProgramPartners } from "@/core/partners/partners";
import { AirportInput } from "./AirportInput";
import { ago } from "./FareBadges";

// "Mapa de parceiros": por programa (onde dá para emitir) ou por destino (quais
// programas chegam lá). Parceria de resgate ≠ aliança; cada linha mostra a evidência.

export const EVIDENCE_LABEL = { oficial: "Fonte oficial", secundaria: "Fonte secundária", conflito: "Informação conflitante" } as const;
const EVIDENCE_CLASS = { oficial: "badge-success", secundaria: "badge-warning", conflito: "badge-danger" } as const;

interface Unreviewed {
  id: string;
  name: string;
  alliance: string | null;
  url: string;
}

export function UnreviewedNote({ list }: { list: Unreviewed[] }) {
  if (!list.length) return null;
  return (
    <p className="muted partner-note">
      Ainda não conferimos as parceiras de {list.map((p) => p.name).join(", ")}. Estar na mesma aliança não garante
      resgate, por isso esses programas não aparecem nas respostas até a validação.
    </p>
  );
}

export function ProgramMatches({ programs }: { programs: ProgramMatch[] }) {
  if (!programs.length) return <p className="muted">Nenhum programa validado emite nas companhias desta rota.</p>;
  return (
    <ul className="partner-list">
      {programs.map((m) => (
        <li key={m.program.id} className="partner-item">
          <div className="partner-head">
            <strong>{m.program.name}</strong>
            <a href={m.program.officialPartnersUrl} target="_blank" rel="noopener" className="muted partner-link">regras oficiais</a>
          </div>
          <div className="badge-row">
            {m.via.map((v) => (
              <span key={v.airline} className={`badge ${EVIDENCE_CLASS[v.evidence]}`} title={EVIDENCE_LABEL[v.evidence]}>
                {v.airlineName} · {EVIDENCE_LABEL[v.evidence].toLowerCase()}
              </span>
            ))}
            {m.disputed.map((v) => (
              <span key={v.airline} className="badge badge-danger" title={v.note}>
                {v.airlineName} · conflitante
              </span>
            ))}
          </div>
          <p className="muted partner-how">{m.program.howToRedeem}</p>
        </li>
      ))}
    </ul>
  );
}

function ByProgram() {
  const reviewed = LOYALTY_PROGRAMS.filter((p) => p.partnersReviewed);
  const [id, setId] = useState(reviewed[0].id);
  const [data, setData] = useState<(ProgramPartners & { unreviewed: Unreviewed[] }) | null>(null);
  useEffect(() => {
    setData(null);
    fetch(`/api/parceiros?programa=${id}`).then((r) => r.json()).then(setData).catch(() => {});
  }, [id]);
  return (
    <section className="card partner-card">
      <h3>Tenho milhas em…</h3>
      <div className="seg" role="radiogroup" aria-label="Programa">
        {reviewed.map((p) => (
          <button key={p.id} type="button" role="radio" aria-checked={id === p.id} className={id === p.id ? "is-on" : ""} onClick={() => setId(p.id)}>
            {p.name}
          </button>
        ))}
      </div>
      {!data ? (
        <p className="muted">Carregando…</p>
      ) : (
        <>
          <p className="muted partner-how">{data.program.howToRedeem}</p>
          <ul className="airline-grid">
            {data.partners.map((p) => (
              <li key={p.airline}>
                <span>{p.airlineName}</span>
                <span className={`badge ${EVIDENCE_CLASS[p.evidence]}`}>{EVIDENCE_LABEL[p.evidence]}</span>
              </li>
            ))}
          </ul>
          {data.disputed.length > 0 && (
            <div className="notice notice-warning partner-disputed">
              <strong>Conflitantes:</strong>
              <span>{data.disputed.map((d) => `${d.airlineName} (${d.note})`).join(" · ")}</span>
            </div>
          )}
          <p className="muted partner-note">
            Lista conferida em 02/11/2026 ·{" "}
            <a href={data.program.officialPartnersUrl} target="_blank" rel="noopener">página oficial do programa</a>. Parceria não garante assento: a emissão depende de
            disponibilidade liberada pela companhia.
          </p>
        </>
      )}
    </section>
  );
}

interface DestinationAnswer {
  status: "ok" | "sem_malha" | "limite" | "erro";
  airlines?: { code: string; name: string; weekly: number }[];
  programs?: ProgramMatch[];
  fetchedAt?: string;
  partial?: boolean;
  unreviewed: Unreviewed[];
}

function ByDestination() {
  const [dest, setDest] = useState("GIG");
  const [data, setData] = useState<DestinationAnswer | null>(null);
  const [loading, setLoading] = useState(false);
  const load = (consult: boolean) => {
    setLoading(true);
    fetch(`/api/parceiros?destino=${dest}${consult ? "&consultar=1" : ""}`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData({ status: "erro", unreviewed: [] }))
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    setData(null);
    if (/^[A-Z]{3}$/.test(dest)) load(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dest]);

  return (
    <section className="card partner-card">
      <h3>Quero ir para…</h3>
      <AirportInput id="partner-dest" label="Destino" value={dest} onChange={setDest} placeholder="Cidade ou aeroporto" />
      {!data || loading ? (
        <p className="muted">Carregando…</p>
      ) : data.status === "sem_malha" ? (
        <div className="partner-empty">
          <p className="muted">Ainda não temos a malha aérea de {dest}. Consultar agora usa a cota diária da fonte de rotas.</p>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => load(true)}>
            Consultar companhias que operam em {dest}
          </button>
        </div>
      ) : data.status === "limite" ? (
        <p className="muted">O limite diário de consultas de rotas foi atingido. Tente amanhã.</p>
      ) : data.status === "erro" ? (
        <p className="muted">Não foi possível consultar agora.</p>
      ) : (
        <>
          <p className="muted partner-how">
            Companhias com voos regulares em {dest}: {data.airlines!.slice(0, 8).map((a) => a.name).join(", ")}
            {data.partial ? " (malha parcial)" : ""} · rotas da AirLabs, {ago(data.fetchedAt)}.
          </p>
          <ProgramMatches programs={data.programs!} />
        </>
      )}
      {data && <UnreviewedNote list={data.unreviewed} />}
    </section>
  );
}

export function PartnerExplorer() {
  return (
    <div className="grid grid-2 partner-explorer">
      <ByProgram />
      <ByDestination />
    </div>
  );
}
