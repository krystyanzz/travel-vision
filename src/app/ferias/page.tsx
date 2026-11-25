import type { Metadata } from "next";
import { Suspense } from "react";
import { FeriasClient } from "./FeriasClient";

export const metadata: Metadata = { title: "Férias flexíveis" };

export default function FeriasPage() {
  return (
    <div className="page">
      <div className="container">
        <div className="page-head">
          <span className="eyebrow">Férias flexíveis</span>
          <h1>Diga o período, a gente acha as datas mais baratas</h1>
          <p className="muted">
            Escolha para onde vai, os meses em que pode viajar e quantos dias quer ficar. Mostramos a melhor janela de cada mês, com preços
            reais e a data de cada consulta.
          </p>
        </div>
        <Suspense>
          <FeriasClient />
        </Suspense>
      </div>
    </div>
  );
}
