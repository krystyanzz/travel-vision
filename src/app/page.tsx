import Link from "next/link";
import { Assistant } from "@/components/Assistant";
import { HeroAircraft } from "@/components/HeroAircraft";
import { QuickSearch } from "@/components/QuickSearch";

const FEATURES = [
  {
    tag: "Dinheiro",
    title: "Busca com calendário de preços",
    text: "Compare o mês inteiro, veja se o preço está baixo, normal ou alto e siga para a compra no parceiro.",
    href: "/busca",
  },
  {
    tag: "Milhas",
    title: "Carteira e o que dá para emitir",
    text: "Informe seus saldos e validades. Nós cruzamos com a disponibilidade e os caminhos de transferência.",
    href: "/carteira",
  },
  {
    tag: "Custo",
    title: "Simulador do milheiro",
    text: "Transferências com bônus, compra de pontos e milhas x dinheiro: saiba quanto vale cada resgate.",
    href: "/simulador",
  },
  {
    tag: "Promoções",
    title: "Radar de bônus",
    text: "Bônus de transferência, compras bonificadas e compra de pontos, sempre com a fonte oficial.",
    href: "/radar",
  },
];

const HUBS = [
  { code: "GRU", name: "São Paulo · Guarulhos" },
  { code: "GIG", name: "Rio de Janeiro · Galeão" },
  { code: "BSB", name: "Brasília" },
  { code: "CNF", name: "Belo Horizonte · Confins" },
];

export default function Home() {
  return (
    <>
      <section className="hero">
        <div className="container hero-grid">
          <div className="hero-copy">
            <span className="eyebrow">Inteligência para viajar</span>
            <h1>
              Milhas e dinheiro, <span className="accent-text">no mesmo radar.</span>
            </h1>
            <p className="lead">
              Pergunte do seu jeito: o Travel Vision procura passagens com preços reais, acha o período mais barato e mostra
              quais milhas levam você até lá.
            </p>
            <Assistant />
            <details className="hero-form">
              <summary>Prefere preencher o formulário?</summary>
              <QuickSearch />
            </details>
          </div>
          <HeroAircraft />
        </div>
      </section>

      <section className="section">
        <div className="container">
          <span className="eyebrow">Fase 1</span>
          <h2>Ferramentas para decidir com números</h2>
          <div className="grid grid-2 features">
            {FEATURES.map((f) => (
              <Link key={f.href} href={f.href} className="card feature">
                <span className="badge">{f.tag}</span>
                <h3>{f.title}</h3>
                <p className="muted">{f.text}</p>
                <span className="feature-cta" aria-hidden="true">
                  Abrir →
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container hubs">
          <div>
            <span className="eyebrow">Saindo do interior</span>
            <h2>Sem voo internacional na sua cidade?</h2>
            <p className="muted">
              Sugerimos o melhor hub de conexão para cada destino e somamos o trecho doméstico na comparação, em
              dinheiro ou em milhas.
            </p>
          </div>
          <ul className="hub-list">
            {HUBS.map((h) => (
              <li key={h.code}>
                <span className="hub-code">{h.code}</span>
                <span className="muted">{h.name}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="card trust">
            <div>
              <h3>Dados de fontes autorizadas</h3>
              <p className="muted">
                Usamos apenas APIs oficiais, contratos e programas de afiliados. Não pedimos senha de programa de
                fidelidade, banco ou cartão: sua carteira é preenchida por você.
              </p>
            </div>
            <Link href="/privacidade" className="btn btn-ghost">
              Como tratamos seus dados
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
