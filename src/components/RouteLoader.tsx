// Animação leve (SVG + CSS) de rota sendo traçada durante a busca.
export function RouteLoader({ from, to }: { from: string; to: string }) {
  return (
    <div className="route-loader" role="status">
      <svg width="320" height="110" viewBox="0 0 320 110" fill="none" aria-hidden="true">
        <path d="M20 90C90 10 230 10 300 90" stroke="var(--border-strong)" strokeWidth="1.5" strokeDasharray="2 6" />
        <path className="trace" d="M20 90C90 10 230 10 300 90" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="20" cy="90" r="5" fill="var(--accent)" />
        <circle cx="300" cy="90" r="5" fill="var(--accent)" />
      </svg>
      <span>
        Procurando voos de {from} para {to}…
      </span>
    </div>
  );
}
