import { tick } from "./engine";
import { ROBOTS } from "./registry";
import { defaultStore } from "./store";

// Agendador contínuo. Roda dentro do servidor do site (instrumentation.ts) ou
// sozinho (npm run robots). A trava por robô no banco impede que os dois
// executem o mesmo robô ao mesmo tempo.

const KEY = Symbol.for("travel-vision.scheduler");
type Global = typeof globalThis & { [KEY]?: { stop: () => void } };

export function startScheduler(opts: { log?: (m: string) => void; intervalMs?: number; keepAlive?: boolean } = {}): { stop: () => void } {
  const g = globalThis as Global;
  if (g[KEY]) return g[KEY]; // já iniciado neste processo (recarga em desenvolvimento)
  const log = opts.log ?? ((m: string) => console.log(`${new Date().toISOString()} ${m}`));
  const store = defaultStore();
  let stopped = false;
  let running = false;

  const loop = async () => {
    if (stopped || running) return;
    running = true;
    try {
      for (const r of await tick(ROBOTS, store, { log })) {
        if (r.status !== "skipped") log(`[robôs] ${r.robotId}: ${r.status} — ${r.message}`);
      }
    } catch (e) {
      log(`[robôs] erro no agendador: ${e instanceof Error ? e.message : e}`);
    } finally {
      running = false;
    }
  };

  const timer = setInterval(loop, opts.intervalMs ?? 60_000);
  const first = setTimeout(loop, 5_000); // primeira verificação logo após subir
  // dentro do servidor não segura o processo; sozinho (npm run robots), segura
  if (!opts.keepAlive) {
    timer.unref?.();
    first.unref?.();
  }
  const handle = {
    stop: () => {
      stopped = true;
      clearInterval(timer);
      delete g[KEY];
    },
  };
  g[KEY] = handle;
  log(`[robôs] agendador iniciado (${ROBOTS.length} robôs)`);
  return handle;
}
