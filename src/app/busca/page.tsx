import type { Metadata } from "next";
import { Suspense } from "react";
import { SearchClient } from "./SearchClient";

export const metadata: Metadata = { title: "Buscar voos" };

export default function SearchPage() {
  return (
    <div className="page">
      <div className="container">
        <div className="page-head">
          <span className="eyebrow">Buscar voos</span>
          <h1>Dinheiro ou milhas, a melhor forma de chegar</h1>
          <p className="muted">
            Cruzamos as fontes conectadas e mostramos, numa lista só, as passagens pagas e as emissões com milhas
            encontradas para a sua rota, com a origem e a hora de cada preço.
          </p>
        </div>
        <Suspense>
          <SearchClient />
        </Suspense>
      </div>
    </div>
  );
}
