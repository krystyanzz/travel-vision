import type { Metadata } from "next";
import Link from "next/link";
import { AutoRefresh } from "@/components/AutoRefresh";
import { ago, AvailabilityBadge, dateTime, FreshBadge, money, OpportunityBadge } from "@/components/FareBadges";
import { duration, int } from "@/components/format";
import { robotsDashboard } from "@/core/robots/dashboard";
import type { ConnectionStatus, RobotStatus } from "@/core/robots/registry";

export const metadata: Metadata = { title: "Painel técnico", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const CONNECTION: Record<ConnectionStatus, { label: string; cls: string }> = {
  conectada: { label: "Conectada · consulta real comprovada", cls: "badge-success" },
  configurada_sem_prova: { label: "Configurada, sem consulta comprovada", cls: "badge-warning" },
  nao_configurada: { label: "Não configurada", cls: "" },
  bloqueada: { label: "Bloqueada pela política", cls: "badge-danger" },
  sem_fonte: { label: "Sem fonte autorizada", cls: "" },
};

const PRODUCES: Record<RobotStatus["produces"], string> = {
  fares_cash: "Preços em dinheiro",
  fares_award: "Resgates com milhas",
  schedules: "Malha aérea (sem preço)",
  fx: "Câmbio oficial",
};

const EVENT_LABEL: Record<string, string> = {
  price_drop: "Queda de preço",
  price_change: "Variação de preço",
  availability_up: "Mais disponibilidade",
  route_added: "Rota nova",
  route_removed: "Rota extinta",
};

function every(min: number) {
  if (min % 1440 === 0) return `a cada ${min / 1440} dia${min > 1440 ? "s" : ""}`;
  if (min % 60 === 0) return `a cada ${min / 60} h`;
  return `a cada ${min} min`;
}

function RobotState({ r }: { r: RobotStatus }) {
  if (r.running) return <span className="robot-state is-running"><span className="live-dot" aria-hidden /> Robô em execução</span>;
  if (r.connection === "nao_configurada" || r.connection === "bloqueada") return <span className="robot-state is-idle">Parado</span>;
  if (r.lastStatus === "error") return <span className="robot-state is-down">Fonte temporariamente indisponível</span>;
  if (r.lastStatus === "partial") return <span className="robot-state is-partial">Última coleta parcial</span>;
  if (r.lastStatus === "ok") return <span className="robot-state is-ok">Operando</span>;
  return <span className="robot-state is-idle">Aguardando primeira execução</span>;
}

export default function RobotsPage() {
  const d = robotsDashboard();
  const priceRobotsConnected = d.robots.filter((r) => r.produces.startsWith("fares") && r.connection === "conectada").length;

  return (
    <div className="page">
      <AutoRefresh seconds={30} />
      <div className="container">
        <div className="page-head">
          <span className="eyebrow">Área administrativa</span>
          <h1>Robôs, fontes e cotas</h1>
          <p className="muted">
            Cada robô consulta uma fonte autorizada, grava o resultado com data e origem e compara com a coleta anterior. Uma fonte só
            aparece como conectada depois de uma consulta real bem-sucedida registrada no banco.
          </p>
        </div>

        {!process.env.ADMIN_PASSWORD && (
          <div className="notice notice-warning" role="status" style={{ marginBottom: "var(--space-4)" }}>
            <strong>Área sem senha.</strong>
            <span>Aberta só porque o servidor está em desenvolvimento. Defina <code>ADMIN_PASSWORD</code> em <code>.env.local</code>; em produção, sem senha, esta área responde 404.</span>
          </div>
        )}

        <h2 className="section-title">Consumo de cotas</h2>
        <div className="table-wrap card" style={{ marginBottom: "var(--space-5)" }}>
          <table className="table">
            <thead><tr><th>Fonte</th><th>Consultas hoje</th><th>Teto diário</th><th>Cota mensal restante (informada pela fonte)</th><th>Reserva</th></tr></thead>
            <tbody>
              {d.quotas.map((q) => (
                <tr key={q.source}>
                  <td>{q.source}</td>
                  <td className="num">{q.today}</td>
                  <td className="num">{q.dailyCap}</td>
                  <td className="num">{q.monthlyRemaining ?? "ainda não informada"}</td>
                  <td className="num">{q.monthlyReserve}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {priceRobotsConnected === 0 && (
          <div className="notice notice-warning" role="status" style={{ marginBottom: "var(--space-5)" }}>
            <strong>Nenhuma fonte de preços conectada.</strong>
            <span>
              Sem fonte autorizada não há preço para mostrar, e o sistema não inventa resultados. Para ligar os preços em dinheiro, coloque
              o <code>TRAVELPAYOUTS_TOKEN</code> em <code>.env.local</code>. Para os programas de milhas, falta parceria ou fornecedor
              licenciado (lista abaixo).
            </span>
          </div>
        )}

        <h2 className="section-title">Robôs</h2>
        <div className="grid grid-3 robot-grid">
          {d.robots.map((r) => (
            <article key={r.id} className="card robot-card">
              <div className="robot-card-head">
                <RobotState r={r} />
                <span className={`badge ${CONNECTION[r.connection].cls}`}>{CONNECTION[r.connection].label}</span>
              </div>
              <h3>{r.name}</h3>
              <p className="muted robot-meta">
                {PRODUCES[r.produces]} · {r.source.name}
                <br />
                Acesso: {r.source.access.replace("_", " ")} · {every(r.everyMinutes)}
              </p>
              <dl className="robot-facts">
                <div><dt>Última execução</dt><dd>{r.lastRunAt ? `${dateTime(r.lastRunAt)} (${ago(r.lastRunAt)})` : "nunca"}</dd></div>
                <div><dt>Próxima</dt><dd>{r.nextRunAt === "agora" ? "na próxima verificação" : r.nextRunAt ? dateTime(r.nextRunAt) : "—"}</dd></div>
                {r.proof && <div><dt>Prova</dt><dd>Execução #{r.proof.runId}, {dateTime(r.proof.at)}: {r.proof.message}</dd></div>}
                {r.consecutiveFailures > 0 && <div><dt>Falhas seguidas</dt><dd>{r.consecutiveFailures} (intervalo aumentado)</dd></div>}
              </dl>
              {r.reason && <p className="robot-reason">{r.reason}</p>}
              <p className="robot-terms">
                Uso comercial: {r.source.commercialUse.replace("_", " ")} ·{" "}
                <a href={r.source.termsUrl} target="_blank" rel="noopener">termos</a>
              </p>
            </article>
          ))}
        </div>

        <h2 className="section-title">Preços encontrados</h2>
        {d.fares.length === 0 ? (
          <div className="card empty-state">
            <p>Nenhum preço coletado até agora.</p>
            <p className="muted">Os preços aparecem aqui assim que um robô de preços conectado fizer a primeira coleta.</p>
          </div>
        ) : (
          <div className="table-wrap card">
            <table className="table">
              <thead>
                <tr><th>Rota</th><th>Data</th><th>Voo</th><th>Preço</th><th>Situação</th><th>Fonte · consulta</th><th /></tr>
              </thead>
              <tbody>
                {d.fares.map((f) => (
                  <tr key={f.key}>
                    <td><strong>{f.origin} → {f.destination}</strong></td>
                    <td>{f.departAt ? dateTime(f.departAt) : f.departDate}</td>
                    <td>
                      {f.flightNumbers ?? f.carrier ?? "—"}
                      <span className="muted"> · {f.stops === 0 ? "direto" : f.stops != null ? `${f.stops} escala(s)` : "escalas ?"}{f.durationMin ? ` · ${duration(f.durationMin)}` : ""}</span>
                    </td>
                    <td className="num">
                      {f.kind === "cash" && f.cashAmount != null && f.cashCurrency ? money(f.cashAmount, f.cashCurrency) : null}
                      {f.kind === "award" && f.miles != null ? `${int(f.miles)} milhas${f.taxesAmount != null && f.taxesCurrency ? ` + ${money(f.taxesAmount, f.taxesCurrency)}` : ""}` : null}
                    </td>
                    <td className="badge-row">
                      <AvailabilityBadge value={f.availability} />
                      {f.recent && <FreshBadge />}
                      {f.opportunity && <OpportunityBadge />}
                    </td>
                    <td className="muted">{f.sourceId} · {ago(f.observedAt)}</td>
                    <td>{f.deepLink && <a className="btn btn-ghost btn-sm" href={f.deepLink} target="_blank" rel="noopener sponsored">Ver no parceiro</a>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="grid grid-2" style={{ marginTop: "var(--space-6)" }}>
          <section className="card">
            <h3>Câmbio oficial (PTAX)</h3>
            {d.fx.length === 0 ? <p className="muted">Sem cotações coletadas.</p> : (
              <table className="table">
                <thead><tr><th>Moeda</th><th>Venda</th><th>Boletim</th><th>Cotação</th></tr></thead>
                <tbody>
                  {d.fx.map((r) => (
                    <tr key={r.currency}>
                      <td>{r.currency}</td>
                      <td className="num">R$ {r.sell.toFixed(4).replace(".", ",")}</td>
                      <td>{r.bulletin}</td>
                      <td className="muted">{dateTime(r.quotedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <p className="muted robot-terms">Fonte: Banco Central do Brasil. Usado só para converter preços em outra moeda, sempre com a cotação visível.</p>
          </section>
          <section className="card">
            <h3>Malha aérea monitorada</h3>
            {d.schedules.length === 0 ? <p className="muted">Sem malha coletada.</p> : (
              <table className="table">
                <thead><tr><th>Aeroporto</th><th>Voos regulares</th><th>Destinos</th><th>Companhias</th><th>Coleta</th></tr></thead>
                <tbody>
                  {d.schedules.map((s) => (
                    <tr key={s.origin as string}>
                      <td><Link href={`/explorar?de=${s.origin}`}>{s.origin as string}</Link></td>
                      <td className="num">{int(Number(s.flights))}</td>
                      <td className="num">{int(Number(s.destinations))}</td>
                      <td className="num">{int(Number(s.airlines))}</td>
                      <td className="muted">{ago(s.last_seen as string)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <p className="muted robot-terms">Fonte: AirLabs. Malha programada, sem preço. Aeroportos grandes podem vir parciais no plano gratuito.</p>
          </section>
        </div>

        <h2 className="section-title">Programas de fidelidade</h2>
        <div className="table-wrap card">
          <table className="table">
            <thead><tr><th>Programa</th><th>Status</th><th>O que falta</th></tr></thead>
            <tbody>
              {d.programs.map((p) => (
                <tr key={p.id}>
                  <td><strong>{p.name}</strong></td>
                  <td><span className={`badge ${CONNECTION[p.connection].cls}`}>{CONNECTION[p.connection].label}</span></td>
                  <td className="muted">{p.blocker}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="grid grid-2" style={{ marginTop: "var(--space-6)" }}>
          <section className="card">
            <h3>Alertas e mudanças</h3>
            {d.events.length === 0 ? <p className="muted">Nenhuma mudança detectada ainda. Mudanças aparecem a partir da segunda coleta de cada fonte.</p> : (
              <ul className="event-list">
                {d.events.map((e) => (
                  <li key={e.id as number}>
                    <span className={`badge ${e.type === "price_drop" || e.type === "availability_up" ? "badge-opportunity" : ""}`}>{EVENT_LABEL[e.type as string] ?? (e.type as string)}</span>
                    <span>{e.message as string}</span>
                    <span className="muted">{ago(e.at as string)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="card">
            <h3>Erros das fontes</h3>
            {d.errors.length === 0 ? <p className="muted">Nenhum erro registrado.</p> : (
              <ul className="event-list">
                {d.errors.map((e) => (
                  <li key={e.id as number}>
                    <span className="badge badge-danger">{e.source_id as string}</span>
                    <span>{e.target ? `${e.target}: ` : ""}{e.message as string}</span>
                    <span className="muted">{ago(e.at as string)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <h2 className="section-title">Registro de execuções</h2>
        <div className="table-wrap card">
          <table className="table">
            <thead><tr><th>#</th><th>Robô</th><th>Início</th><th>Status</th><th>Consultas</th><th>Registros</th><th>Resumo</th></tr></thead>
            <tbody>
              {d.runs.length === 0 && <tr><td colSpan={7} className="muted">Nenhuma execução ainda. Rode <code>npm run robots</code>.</td></tr>}
              {d.runs.map((r) => (
                <tr key={r.id as number}>
                  <td className="num">{r.id as number}</td>
                  <td>{r.robot_id as string}</td>
                  <td>{dateTime(r.started_at as string)}</td>
                  <td><span className={`badge ${r.status === "ok" ? "badge-success" : r.status === "error" ? "badge-danger" : r.status === "running" ? "" : "badge-warning"}`}>{r.status as string}</span></td>
                  <td className="num">{r.calls as number}</td>
                  <td className="num">{int(Number(r.items))}</td>
                  <td className="muted">{(r.message as string) ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
