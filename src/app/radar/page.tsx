import type { Metadata } from "next";
import { brl2, shortDate } from "@/components/format";
import { programName } from "@/core/miles/programs";
import { activePromotions, PROMOTION_TYPE_LABEL, SAMPLE_PROMOTIONS } from "@/core/promotions";

export const metadata: Metadata = { title: "Radar de promoções" };

export const dynamic = "force-dynamic";

export default function RadarPage() {
  const promos = activePromotions(SAMPLE_PROMOTIONS);
  return (
    <div className="page">
      <div className="container">
        <div className="page-head">
          <span className="eyebrow">Radar</span>
          <h1>Promoções vigentes</h1>
          <p className="muted">
            Bônus de transferência, compras bonificadas e compra de pontos, cadastrados pela curadoria a partir das
            comunicações oficiais de cada programa.
          </p>
        </div>

        <div className="notice notice-warning" role="status" style={{ marginBottom: "var(--space-5)" }}>
          <strong>Exemplos.</strong>
          <span>As promoções abaixo são fictícias, para validar a interface. A curadoria real entra antes do lançamento.</span>
        </div>

        <div className="grid grid-3">
          {promos.map((p) => (
            <article key={p.id} className="card">
              <span className="badge">{PROMOTION_TYPE_LABEL[p.type]}</span>
              <h3 style={{ marginTop: "var(--space-3)" }}>{p.title}</h3>
              <div className="stat num" style={{ color: "var(--accent)" }}>
                {p.bonusPercent !== undefined ? `+${p.bonusPercent}%` : p.pricePerThousand !== undefined ? `${brl2(p.pricePerThousand)}/mil` : ""}
              </div>
              <p className="muted" style={{ marginTop: "var(--space-2)" }}>
                {p.fromProgramId ? `${programName(p.fromProgramId)} → ` : ""}
                {programName(p.toProgramId)} · até {shortDate(p.endsAt)}
              </p>
              <p className="muted" style={{ fontSize: "0.85rem", margin: 0 }}>
                {p.conditions}
                {p.sourceUrl && (
                  <>
                    {" "}
                    <a href={p.sourceUrl} target="_blank" rel="noopener">
                      Fonte oficial
                    </a>
                  </>
                )}
              </p>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
