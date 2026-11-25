import type { Metadata } from "next";
import { WalletClient } from "./WalletClient";

export const metadata: Metadata = { title: "Carteira de pontos" };

export default function WalletPage() {
  return (
    <div className="page">
      <div className="container">
        <div className="page-head">
          <span className="eyebrow">Carteira</span>
          <h1>Seus pontos, num só lugar</h1>
          <p className="muted">
            Informe saldos e validades manualmente. Nunca pedimos login ou senha de programas, bancos ou cartões.
          </p>
        </div>
        <WalletClient />
      </div>
    </div>
  );
}
