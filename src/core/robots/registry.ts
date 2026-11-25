import { everyMinutes, nextRunAt, policyBlock } from "./engine";
import { airlabsScheduleRobot } from "./robots/airlabsSchedule";
import { bcbPtaxRobot } from "./robots/bcbPtax";
import { serpapiExploreRobot } from "./robots/serpapiExplore";
import { serpapiGoogleRobot } from "./robots/serpapiGoogle";
import { travelpayoutsRobot } from "./robots/travelpayouts";
import type { Store } from "./store";
import type { Robot } from "./types";

// Para adicionar uma fonte: escreva um Robot em ./robots e inclua-o aqui.
// O motor, o banco e as telas não mudam.
export const ROBOTS: Robot[] = [travelpayoutsRobot, serpapiGoogleRobot, serpapiExploreRobot, airlabsScheduleRobot, bcbPtaxRobot];

/**
 * Programas de fidelidade previstos. Nenhum é "integrado" por constar aqui:
 * o status vem do banco (última execução com dados) do robô que o cobre.
 */
export interface ProgramEntry {
  id: string;
  name: string;
  robotId: string | null;
  blocker: string;
}

const NO_PUBLIC_API = "Nenhuma API pública de disponibilidade de resgate identificada. Robô de navegador no site só com permissão expressa nos termos do programa, ainda não obtida. Caminho: parceria ou fornecedor licenciado.";

export const PROGRAMS: ProgramEntry[] = [
  { id: "smiles", name: "Smiles (GOL)", robotId: null, blocker: NO_PUBLIC_API },
  { id: "latampass", name: "LATAM Pass", robotId: null, blocker: NO_PUBLIC_API },
  { id: "azul", name: "Azul Fidelidade", robotId: null, blocker: NO_PUBLIC_API },
  { id: "tap", name: "TAP Miles&Go", robotId: null, blocker: NO_PUBLIC_API },
  { id: "iberia", name: "Iberia Club", robotId: null, blocker: NO_PUBLIC_API },
  { id: "aeroplan", name: "Air Canada Aeroplan", robotId: null, blocker: `${NO_PUBLIC_API} A Air Canada processa um buscador de resgates por coleta automatizada.` },
  { id: "united", name: "United MileagePlus", robotId: null, blocker: NO_PUBLIC_API },
  { id: "aadvantage", name: "American Airlines AAdvantage", robotId: null, blocker: NO_PUBLIC_API },
  { id: "lifemiles", name: "LifeMiles", robotId: null, blocker: NO_PUBLIC_API },
  { id: "flyingblue", name: "Flying Blue", robotId: null, blocker: NO_PUBLIC_API },
];

export type ConnectionStatus = "conectada" | "configurada_sem_prova" | "nao_configurada" | "bloqueada" | "sem_fonte";

export interface RobotStatus {
  id: string;
  name: string;
  produces: Robot["produces"];
  source: Robot["source"];
  everyMinutes: number;
  connection: ConnectionStatus;
  reason: string | null;
  running: boolean;
  lastRunAt: string | null;
  lastStatus: string | null;
  lastOkAt: string | null;
  nextRunAt: string | null;
  consecutiveFailures: number;
  proof: { runId: number; at: string; items: number; message: string } | null;
}

export function robotStatuses(store: Store, robots: Robot[] = ROBOTS): RobotStatus[] {
  return robots.map((r) => {
    const st = store.robotState(r.id);
    const proven = store.lastProvenRun(r.id);
    const blocked = policyBlock(r);
    const notReady = r.notReady();
    const connection: ConnectionStatus = blocked ? "bloqueada" : notReady ? "nao_configurada" : proven ? "conectada" : "configurada_sem_prova";
    const running = !!st?.running_since && Date.now() - Date.parse(st.running_since as string) < 30 * 60_000;
    return {
      id: r.id,
      name: r.name,
      produces: r.produces,
      source: r.source,
      everyMinutes: everyMinutes(r),
      connection,
      reason: blocked ?? notReady,
      running,
      lastRunAt: (st?.last_run_at as string) ?? null,
      lastStatus: (st?.last_status as string) ?? null,
      lastOkAt: (st?.last_ok_at as string) ?? null,
      nextRunAt: blocked || notReady ? null : (nextRunAt(r, store)?.toISOString() ?? "agora"),
      consecutiveFailures: Number(st?.consecutive_failures ?? 0),
      proof: proven ? { runId: Number(proven.id), at: proven.finished_at as string, items: Number(proven.items), message: proven.message as string } : null,
    };
  });
}

export function programStatuses(store: Store) {
  return PROGRAMS.map((p) => {
    const proven = p.robotId ? store.lastProvenRun(p.robotId) : null;
    const connection: ConnectionStatus = !p.robotId ? "sem_fonte" : proven ? "conectada" : "configurada_sem_prova";
    return { ...p, connection, proofAt: (proven?.finished_at as string) ?? null };
  });
}
