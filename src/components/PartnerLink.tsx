"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

// Link para o parceiro (agência ou companhia). Na primeira vez, explica como o
// Travel Vision ganha dinheiro: o viajante não paga nada; o parceiro pode pagar
// uma comissão quando a compra é feita pelo link.

const SEEN = "tv:aviso-parceiro";

function seen(): boolean {
  try {
    return localStorage.getItem(SEEN) === "1";
  } catch {
    return false;
  }
}

export function PartnerLink(p: { href: string; className?: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const go = useRef<HTMLButtonElement>(null);
  const link = useRef<HTMLAnchorElement>(null);
  const modal = useRef<HTMLDivElement>(null);

  // janela aberta: foco no botão principal, Tab circula só dentro dela, Esc fecha;
  // ao fechar, o foco volta ao link que a abriu
  useEffect(() => {
    if (!open) return;
    const back = link.current;
    go.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") return setOpen(false);
      if (e.key !== "Tab" || !modal.current) return;
      const items = [...modal.current.querySelectorAll<HTMLElement>("button, a[href]")];
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      const inside = modal.current.contains(document.activeElement);
      if (e.shiftKey && (document.activeElement === first || !inside)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (document.activeElement === last || !inside)) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      back?.focus();
    };
  }, [open]);

  function proceed() {
    try {
      localStorage.setItem(SEEN, "1");
    } catch {}
    setOpen(false);
    window.open(p.href, "_blank", "noopener");
  }

  return (
    <>
      <a
        ref={link}
        className={p.className}
        href={p.href}
        target="_blank"
        rel="noopener sponsored"
        onClick={(e) => {
          if (seen()) return;
          e.preventDefault();
          setOpen(true);
        }}
      >
        {p.children}
      </a>
      {/* no body: o cartão de resultado tem desfoque, que prenderia a janela dentro dele */}
      {open && createPortal(
        <div className="notice-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div ref={modal} className="partner-modal card" role="dialog" aria-modal="true" aria-labelledby="partner-modal-title">
            <button type="button" className="partner-modal-close" aria-label="Fechar" onClick={() => setOpen(false)}>
              ×
            </button>
            <svg className="partner-modal-art" viewBox="0 0 220 110" aria-hidden>
              <path d="M18 78 C 70 18, 150 18, 202 62" fill="none" stroke="var(--accent)" strokeWidth="2" strokeDasharray="5 6" strokeLinecap="round" />
              <circle cx="18" cy="78" r="5" fill="var(--accent)" />
              <circle cx="202" cy="62" r="5" fill="var(--accent)" />
              <g transform="translate(96 22) rotate(12)">
                <path d="M28 14v-3l-11-7V-3a2 2 0 0 0-4 0v7L2 11v3l11-3v7l-3 2v2l5-1 5 1v-2l-3-2v-7Z" fill="var(--text)" />
              </g>
              <rect x="70" y="62" width="80" height="36" rx="8" fill="var(--surface)" stroke="var(--border-strong)" />
              <text x="110" y="85" textAnchor="middle" fontSize="14" fontWeight="700" fill="var(--success)">R$ 0</text>
            </svg>
            <h2 id="partner-modal-title">O Travel Vision é gratuito para você</h2>
            <p>
              Não vendemos passagens nem cobramos taxa. Comparamos os preços que encontramos e levamos você ao site do parceiro, onde a compra é
              feita pelo preço que ele mostrar.
            </p>
            <p className="muted">
              Quando você compra por um link nosso, o parceiro pode pagar uma comissão ao Travel Vision. Isso não muda o seu preço.
            </p>
            <div className="partner-modal-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
                Voltar
              </button>
              <button ref={go} type="button" className="btn btn-primary" onClick={proceed}>
                Continuar para o parceiro
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
