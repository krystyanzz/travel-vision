// Marca Travel Vision: uma íris que é também um horizonte com rota traçada.
// Desenho original do projeto.
export function Logo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="tv-logo-g" x1="4" y1="28" x2="28" y2="4" gradientUnits="userSpaceOnUse">
          <stop stopColor="#1769AA" />
          <stop offset="1" stopColor="#48A5E8" />
        </linearGradient>
      </defs>
      <path d="M2.5 16C6 9.5 10.8 6.5 16 6.5S26 9.5 29.5 16C26 22.5 21.2 25.5 16 25.5S6 22.5 2.5 16Z" stroke="url(#tv-logo-g)" strokeWidth="2" />
      <circle cx="16" cy="16" r="5" fill="url(#tv-logo-g)" />
      <path d="M7 21.5C11 13 20 10 26.5 11.5" stroke="#E8F1F8" strokeWidth="1.4" strokeLinecap="round" strokeDasharray="0.1 3" />
      <path d="m24.6 9.6 2.6 1.9-2.9 1.3" stroke="#E8F1F8" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
