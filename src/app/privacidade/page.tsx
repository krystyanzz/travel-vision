import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacidade e LGPD" };

// Rascunho operacional. Deve ser revisado por assessoria jurídica antes do lançamento.
export default function PrivacyPage() {
  return (
    <div className="page">
      <div className="container prose">
        <span className="eyebrow">LGPD</span>
        <h1>Privacidade</h1>
        <p className="muted">Versão preliminar · Fase 1 (MVP)</p>

        <h2>Quais dados tratamos</h2>
        <ul>
          <li>
            <strong>Buscas de voos:</strong> origem, destino, datas, passageiros e cabine, usados apenas para responder à
            sua busca. Não ficam associados a você.
          </li>
          <li>
            <strong>Carteira de pontos:</strong> programa, saldo, validade e custo do milheiro que você informar. Nesta
            fase ficam somente no seu navegador e só são gravados com o seu consentimento.
          </li>
          <li>
            <strong>Preferência de tema:</strong> claro ou escuro, guardada no seu navegador.
          </li>
        </ul>

        <h2>Dados coletados pelos robôs</h2>
        <p>
          Os robôs de coleta consultam apenas informações públicas de voos, preços e câmbio em fontes autorizadas (por
          exemplo AirLabs, Banco Central e programas de afiliados). Nenhum dado pessoal é coletado ou guardado por eles.
        </p>

        <h2>Redirecionamento a parceiros</h2>
        <p>
          O Travel Vision não vende passagens. Ao clicar em &ldquo;Ver no parceiro&rdquo;, você vai para o site do parceiro, que
          tem a própria política de privacidade.
        </p>

        <h2>Como o Travel Vision ganha dinheiro</h2>
        <p>
          Usar o Travel Vision é gratuito. Quando você compra uma passagem por um link nosso, o parceiro (agência ou companhia) pode nos pagar
          uma comissão. Isso não muda o preço para você.
        </p>

        <h2>Sua localização</h2>
        <p>
          Se você permitir no navegador, usamos sua localização aproximada (arredondada a cerca de 10 km) só para sugerir o aeroporto mais
          próximo como origem. Ela não é guardada no servidor. Sem permissão, sugerimos a última origem que você buscou, guardada só no seu
          navegador.
        </p>

        <h2>O que nunca pedimos</h2>
        <p>
          Login, senha ou códigos de programas de fidelidade, bancos ou cartões. Se alguém pedir esses dados em nome do
          Travel Vision, não informe.
        </p>

        <h2>Finalidade</h2>
        <p>
          Exibir resultados de busca, calcular o custo do milheiro e indicar o que você consegue emitir. Não vendemos
          dados pessoais.
        </p>

        <h2>Seus direitos</h2>
        <p>
          Você pode apagar sua carteira a qualquer momento na própria página da carteira, o que também retira o
          consentimento. Quando houver contas de usuário, ofereceremos acesso, correção, portabilidade e exclusão
          completa pela área do cliente.
        </p>
      </div>
    </div>
  );
}
