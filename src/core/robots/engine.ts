import type { FareChange, Store } from "./store";
import { SourceUnavailableError, type Robot, type RobotContext, type RobotOutput, type RouteRequest } from "./types";

// Motor dos robôs: decide quem está na hora, impede execuções simultâneas,
// grava resultados com deduplicação e histórico, gera eventos de mudança e
// registra falhas da fonte. Nunca preenche nada quando a fonte falha.

/** Queda mínima para virar alerta de oportunidade. */
const DROP_ALERT = 0.1;
/** Após falhas seguidas, espera mais antes de tentar de novo (até 8x a frequência). */
const MAX_BACKOFF = 8;

export function everyMinutes(robot: Robot, env: NodeJS.ProcessEnv = process.env): number {
  const v = Number(env[`ROBOT_${robot.id.toUpperCase().replace(/-/g, "_")}_EVERY_MIN`]);
  return Number.isFinite(v) && v >= 5 ? v : robot.everyMinutes;
}

/** Bloqueia robôs de navegador sem evidência de que os termos da fonte permitem automação. */
export function policyBlock(robot: Robot): string | null {
  if (robot.source.access === "navegador" && !robot.source.automationPermitted) {
    return "Automação de navegador sem permissão documentada nos termos da fonte";
  }
  if (robot.source.commercialUse === "nao_permitido") return "Os termos da fonte não permitem uso comercial";
  return null;
}

export function nextRunAt(robot: Robot, store: Store, env?: NodeJS.ProcessEnv): Date | null {
  const st = store.robotState(robot.id);
  if (!st?.last_run_at) return null; // nunca rodou: já está na hora
  const failures = Number(st.consecutive_failures ?? 0);
  const factor = Math.min(MAX_BACKOFF, 2 ** failures);
  return new Date(Date.parse(st.last_run_at as string) + everyMinutes(robot, env) * factor * 60_000);
}

export function isDue(robot: Robot, store: Store, now: Date, env?: NodeJS.ProcessEnv): boolean {
  const next = nextRunAt(robot, store, env);
  return !next || next <= now;
}

export interface RunReport {
  robotId: string;
  status: "ok" | "partial" | "error" | "skipped";
  message: string;
  calls: number;
  items: number;
  newItems: number;
  changes: number;
}

export async function runRobot(
  robot: Robot,
  store: Store,
  opts: { now?: () => Date; log?: (m: string) => void; timeoutMs?: number; job?: (ctx: RobotContext) => Promise<RobotOutput>; label?: string } = {},
): Promise<RunReport> {
  const now = opts.now ?? (() => new Date());
  const log = opts.log ?? (() => {});
  const skipped = (message: string): RunReport => ({ robotId: robot.id, status: "skipped", message, calls: 0, items: 0, newItems: 0, changes: 0 });

  const blocked = policyBlock(robot) ?? robot.notReady();
  if (blocked) return skipped(blocked);

  const runId = store.beginRun(robot.id, robot.source.id, now().toISOString());
  if (runId === null) return skipped("Já está em execução");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 10 * 60_000);
  let out: RobotOutput;
  try {
    const ctx: RobotContext = { now: now(), signal: controller.signal, log: (m) => log(`[${robot.id}] ${m}`) };
    out = await (opts.job ? opts.job(ctx) : robot.run(ctx));
  } catch (e) {
    clearTimeout(timer);
    const message = e instanceof Error ? e.message : String(e);
    const retryable = e instanceof SourceUnavailableError ? e.retryable : true;
    const at = now().toISOString();
    store.recordError({ at, sourceId: robot.source.id, robotId: robot.id, runId, message, retryable });
    store.finishRun(runId, robot.id, { status: "error", now: at, calls: 0, items: 0, newItems: 0, changes: 0, message });
    log(`[${robot.id}] falhou: ${message}`);
    return { robotId: robot.id, status: "error", message, calls: 0, items: 0, newItems: 0, changes: 0 };
  }
  clearTimeout(timer);

  const at = now().toISOString();
  for (const err of out.itemErrors) {
    store.recordError({ at, sourceId: robot.source.id, robotId: robot.id, runId, target: err.target, message: err.message, retryable: true });
  }

  let items = 0;
  let newItems = 0;
  let changes = 0;

  if (out.fares?.length) {
    store.expirePastFares(at.slice(0, 10));
    const r = store.upsertFares(robot.source.id, robot.id, out.fares);
    items += out.fares.length;
    newItems += r.inserted;
    changes += recordFareEvents(store, robot, r.changes, at);
  }

  for (const s of out.schedules ?? []) {
    const r = store.replaceSchedules(robot.source.id, s.origin, s.flights, s.fetchedAt, s.partial);
    items += s.flights.length;
    newItems += r.added.length;
    if (!r.firstLoad) {
      for (const d of r.newDestinations) {
        store.addEvent({ at, type: "route_added", sourceId: robot.source.id, ref: `${s.origin}-${d}`, message: `Nova rota direta ${s.origin} → ${d}` });
        changes++;
      }
      for (const d of r.lostDestinations) {
        store.addEvent({ at, type: "route_removed", sourceId: robot.source.id, ref: `${s.origin}-${d}`, message: `Rota direta ${s.origin} → ${d} saiu da malha` });
        changes++;
      }
    }
  }

  if (out.fx?.length) {
    items += out.fx.length;
    newItems += store.upsertFx(robot.source.id, out.fx);
  }

  const status = out.partial || out.itemErrors.length ? "partial" : "ok";
  const message = [
    opts.label ?? "",
    `${items} registros (${newItems} novos, ${changes} mudanças) em ${out.calls} consultas`,
    out.itemErrors.length ? `${out.itemErrors.length} falhas por item` : "",
    out.partial ? "coleta parcial" : "",
  ].filter(Boolean).join("; ");
  store.finishRun(runId, robot.id, { status, now: at, calls: out.calls, items, newItems, changes, message });
  log(`[${robot.id}] ${status}: ${message}`);
  return { robotId: robot.id, status, message, calls: out.calls, items, newItems, changes };
}

