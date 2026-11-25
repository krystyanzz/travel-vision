"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Recarrega os dados do servidor periodicamente (pausa com a aba oculta). */
export function AutoRefresh({ seconds = 30 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, seconds * 1000);
    return () => clearInterval(id);
  }, [router, seconds]);
  return null;
}
