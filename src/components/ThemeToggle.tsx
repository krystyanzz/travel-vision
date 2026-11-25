"use client";

import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light" | null>(null);

  useEffect(() => {
    setTheme(document.documentElement.dataset.theme === "light" ? "light" : "dark");
  }, []);

  function toggle() {
    const next = theme === "light" ? "dark" : "light";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("tv-theme", next);
    } catch {}
    setTheme(next);
  }

  const label = theme === "light" ? "Ativar modo escuro" : "Ativar modo claro";
  return (
    <button type="button" className="theme-toggle" onClick={toggle} aria-label={label} title={label}>
      {theme === "light" ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.8" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      )}
    </button>
  );
}
