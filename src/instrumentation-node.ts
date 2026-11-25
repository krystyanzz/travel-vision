import { startScheduler } from "./core/robots/scheduler";

export function startBackgroundCollection() {
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  if (process.env.ROBOTS_IN_SERVER === "0") return;
  startScheduler();
}
