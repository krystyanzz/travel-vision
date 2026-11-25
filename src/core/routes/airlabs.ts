import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { QuotaExceededError } from "../providers/quota";
import { ProviderError } from "../providers/types";
import type { DeparturesResult, RouteFlight, RoutesProvider, Weekday } from "./types";

// Adaptador AirLabs (Routes API v9). Rotas mudam devagar, então tudo fica em
// cache em disco (.cache/airlabs) para poupar a cota: 7 dias para rotas e 90
// dias para nomes de companhias. A chave fica só no servidor.

const API = "https://airlabs.co/api/v9";
const ROUTES_TTL = 7 * 86_400_000;
const AIRLINES_TTL = 90 * 86_400_000;

interface Options {
  apiKey: string;
  cacheDir: string;
  pageSize: number; // 50 no plano gratuito
  maxCalls: number; // teto de consultas por aeroporto
  /** Companhias consultadas uma a uma quando a primeira página não traz tudo. */
  candidateAirlines: string[];
  /** true só se a lista acima cobre com certeza todas as companhias do aeroporto. */
  candidatesAreExhaustive: boolean;
  /** Teto de consultas por dia (contado no disco, vale para o site e os robôs juntos). */
  dailyCallBudget: number;
  /** Para de consultar quando a cota mensal informada pela AirLabs chega a este valor. */
  monthlyReserve: number;
  now?: () => Date;
}

interface Budget {
  day: string;
  calls: number;
  remaining: number | null; // cota mensal restante segundo a AirLabs
}

interface AirlabsRoute {
  airline_iata: string | null;
  flight_iata: string | null;
  cs_flight_iata: string | null;
  dep_iata: string;
  arr_iata: string;
  dep_time: string;
  arr_time: string;
  duration: number | null;
  days: Weekday[] | null;
}

interface AirlabsBody<T> {
  request?: { key?: { limits_total?: number }; has_more?: boolean };
  response?: T;
  error?: { message: string; code: string };
}

