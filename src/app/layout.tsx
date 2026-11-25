import type { Metadata, Viewport } from "next";
import { Inter, Sora } from "next/font/google";
import { SiteHeader } from "@/components/SiteHeader";
import "./globals.css";
import "./pages.css";

const sora = Sora({ subsets: ["latin"], variable: "--font-sora", display: "swap", weight: ["400", "600"] });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Travel Vision | Inteligência para viajar", template: "%s · Travel Vision" },
  description: "Busque, compare e monitore passagens com milhas e em dinheiro, com foco no viajante brasileiro.",
};

export const viewport: Viewport = {
  themeColor: "#07182D",
};

// Aplica o tema antes da primeira pintura para evitar flash: escolha salva ou preferência do sistema.
const themeScript = `try{var t=localStorage.getItem("tv-theme");if(!t)t=matchMedia("(prefers-color-scheme: light)").matches?"light":"dark";document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${sora.variable} ${inter.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <a href="#conteudo" className="visually-hidden">
          Pular para o conteúdo
        </a>
        <SiteHeader />
        <main id="conteudo">{children}</main>
        <footer className="site-footer">
          <div className="container">
            <span>© {new Date().getFullYear()} Travel Vision · Inteligência para viajar</span>
            <span>
              Dados apenas de fontes licenciadas · <a href="/privacidade">Privacidade e LGPD</a>
            </span>
          </div>
        </footer>
      </body>
    </html>
  );
}
