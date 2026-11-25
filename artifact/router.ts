// Roteador mínimo para a versão estática (artefato). Substitui next/link e
// next/navigation: cada tela é um token simples no hash (#busca, #carteira...),
// e os parâmetros de busca ficam em memória.

import { useSyncExternalStore } from "react";

export const ROUTES = ["", "busca", "carteira", "simulador", "radar", "privacidade"] as const;

interface State {
  path: string; // "/busca"
  search: string; // "de=SAO&para=LIS"
}

function fromHash(): State {
  const token = location.hash.replace(/^#/, "");
  return { path: (ROUTES as readonly string[]).includes(token) && token ? `/${token}` : "/", search: "" };
}

let state: State = fromHash();
const listeners = new Set<() => void>();

export function navigate(url: string) {
  const [path, search = ""] = url.split("?");
  state = { path: path || "/", search };
  const token = state.path.replace(/^\//, "");
  try {
    history.replaceState(null, "", token ? `#${token}` : location.pathname);
  } catch {}
  window.scrollTo(0, 0);
  listeners.forEach((l) => l());
}

window.addEventListener("hashchange", () => {
  state = fromHash();
  listeners.forEach((l) => l());
});

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useRoute(): State {
  return useSyncExternalStore(subscribe, () => state);
}