export function createAirlabsProvider(opts: Options): RoutesProvider {
  let remaining: number | null = null;
  let calls = 0;

  async function cached<T>(name: string, ttl: number, load: () => Promise<T>): Promise<T> {
    const file = path.join(opts.cacheDir, `${name}.json`);
    try {
      const hit = JSON.parse(await readFile(file, "utf8")) as { at: number; value: T };
      if (Date.now() - hit.at < ttl) return hit.value;
    } catch {}
    const value = await load();
    await mkdir(opts.cacheDir, { recursive: true });
    await writeFile(file, JSON.stringify({ at: Date.now(), value }));
    return value;
  }

  const budgetFile = path.join(opts.cacheDir, "budget.json");
  const today = () => (opts.now?.() ?? new Date()).toISOString().slice(0, 10);

  async function readBudget(): Promise<Budget> {
    try {
      const b = JSON.parse(await readFile(budgetFile, "utf8")) as Budget;
      return b.day === today() ? b : { day: today(), calls: 0, remaining: b.remaining };
    } catch {
      return { day: today(), calls: 0, remaining: null };
    }
  }

  async function writeBudget(b: Budget) {
    await mkdir(opts.cacheDir, { recursive: true });
    await writeFile(budgetFile, JSON.stringify(b));
  }

  /** Reserva uma consulta ou recusa (nunca passa do teto diário nem da reserva mensal). */
  async function reserveCall() {
    const b = await readBudget();
    const msToMidnight = Date.parse(`${b.day}T23:59:59.999Z`) - (opts.now?.() ?? new Date()).getTime();
    if (b.calls >= opts.dailyCallBudget) throw new QuotaExceededError("airlabs", Math.max(60_000, msToMidnight));
    if (b.remaining !== null && b.remaining <= opts.monthlyReserve) throw new QuotaExceededError("airlabs", Math.max(60_000, msToMidnight));
    b.calls++;
    await writeBudget(b);
  }

  async function call<T>(method: string, params: Record<string, string | number>): Promise<AirlabsBody<T>> {
    await reserveCall();
    const qs = new URLSearchParams({ api_key: opts.apiKey, ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])) });
    calls++;
    const res = await fetch(`${API}/${method}?${qs}`);
    if (!res.ok) throw new ProviderError("airlabs", `HTTP ${res.status}`, res.status === 429 || res.status >= 500);
    const body = (await res.json()) as AirlabsBody<T>;
    if (body.error) throw new ProviderError("airlabs", `${body.error.code}: ${body.error.message}`);
    if (typeof body.request?.key?.limits_total === "number") {
      remaining = body.request.key.limits_total;
      await writeBudget({ ...(await readBudget()), remaining });
    }
    return body;
  }

  return {
    info: {
      id: "airlabs",
      name: "AirLabs",
      attribution: "Rotas: AirLabs",
      license: { commercialUse: "a_confirmar", redistribution: "a_confirmar", termsUrl: "https://airlabs.co/terms-of-service" },
    },

    async peekDepartures(iata) {
      // só o que já está em cache, de qualquer idade: não gasta cota
      try {
        const hit = JSON.parse(await readFile(path.join(opts.cacheDir, `routes-${iata}.json`), "utf8")) as { value: DeparturesResult };
        return hit.value;
      } catch {
        return null;
      }
    },

    departures(iata) {
      return cached<DeparturesResult>(`routes-${iata}`, ROUTES_TTL, async () => {
        const seen = new Map<string, RouteFlight>();
        const collect = (rows: AirlabsRoute[]) => {
          for (const r of rows) {
            // linhas de codeshare repetem o voo operado por outra companhia
            if (r.cs_flight_iata || !r.airline_iata || !r.flight_iata || !r.arr_iata) continue;
            seen.set(`${r.flight_iata}|${r.dep_time}|${(r.days ?? []).join()}`, {
              airline: r.airline_iata,
              flight: r.flight_iata,
              dep: r.dep_iata,
              arr: r.arr_iata,
              depTime: r.dep_time,
              arrTime: r.arr_time,
              durationMin: r.duration,
              days: r.days ?? [],
            });
          }
        };
        const query = (extra: Record<string, string> = {}) =>
          call<(AirlabsRoute & { cs_airline_iata?: string | null })[]>("routes", {
            dep_iata: iata,
            limit: opts.pageSize,
            _fields: "airline_iata,cs_airline_iata,flight_iata,cs_flight_iata,dep_iata,arr_iata,dep_time,arr_time,duration,days",
            ...extra,
          });

        const first = await query();
        const firstRows = first.response ?? [];
        collect(firstRows);
        let partial = false;

        if (first.request?.has_more) {
          // O plano gratuito devolve só a primeira página. Consultamos então por
          // companhia (filtro documentado da API; cada consulta conta na cota).
          const airlines = new Set([
            ...firstRows.flatMap((r) => [r.airline_iata, r.cs_airline_iata ?? null]).filter((c): c is string => !!c),
            ...opts.candidateAirlines,
          ]);
          let calls = 1;
          for (const code of airlines) {
            if (calls >= opts.maxCalls) {
              partial = true;
              break;
            }
            calls++;
            let body: Awaited<ReturnType<typeof query>>;
            try {
              body = await query({ airline_iata: code });
            } catch (e) {
              // cota do dia acabou no meio: guarda o que já veio, marcado como parcial
              if (e instanceof QuotaExceededError) {
                partial = true;
                break;
              }
              throw e;
            }
            const rows = body.response ?? [];
            collect(rows);
            if (body.request?.has_more) partial = true;
          }
          // companhias fora da lista de candidatas podem ter ficado de fora
          if (!opts.candidatesAreExhaustive) partial = true;
        }
        return { flights: [...seen.values()], partial, fetchedAt: new Date().toISOString() };
      });
    },

    async airlineNames(codes) {
      const out: Record<string, string> = {};
      for (const code of [...new Set(codes)]) {
        out[code] = await cached(`airline-${code}`, AIRLINES_TTL, async () => {
          const body = await call<{ name: string }[]>("airlines", { iata_code: code, _fields: "name" });
          return body.response?.[0]?.name ?? code;
        }).catch(() => code);
      }
      return out;
    },

    quotaRemaining: () => remaining,
    callsMade: () => calls,
  };
}
