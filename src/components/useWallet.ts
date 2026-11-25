"use client";

import { useEffect, useState } from "react";
import type { WalletEntry } from "@/core/miles/wallet";

// Fase 1: a carteira fica apenas no navegador do usuário, e só é gravada após
// consentimento explícito (LGPD: finalidade clara, exclusão a qualquer momento).
// Na Fase 3 passa a ser sincronizada com a conta, com o mesmo consentimento.

const KEY = "tv-wallet";
const CONSENT = "tv-wallet-consent";

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function useWallet() {
  const [entries, setEntries] = useState<WalletEntry[]>([]);
  const [consent, setConsentState] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const c = read(CONSENT, false);
    setConsentState(c);
    if (c) setEntries(read(KEY, []));
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded || !consent) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(entries));
    } catch {}
  }, [entries, consent, loaded]);

  function setConsent(v: boolean) {
    setConsentState(v);
    try {
      if (v) localStorage.setItem(CONSENT, "true");
      else {
        localStorage.removeItem(CONSENT);
        localStorage.removeItem(KEY);
      }
    } catch {}
  }

  function eraseAll() {
    setEntries([]);
    setConsent(false);
  }

  return { entries, setEntries, consent, setConsent, eraseAll, loaded };
}
