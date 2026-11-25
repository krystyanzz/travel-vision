import { createHash } from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";
import type { Availability, FareObservation, FxObservation, ScheduleObservation } from "./types";

// Persistência dos robôs em SQLite (módulo nativo node:sqlite, sem dependência
// externa). O esquema já separa estado atual e histórico para a migração ao
// PostgreSQL do backend. Não há dados pessoais aqui (LGPD).

type Db = DatabaseSync;
type Row = Record<string, unknown>;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS robot_state (
  robot_id TEXT PRIMARY KEY,
  running_since TEXT,
  last_run_at TEXT,
  last_ok_at TEXT,
  last_status TEXT,
  consecutive_failures INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS robot_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  robot_id TEXT NOT NULL,
  source_id TEXT NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  status TEXT NOT NULL,            -- running | ok | partial | error | skipped
  calls INTEGER NOT NULL DEFAULT 0,
  items INTEGER NOT NULL DEFAULT 0,
  new_items INTEGER NOT NULL DEFAULT 0,
  changes INTEGER NOT NULL DEFAULT 0,
  message TEXT
);
CREATE INDEX IF NOT EXISTS robot_runs_robot ON robot_runs (robot_id, started_at DESC);
CREATE TABLE IF NOT EXISTS source_errors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL,
  source_id TEXT NOT NULL,
  robot_id TEXT NOT NULL,
  run_id INTEGER,
  target TEXT,
  message TEXT NOT NULL,
  retryable INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS fares (
  key TEXT PRIMARY KEY,
  source_id TEXT NOT NULL,
  robot_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  origin TEXT NOT NULL,
  destination TEXT NOT NULL,
  depart_date TEXT NOT NULL,
  depart_at TEXT,
  return_date TEXT,
  carrier TEXT,
  flight_numbers TEXT,
  stops INTEGER,
  duration_min INTEGER,
  cabin TEXT,
  program TEXT,
  cash_amount REAL,
  cash_currency TEXT,
  miles INTEGER,
  taxes_amount REAL,
  taxes_currency TEXT,
  seats INTEGER,
  availability TEXT NOT NULL,
  deep_link TEXT,
  seller TEXT,
  first_seen TEXT NOT NULL,
  last_seen TEXT NOT NULL,
  observed_at TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS fares_route ON fares (origin, destination, depart_date);
CREATE TABLE IF NOT EXISTS fare_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fare_key TEXT NOT NULL,
  observed_at TEXT NOT NULL,
  cash_amount REAL,
  miles INTEGER,
  taxes_amount REAL,
  seats INTEGER,
  availability TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS fare_history_key ON fare_history (fare_key, observed_at);
CREATE TABLE IF NOT EXISTS schedules (
  key TEXT PRIMARY KEY,
  source_id TEXT NOT NULL,
  origin TEXT NOT NULL,
  destination TEXT NOT NULL,
  airline TEXT NOT NULL,
  flight TEXT NOT NULL,
  dep_time TEXT,
  arr_time TEXT,
  duration_min INTEGER,
  days TEXT,
  first_seen TEXT NOT NULL,
  last_seen TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS schedules_origin ON schedules (origin, active);
CREATE TABLE IF NOT EXISTS fx_rates (
  currency TEXT NOT NULL,
  quoted_at TEXT NOT NULL,
  buy REAL NOT NULL,
  sell REAL NOT NULL,
  bulletin TEXT NOT NULL,
  source_id TEXT NOT NULL,
  PRIMARY KEY (currency, quoted_at, bulletin)
);
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL,
  type TEXT NOT NULL,              -- price_drop | price_change | availability_up | route_added | route_removed
  source_id TEXT NOT NULL,
  ref TEXT,
  message TEXT NOT NULL,
  data TEXT
);
CREATE INDEX IF NOT EXISTS events_at ON events (at DESC);
CREATE TABLE IF NOT EXISTS refresh_log (
  key TEXT PRIMARY KEY,
  at TEXT NOT NULL
);
`;

let shared: Store | null = null;

/** Banco padrão em .data/travel-vision.db (fora do controle de versão). */
export function defaultStore(): Store {
  if (!shared) {
    const file = process.env.ROBOTS_DB_PATH ?? path.join(process.cwd(), ".data", "travel-vision.db");
    shared = openStore(file);
  }
  return shared;
}

export function openStore(file: string): Store {
  if (file !== ":memory:") mkdirSync(path.dirname(file), { recursive: true });
  // getBuiltinModule evita que o empacotador do Next tente resolver node:sqlite.
  // O aviso "SQLite is experimental" do Node 22 é suprimido só durante o carregamento.
  const emit = process.emitWarning;
  process.emitWarning = ((w: string | Error, ...rest: unknown[]) => {
    if (String(w).includes("SQLite")) return;
    return (emit as (...a: unknown[]) => void).call(process, w, ...rest);
  }) as typeof process.emitWarning;
  let mod: typeof import("node:sqlite");
  try {
    mod = process.getBuiltinModule("node:sqlite") as typeof import("node:sqlite");
  } finally {
    process.emitWarning = emit;
  }
  const { DatabaseSync } = mod;
  const db = new DatabaseSync(file);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;");
  db.exec(SCHEMA);
  migrate(db);
  return new Store(db);
}

/** Colunas acrescentadas depois da primeira versão do esquema (bancos já existentes). */
function migrate(db: Db) {
  const cols = new Set((db.prepare("PRAGMA table_info(fares)").all() as Row[]).map((c) => c.name as string));
  if (!cols.has("seller")) db.exec("ALTER TABLE fares ADD COLUMN seller TEXT");
  if (!cols.has("return_at")) db.exec("ALTER TABLE fares ADD COLUMN return_at TEXT");
  if (!cols.has("return_stops")) db.exec("ALTER TABLE fares ADD COLUMN return_stops INTEGER");
  if (!cols.has("return_duration_min")) db.exec("ALTER TABLE fares ADD COLUMN return_duration_min INTEGER");
  if (!cols.has("arrive_at")) db.exec("ALTER TABLE fares ADD COLUMN arrive_at TEXT");
}

export const fareKey = (sourceId: string, f: FareObservation) =>
  createHash("sha1")
    .update([sourceId, f.kind, f.origin, f.destination, f.departDate, f.departAt ?? "", f.returnDate ?? "", f.flightNumbers ?? f.carrier ?? "", f.cabin ?? "", f.program ?? ""].join("|"))
    .digest("hex")
    .slice(0, 20);

export interface FareChange {
  key: string;
  type: "new_fare" | "price_drop" | "price_rise" | "availability_up";
  before?: { amount: number | null; seats: number | null; availability: Availability };
  after: FareObservation;
}

/** Variação mínima para registrar mudança de preço (evita ruído de centavos). */
const PRICE_DELTA = 0.03;

export class Store {
  constructor(readonly db: Db) {}

  // ---------- execuções ----------

  /** Marca o robô como em execução. Devolve null se já houver execução recente (trava). */
  beginRun(robotId: string, sourceId: string, now: string, staleAfterMs = 30 * 60_000): number | null {
    const state = this.db.prepare("SELECT running_since FROM robot_state WHERE robot_id = ?").get(robotId) as Row | undefined;
    const since = state?.running_since as string | null | undefined;
    if (since && Date.parse(now) - Date.parse(since) < staleAfterMs) return null;
    this.db
      .prepare("INSERT INTO robot_state (robot_id, running_since) VALUES (?, ?) ON CONFLICT(robot_id) DO UPDATE SET running_since = excluded.running_since")
      .run(robotId, now);
    const r = this.db.prepare("INSERT INTO robot_runs (robot_id, source_id, started_at, status) VALUES (?, ?, ?, 'running')").run(robotId, sourceId, now);
    return Number(r.lastInsertRowid);
  }

  finishRun(runId: number, robotId: string, p: { status: "ok" | "partial" | "error"; now: string; calls: number; items: number; newItems: number; changes: number; message?: string }) {
    this.db
      .prepare("UPDATE robot_runs SET finished_at = ?, status = ?, calls = ?, items = ?, new_items = ?, changes = ?, message = ? WHERE id = ?")
      .run(p.now, p.status, p.calls, p.items, p.newItems, p.changes, p.message ?? null, runId);
    const ok = p.status !== "error";
    this.db
      .prepare(
        `UPDATE robot_state SET running_since = NULL, last_run_at = ?, last_status = ?,
         last_ok_at = CASE WHEN ? THEN ? ELSE last_ok_at END,
         consecutive_failures = CASE WHEN ? THEN 0 ELSE consecutive_failures + 1 END
         WHERE robot_id = ?`,
      )
      .run(p.now, p.status, ok ? 1 : 0, p.now, ok ? 1 : 0, robotId);
  }

  recordError(p: { at: string; sourceId: string; robotId: string; runId: number | null; target?: string; message: string; retryable: boolean }) {
    this.db
      .prepare("INSERT INTO source_errors (at, source_id, robot_id, run_id, target, message, retryable) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .run(p.at, p.sourceId, p.robotId, p.runId, p.target ?? null, p.message, p.retryable ? 1 : 0);
  }

  robotState(robotId: string) {
    return (this.db.prepare("SELECT * FROM robot_state WHERE robot_id = ?").get(robotId) as Row | undefined) ?? null;
  }

  recentRuns(limit = 30, robotId?: string) {
    return robotId
      ? (this.db.prepare("SELECT * FROM robot_runs WHERE robot_id = ? ORDER BY id DESC LIMIT ?").all(robotId, limit) as Row[])
      : (this.db.prepare("SELECT * FROM robot_runs ORDER BY id DESC LIMIT ?").all(limit) as Row[]);
  }

  /** Última execução bem-sucedida que trouxe dados: é a prova de que a fonte está conectada. */
  lastProvenRun(robotId: string) {
    return (this.db.prepare("SELECT * FROM robot_runs WHERE robot_id = ? AND status IN ('ok','partial') AND items > 0 ORDER BY id DESC LIMIT 1").get(robotId) as Row | undefined) ?? null;
  }

  recentErrors(limit = 20) {
    return this.db.prepare("SELECT * FROM source_errors ORDER BY id DESC LIMIT ?").all(limit) as Row[];
  }

  // ---------- tarifas ----------

  /** Grava observações com deduplicação; devolve as mudanças detectadas. */
  upsertFares(sourceId: string, robotId: string, list: FareObservation[]): { inserted: number; changes: FareChange[] } {
    const get = this.db.prepare("SELECT cash_amount, miles, seats, availability FROM fares WHERE key = ?");
    const insert = this.db.prepare(
      `INSERT INTO fares (key, source_id, robot_id, kind, origin, destination, depart_date, depart_at, return_date, carrier, flight_numbers,
        stops, duration_min, cabin, program, cash_amount, cash_currency, miles, taxes_amount, taxes_currency, seats, availability, deep_link,
        seller, return_at, return_stops, return_duration_min, arrive_at, first_seen, last_seen, observed_at, active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    );
    const update = this.db.prepare(
      `UPDATE fares SET cash_amount = ?, cash_currency = ?, miles = ?, taxes_amount = ?, taxes_currency = ?, seats = ?, availability = ?,
        deep_link = ?, seller = ?, stops = ?, duration_min = ?, last_seen = ?, observed_at = ?, active = 1 WHERE key = ?`,
    );
    const history = this.db.prepare("INSERT INTO fare_history (fare_key, observed_at, cash_amount, miles, taxes_amount, seats, availability) VALUES (?, ?, ?, ?, ?, ?, ?)");

    const changes: FareChange[] = [];
    let inserted = 0;
    const seen = new Set<string>();
    this.db.exec("BEGIN");
    try {
      for (const f of list) {
        const key = fareKey(sourceId, f);
        if (seen.has(key)) continue; // a mesma resposta pode repetir o voo
        seen.add(key);
        const prev = get.get(key) as Row | undefined;
        const amount = f.kind === "cash" ? f.cashAmount : f.miles;
        if (!prev) {
          insert.run(key, sourceId, robotId, f.kind, f.origin, f.destination, f.departDate, f.departAt, f.returnDate, f.carrier, f.flightNumbers,
            f.stops, f.durationMin, f.cabin, f.program, f.cashAmount, f.cashCurrency, f.miles, f.taxesAmount, f.taxesCurrency, f.seats,
            f.availability, f.deepLink, f.seller ?? null, f.returnAt ?? null, f.returnStops ?? null, f.returnDurationMin ?? null, f.arriveAt ?? null,
            f.observedAt, f.observedAt, f.observedAt);
          history.run(key, f.observedAt, f.cashAmount, f.miles, f.taxesAmount, f.seats, f.availability);
          inserted++;
          changes.push({ key, type: "new_fare", after: f });
          continue;
        }
        const before = { amount: (f.kind === "cash" ? prev.cash_amount : prev.miles) as number | null, seats: prev.seats as number | null, availability: prev.availability as Availability };
        update.run(f.cashAmount, f.cashCurrency, f.miles, f.taxesAmount, f.taxesCurrency, f.seats, f.availability, f.deepLink, f.seller ?? null, f.stops, f.durationMin,
          f.observedAt, f.observedAt, key);
        const priceMoved = before.amount != null && amount != null && Math.abs(amount - before.amount) / before.amount >= PRICE_DELTA;
        const seatsUp = (f.seats ?? 0) > (before.seats ?? 0) || (before.availability !== "confirmada" && f.availability === "confirmada");
        if (priceMoved || seatsUp || before.availability !== f.availability) {
          history.run(key, f.observedAt, f.cashAmount, f.miles, f.taxesAmount, f.seats, f.availability);
        }
        if (priceMoved) changes.push({ key, type: amount! < before.amount! ? "price_drop" : "price_rise", before, after: f });
        if (seatsUp) changes.push({ key, type: "availability_up", before, after: f });
      }
      this.db.exec("COMMIT");
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
    return { inserted, changes };
  }

  faresForRoute(origin: string, destination: string, fromDate?: string, toDate?: string) {
    return this.db
      .prepare(
        `SELECT * FROM fares WHERE origin = ? AND destination = ? AND active = 1 AND depart_date >= ? AND depart_date <= ?
         ORDER BY depart_date, COALESCE(cash_amount, miles)`,
      )
      .all(origin, destination, fromDate ?? "0000", toDate ?? "9999") as Row[];
  }

  latestFares(limit = 40) {
    return this.db.prepare("SELECT * FROM fares WHERE active = 1 ORDER BY observed_at DESC, cash_amount LIMIT ?").all(limit) as Row[];
  }

  fareHistory(key: string) {
    return this.db.prepare("SELECT * FROM fare_history WHERE fare_key = ? ORDER BY observed_at").all(key) as Row[];
  }

  /** Preços já vistos numa rota/mês (para dizer se o preço atual é baixo). */
  routePriceSamples(origin: string, destination: string, month: string, kind: "cash" | "award") {
    const col = kind === "cash" ? "cash_amount" : "miles";
    return (
      this.db
        .prepare(
          `SELECT h.${col} AS v FROM fare_history h JOIN fares f ON f.key = h.fare_key
           WHERE f.origin = ? AND f.destination = ? AND f.kind = ? AND substr(f.depart_date, 1, 7) = ? AND h.${col} IS NOT NULL`,
        )
        .all(origin, destination, kind, month) as Row[]
    ).map((r) => Number(r.v));
  }

  /** Datas que já passaram viram histórico: não podem mais aparecer como oferta. */
  expirePastFares(today: string) {
    this.db.prepare("UPDATE fares SET active = 0, availability = 'historico' WHERE active = 1 AND depart_date < ?").run(today);
  }

  // ---------- malha ----------

  replaceSchedules(sourceId: string, origin: string, flights: ScheduleObservation[], now: string, partial: boolean) {
    const key = (s: ScheduleObservation) => `${sourceId}|${s.flight}|${s.depTime}|${s.days.join(",")}`;
    const current = new Map((this.db.prepare("SELECT key, destination, flight FROM schedules WHERE source_id = ? AND origin = ? AND active = 1").all(sourceId, origin) as Row[]).map((r) => [r.key as string, r]));
    const upsert = this.db.prepare(
      `INSERT INTO schedules (key, source_id, origin, destination, airline, flight, dep_time, arr_time, duration_min, days, first_seen, last_seen, active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
       ON CONFLICT(key) DO UPDATE SET last_seen = excluded.last_seen, arr_time = excluded.arr_time, duration_min = excluded.duration_min, active = 1`,
    );
    const added: ScheduleObservation[] = [];
    const removed: Row[] = [];
    const destinationsBefore = new Set([...current.values()].map((r) => r.destination as string));
    this.db.exec("BEGIN");
    try {
      for (const s of flights) {
        const k = key(s);
        if (!current.has(k)) added.push(s);
        current.delete(k);
        upsert.run(k, sourceId, origin, s.destination, s.airline, s.flight, s.depTime, s.arrTime, s.durationMin, s.days.join(","), now, now);
      }
      // Numa coleta parcial, ausência não prova cancelamento: só desativa com coleta completa.
      if (!partial) {
        const off = this.db.prepare("UPDATE schedules SET active = 0 WHERE key = ?");
        for (const [k, r] of current) {
          off.run(k);
          removed.push(r);
        }
      }
      this.db.exec("COMMIT");
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
    const destinationsAfter = new Set((this.db.prepare("SELECT DISTINCT destination FROM schedules WHERE source_id = ? AND origin = ? AND active = 1").all(sourceId, origin) as Row[]).map((r) => r.destination as string));
    return {
      added,
      removed,
      newDestinations: [...destinationsAfter].filter((d) => !destinationsBefore.has(d)),
      lostDestinations: [...destinationsBefore].filter((d) => !destinationsAfter.has(d)),
      firstLoad: destinationsBefore.size === 0,
    };
  }

  scheduleSummary() {
    return this.db
      .prepare(
        `SELECT origin, COUNT(*) AS flights, COUNT(DISTINCT destination) AS destinations, COUNT(DISTINCT airline) AS airlines, MAX(last_seen) AS last_seen
         FROM schedules WHERE active = 1 GROUP BY origin ORDER BY origin`,
      )
      .all() as Row[];
  }

  // ---------- câmbio ----------

  upsertFx(sourceId: string, list: FxObservation[]): number {
    const st = this.db.prepare("INSERT OR IGNORE INTO fx_rates (currency, quoted_at, buy, sell, bulletin, source_id) VALUES (?, ?, ?, ?, ?, ?)");
    let n = 0;
    for (const r of list) n += Number(st.run(r.currency, r.quotedAt, r.buy, r.sell, r.bulletin, sourceId).changes);
    return n;
  }

  latestFx(currency: string) {
    // o boletim de fechamento sai com o mesmo horário do último intermediário e é o oficial do dia
    return (
      (this.db
        .prepare("SELECT * FROM fx_rates WHERE currency = ? ORDER BY substr(quoted_at, 1, 10) DESC, bulletin = 'Fechamento' DESC, quoted_at DESC LIMIT 1")
        .get(currency.toUpperCase()) as Row | undefined) ?? null
    );
  }

  // ---------- atualização sob demanda ----------

  lastRefresh(key: string): string | null {
    return ((this.db.prepare("SELECT at FROM refresh_log WHERE key = ?").get(key) as Row | undefined)?.at as string) ?? null;
  }

  markRefresh(key: string, at: string) {
    this.db.prepare("INSERT INTO refresh_log (key, at) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET at = excluded.at").run(key, at);
  }

  // ---------- eventos e alertas ----------

  addEvent(p: { at: string; type: string; sourceId: string; ref?: string; message: string; data?: unknown }) {
    this.db.prepare("INSERT INTO events (at, type, source_id, ref, message, data) VALUES (?, ?, ?, ?, ?, ?)").run(p.at, p.type, p.sourceId, p.ref ?? null, p.message, p.data === undefined ? null : JSON.stringify(p.data));
  }

  recentEvents(limit = 30, types?: string[]) {
    if (types?.length) {
      return this.db.prepare(`SELECT * FROM events WHERE type IN (${types.map(() => "?").join(",")}) ORDER BY id DESC LIMIT ?`).all(...types, limit) as Row[];
    }
    return this.db.prepare("SELECT * FROM events ORDER BY id DESC LIMIT ?").all(limit) as Row[];
  }
}