function recordFareEvents(store: Store, robot: Robot, list: FareChange[], at: string): number {
  let n = 0;
  for (const c of list) {
    const f = c.after;
    const route = `${f.origin} → ${f.destination} em ${f.departDate}`;
    const unit = f.kind === "cash" ? `${f.cashCurrency} ${f.cashAmount}` : `${f.miles} milhas (${f.program})`;
    if (c.type === "new_fare") continue; // novidade não é alerta; fica no histórico
    if (c.type === "price_drop" || c.type === "price_rise") {
      const before = c.before?.amount ?? 0;
      const now = (f.kind === "cash" ? f.cashAmount : f.miles) ?? 0;
      const pct = before ? Math.round(((now - before) / before) * 100) : 0;
      // só quedas relevantes viram oportunidade; o resto é variação comum
      const type = c.type === "price_drop" && -pct / 100 >= DROP_ALERT ? "price_drop" : "price_change";
      store.addEvent({ at, type, sourceId: robot.source.id, ref: c.key, message: `${route}: ${unit} (${pct > 0 ? "+" : ""}${pct}%)`, data: { before, now, pct } });
    } else {
      store.addEvent({ at, type: "availability_up", sourceId: robot.source.id, ref: c.key, message: `${route}: disponibilidade aumentou (${unit})`, data: { before: c.before, seats: f.seats } });
    }
    n++;
  }
  return n;
}

/** Roda, em sequência, todos os robôs na hora. Usado pelo agendador e pelo comando --once. */
export async function tick(robots: Robot[], store: Store, opts: { now?: () => Date; log?: (m: string) => void; force?: boolean } = {}): Promise<RunReport[]> {
  const now = opts.now ?? (() => new Date());
  const reports: RunReport[] = [];
  for (const r of robots) {
    if (r.onDemandOnly) continue; // só roda quando alguém busca
    if (!opts.force && !isDue(r, store, now())) continue;
    reports.push(await runRobot(r, store, opts));
  }
  return reports;
}

/** Intervalo mínimo entre atualizações sob demanda da mesma rota (protege a cota das fontes). */
const REFRESH_EVERY_MS = 15 * 60_000;

export interface RefreshReport {
  refreshed: boolean;
  message: string;
  reports: RunReport[];
}

/** Atualização sob demanda de uma rota, pelos robôs que oferecem coleta pontual. */
export async function refreshRoute(robots: Robot[], store: Store, q: RouteRequest, opts: { now?: () => Date } = {}): Promise<RefreshReport> {
  const now = opts.now ?? (() => new Date());
  const eligible = robots.filter((r) => r.collectRoute && !policyBlock(r) && !r.notReady());
  if (!eligible.length) return { refreshed: false, message: "Nenhuma fonte com atualização sob demanda está conectada.", reports: [] };
  const key = `${q.origin}-${q.destination}|${q.months.join(",")}${q.roundTrip ? `|rt:${q.roundTrip.departMonth}>${q.roundTrip.returnMonth}` : ""}${q.dates?.length ? `|d:${q.dates.join(",")}` : ""}${q.flex ? `|flex:${q.flex.months.join(",")}:${q.flex.minDays}-${q.flex.maxDays}` : ""}`;
  const last = store.lastRefresh(key);
  if (last && now().getTime() - Date.parse(last) < REFRESH_EVERY_MS) {
    return { refreshed: false, message: "Esta rota foi atualizada há poucos minutos.", reports: [] };
  }
  store.markRefresh(key, now().toISOString());
  const reports: RunReport[] = [];
  for (const r of eligible) {
    reports.push(await runRobot(r, store, { now, job: (ctx) => r.collectRoute!(q, ctx), label: `sob demanda ${q.origin}-${q.destination}`, timeoutMs: 60_000 }));
  }
  const ok = reports.some((r) => r.status === "ok" || r.status === "partial");
  return { refreshed: ok, message: ok ? "Resultados atualizados." : "As fontes não responderam agora.", reports };
}
