"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";

const LINKS = [
  { href: "/busca", label: "Buscar voos" },
  { href: "/ferias", label: "Férias flexíveis" },
  { href: "/explorar", label: "Explorar destinos" },
  { href: "/carteira", label: "Minha carteira" },
  { href: "/simulador", label: "Simulador de milhas" },
  { href: "/radar", label: "Radar de promoções" },
];

export function SiteHeader() {
  const path = usePathname();
  return (
    <header className="site-header">
      <div className="container">
        <Link href="/" className="brand" aria-label="Travel Vision, página inicial">
          <Logo size={28} />
          Travel Vision
        </Link>
        <nav className="nav" aria-label="Principal">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} aria-current={path.startsWith(l.href) ? "page" : undefined}>
              {l.label}
            </Link>
          ))}
        </nav>
        <ThemeToggle />
      </div>
    </header>
  );
}
