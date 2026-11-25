// Agendador dos robôs de coleta.
//   npm run robots              → fica rodando; a cada minuto executa os robôs na hora
//                                 (o servidor do site já faz isso sozinho; use quando quiser um processo separado)
//   npm run robots -- --once    → executa uma vez os robôs na hora e sai
//   npm run robots -- --run=ID  → força um robô agora (ignora a frequência) e sai
//   npm run robots -- --status  → mostra o estado dos robôs e sai

import { readFileSync } from "node:fs";
import path from "node:path";
import { runRobot, tick } from "../src/core/robots/engine";
import { ROBOTS, robotStatuses } from "../src/core/robots/registry";
import { startScheduler } from "../src/core/robots/scheduler";
import { defaultStore } from "../src/core/robots/store";

// Mesmas variáveis do Next (.env.local), sem sobrescrever o ambiente.
for (const file of [".env.local", ".env"]) {
  try {
    for (const line of readFileSync(path.join(process.cwd(), file), "utf8").split(/\r?\n/)) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {}
}

const store = defaultStore();
const log = (m: string) => console.log(`${new Date().toISOString()} ${m}`);
const arg = (name: string) => process.argv.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));

async function main() {
  if (arg("status")) {
    console.table(robotStatuses(store).map((s) => ({ robô: s.id, conexão: s.connection, motivo: s.reason ?? "", última: s.lastRunAt ?? "-", status: s.lastStatus ?? "-", próxima: s.nextRunAt ?? "-" })));
    return;
  }
  const run = arg("run");
  if (run) {
    const id = run.split("=")[1];
    const robot = ROBOTS.find((r) => r.id === id);
    if (!robot) throw new Error(`Robô desconhecido: ${id}. Disponíveis: ${ROBOTS.map((r) => r.id).join(", ")}`);
    const r = await runRobot(robot, store, { log });
    log(`${r.robotId}: ${r.status} — ${r.message}`);
    process.exitCode = r.status === "error" ? 1 : 0;
    return;
  }
  if (arg("once")) {
    for (const r of await tick(ROBOTS, store, { log })) log(`${r.robotId}: ${r.status} — ${r.message}`);
    return;
  }

  // contínuo: o mesmo agendador que o servidor do site usa (desligue lá com ROBOTS_IN_SERVER=0)
  const scheduler = startScheduler({ log, keepAlive: true });
  await new Promise<void>((resolve) =>
    process.on("SIGINT", () => {
      log("Parando…");
      scheduler.stop();
      resolve();
    }),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
