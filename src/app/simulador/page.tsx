import type { Metadata } from "next";
import { SimulatorClient } from "./SimulatorClient";

export const metadata: Metadata = { title: "Simulador de milhas" };

export default function SimulatorPage() {
  return (
    <div className="page">
      <div className="container">
        <div className="page-head">
          <span className="eyebrow">Simulador</span>
          <h1>Quanto custa, de verdade, cada milheiro</h1>
          <p className="muted">
            Simule transferências com bônus, compras de pontos e compare um resgate com a passagem paga.
          </p>
        </div>
        <SimulatorClient />
      </div>
    </div>
  );
}
