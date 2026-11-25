"use client";

import { useEffect } from "react";

// Origem inicial: o aeroporto mais próximo da localização do usuário (com a
// permissão do navegador) ou, sem permissão, a última origem que ele buscou.
// LGPD: as coordenadas são arredondadas (~10 km) antes de sair do navegador,
// usadas só para achar o aeroporto e não são guardadas no servidor.

const LAST_ORIGIN = "tv:origem";

export function rememberOrigin(code: string) {
  try {
    if (/^[A-Z]{3}$/.test(code)) localStorage.setItem(LAST_ORIGIN, code);
  } catch {}
}

function lastOrigin(): string | null {
  try {
    return localStorage.getItem(LAST_ORIGIN);
  } catch {
    return null;
  }
}

export function useHomeAirport(enabled: boolean, onFound: (code: string) => void) {
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    const fallback = () => {
      const last = lastOrigin();
      if (alive && last) onFound(last);
    };
    if (!("geolocation" in navigator)) return fallback();
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = Math.round(pos.coords.latitude * 10) / 10;
        const lon = Math.round(pos.coords.longitude * 10) / 10;
        try {
          const res = await fetch(`/api/aeroportos?perto=${lat},${lon}`);
          const place = res.ok ? ((await res.json()) as { code?: string } | null) : null;
          if (!alive) return;
          if (place?.code) onFound(place.code);
          else fallback();
        } catch {
          fallback();
        }
      },
      fallback,
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 24 * 3_600_000 },
    );
    return () => {
      alive = false;
    };
    // só na abertura
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);
}
