"use client";

import { useEffect, useRef, useState } from "react";

// Carrega o 3D somente depois do conteúdo principal, em dispositivos capazes.
// Até lá (ou para sempre, em aparelhos fracos) fica a ilustração estática.

function canRun3D(): boolean {
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  if (nav.connection?.saveData) return false;
  if ((nav.hardwareConcurrency ?? 8) < 4) return false;
  if ((nav.deviceMemory ?? 8) < 4) return false;
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

export function HeroAircraft() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!canRun3D()) return;
    let dispose: (() => void) | undefined;
    let cancelled = false;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

    const start = () =>
      import("./three/aircraftScene").then(({ mountAircraft }) => {
        if (cancelled || !canvasRef.current) return;
        dispose = mountAircraft(canvasRef.current, { animate: !reduced });
        setReady(true);
      });

    const idle = (cb: () => void) =>
      typeof window.requestIdleCallback === "function" ? window.requestIdleCallback(cb, { timeout: 2500 }) : setTimeout(cb, 1200);

    const kick = () => idle(() => void start());
    if (document.readyState === "complete") kick();
    else window.addEventListener("load", kick, { once: true });

    return () => {
      cancelled = true;
      window.removeEventListener("load", kick);
      dispose?.();
    };
  }, []);

  return (
    <div className="hero-visual" aria-hidden="true">
      <svg className={`hero-fallback ${ready ? "is-hidden" : ""}`} viewBox="0 0 600 420" fill="none">
        <defs>
          <linearGradient id="hf-a" x1="0" y1="0" x2="1" y2="1">
            <stop stopColor="#48A5E8" stopOpacity="0.9" />
            <stop offset="1" stopColor="#1769AA" stopOpacity="0.6" />
          </linearGradient>
          <radialGradient id="hf-glow" cx="0.5" cy="0.5" r="0.5">
            <stop stopColor="#1769AA" stopOpacity="0.45" />
            <stop offset="1" stopColor="#1769AA" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="300" cy="210" r="200" fill="url(#hf-glow)" />
        <path d="M40 330C160 180 360 120 560 140" stroke="#48A5E8" strokeOpacity="0.5" strokeDasharray="2 10" strokeLinecap="round" strokeWidth="2" />
        <path d="M80 380C220 300 420 280 580 300" stroke="#48A5E8" strokeOpacity="0.25" strokeDasharray="2 10" strokeLinecap="round" strokeWidth="2" />
        {/* silhueta genérica vista de cima */}
        <g transform="translate(300 200) rotate(-18)">
          <path d="M-150 0c0-9 10-15 30-15h220c30 0 50 7 60 15-10 8-30 15-60 15h-220c-20 0-30-6-30-15Z" fill="url(#hf-a)" />
          <path d="M60 -12-30 -150h-24L0 -12ZM60 12-30 150h-24L0 12Z" fill="url(#hf-a)" />
          <path d="M-100 -8-140 -62h-14l-6 54ZM-100 8-140 62h-14l-6-54Z" fill="url(#hf-a)" />
        </g>
      </svg>
      <canvas ref={canvasRef} className={`hero-canvas ${ready ? "is-ready" : ""}`} />
    </div>
  );
}
