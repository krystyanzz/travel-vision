import type { Metadata } from "next";
import { Suspense } from "react";
import { PartnerExplorer } from "@/components/PartnerExplorer";
import { RouteMapClient } from "./RouteMapClient";

export const metadata: Metadata = { title: "Explorar destinos" };

export default function ExplorePage() {
  return (
    <div className="page map-page">
      <div className="container">
        <div className="page-head">
          <span className="eyebrow">Explorar destinos</span>
          <h1>Para onde dá para voar daqui</h1>
          <p className="muted">
            Voos diretos de cada aeroporto, quantas vezes por semana e por qual companhia. Ative as conexões para ver
            até onde se chega com uma escala.
          </p>
        </div>
        <Suspense>
          <RouteMapClient />
        </Suspense>

        <div className="page-head" id="parceiros" style={{ marginTop: "var(--space-8)" }}>
          <span className="eyebrow">Mapa de parceiros</span>
          <h2>Onde suas milhas podem levar você</h2>
          <p className="muted">
            Escolha seu programa para ver em quais companhias dá para emitir, ou um destino para ver quais programas chegam
            lá. Parceria de resgate não é o mesmo que aliança: mostramos só parcerias com fonte, e dizemos qual.
          </p>
        </div>
        <PartnerExplorer />
      </div>
    </div>
  );
}
