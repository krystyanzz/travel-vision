// Versão estática do Travel Vision para publicar como artefato: as mesmas telas
// do app Next.js, com as rotas de API atendidas no próprio navegador pelo
// provedor de demonstração.

import { createRoot } from "react-dom/client";
import "@/app/globals.css";
import "@/app/pages.css";
import Home from "@/app/page";
import SearchPage from "@/app/busca/page";
import WalletPage from "@/app/carteira/page";
import SimulatorPage from "@/app/simulador/page";
import RadarPage from "@/app/radar/page";
import PrivacyPage from "@/app/privacidade/page";
import { SiteHeader } from "@/components/SiteHeader";
import { place, searchPlaces } from "@/core/airportsDb";
import { LOYALTY_PROGRAMS } from "@/core/partners/data";
import { partnersOf, unreviewedPrograms } from "@/core/partners/partners";
import { parseFlightQuery } from "@/core/search/query";
import { navigate, useRoute } from "./router";

// Telas que dependem do servidor (chave da AirLabs, banco dos robôs)
function ServerOnly({ title, text }: { title: string; text: string }) {
  return (
    <div className="page">
      <div className="container">
        <div className="page-head">
          <span className="eyebrow">Protótipo estático</span>
          <h1>{title}</h1>
          <p className="muted">{text}</p>
        </div>
        <div className="notice notice-info" role="status">
          <span>Esta tela funciona na versão completa do Travel Vision, rodando com servidor (npm run dev).</span>
        </div>
      </div>
    </div>
  );
}

const PAGES: Record<string, () => React.ReactNode> = {
  "/ferias": () => <ServerOnly title="Férias flexíveis" text="Escolha destino, meses e duração; mostramos a melhor janela de cada mês com preços reais coletados pelo servidor." />,
  "/explorar": () => <ServerOnly title="Explorar destinos" text="Voos diretos e com conexão de cada aeroporto, num globo interativo. Usa dados da AirLabs consultados pelo servidor, com a chave guardada só lá." />,
  "/": Home,
  "/busca": SearchPage,
  "/carteira": WalletPage,
  "/simulador": SimulatorPage,
  "/radar": RadarPage,
  "/privacidade": PrivacyPage,
};

// Rotas de API servidas localmente
const realFetch = window.fetch.bind(window);
window.fetch = async (input, init) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (!url.startsWith("/api/")) return realFetch(input, init);
  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

  // sugestões de lugares: mesma base de aeroportos, sem atraso artificial
  if (url.startsWith("/api/aeroportos")) {
    const params = new URL(url, location.href).searchParams;
    const code = params.get("codigo");
    return json(code ? (place(code) ?? null) : searchPlaces(params.get("q") ?? ""));
  }
  const params = new URL(url, location.href).searchParams;
  const unreviewed = unreviewedPrograms().map((p) => ({ id: p.id, name: p.name, alliance: p.alliance, url: p.officialPartnersUrl }));

  // Protótipo estático: os preços reais vêm do banco do servidor, que não existe aqui.
  // Responde a busca sem resultados e diz isso, em vez de simular preços.
  if (url.startsWith("/api/voos/atualizar")) return json({ refreshed: false, message: "Disponível só na versão com servidor." });
  if (url.startsWith("/api/voos")) {
    const parsed = parseFlightQuery(params);
    if (!parsed.ok) return json({ error: parsed.error }, 400);
    const q = parsed.query;
    const detail = "Protótipo estático: os resultados reais vêm dos robôs no servidor.";
    const leg = (l: "ida" | "volta", origin: string, destination: string, date: string) => ({
      leg: l, origin, destination, date, results: [],
      nearby: Array.from({ length: 7 }, (_, i) => {
        const d = new Date(`${date}T12:00:00Z`);
        d.setUTCDate(d.getUTCDate() + i - 3);
        return { date: d.toISOString().slice(0, 10), lowestBrl: null };
      }),
      calendar: { month: date.slice(0, 7), days: [] },
    });
    return json({
      query: q,
      legs: [leg("ida", q.origin, q.destination, q.departDate), ...(q.returnDate ? [leg("volta", q.destination, q.origin, q.returnDate)] : [])],
      modalities: [{ id: "cash", kind: "cash", label: "Dinheiro", status: "sem_fonte", detail, updatedAt: null }, ...LOYALTY_PROGRAMS.map((p) => ({ id: p.id, kind: "award", label: p.name, status: "sem_fonte", detail, updatedAt: null }))],
      onDemand: false,
      generatedAt: new Date().toISOString(),
    });
  }
  if (url.startsWith("/api/assistente")) {
    return json({
      parsed: { ambiguous: [] }, summary: "", question: null, assumptions: null, cards: [], link: { label: "Abrir a busca", href: "/busca" }, refresh: null, suggestions: [],
      text: "Este é o protótipo estático: o assistente responde com preços reais na versão com servidor do Travel Vision.",
    });
  }
  if (url.startsWith("/api/parceiros")) {
    const prog = params.get("programa");
    if (prog) return json({ unreviewed, ...partnersOf(prog) });
    return json({ unreviewed, status: "sem_malha" });
  }

  return json({ error: "Rota desconhecida" }, 404);
};

// Links comuns (<a href="/privacidade">) navegam dentro da página
document.addEventListener("click", (e) => {
  const a = (e.target as HTMLElement).closest?.("a");
  const href = a?.getAttribute("href");
  if (a && href?.startsWith("/") && !a.target) {
    e.preventDefault();
    navigate(href);
  }
});

function App() {
  const { path } = useRoute();
  const Page = PAGES[path] ?? Home;
  return (
    <>
      <a href="#conteudo" className="visually-hidden">
        Pular para o conteúdo
      </a>
      <SiteHeader />
      <main id="conteudo">
        <Page key={path} />
      </main>
      <footer className="site-footer">
        <div className="container">
          <span>© {new Date().getFullYear()} Travel Vision · Inteligência para viajar</span>
          <span>
            Protótipo com dados de demonstração · <a href="/privacidade">Privacidade e LGPD</a>
          </span>
        </div>
      </footer>
    </>
  );
}

createRoot(document.getElementById("tv-root")!).render(<App />);
