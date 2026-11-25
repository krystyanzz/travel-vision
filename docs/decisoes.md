# Decisões e pendências

Documento compartilhado entre as frentes do projeto (diretriz, seção 8). Mais recente no topo.

## Decisões

### 2026-11-05 · Férias flexíveis e assistente próprio

- Nova aba **Férias flexíveis** (`/ferias`): período em meses, duração em dias com atalhos de semanas; combinações de
  dois bilhetes só de ida entram no ranking com aviso; a confirmação no Google Flights só acontece no clique (poupa a
  cota diária da SerpAPI).
- **Assistente de viagem** na página inicial, feito em casa: parser por regras em português, sem nenhuma API de IA
  externa. Responde só com dados do banco; o que não entendeu ele pergunta, o que presumiu ele diz.
- A conversa fica no `sessionStorage` do navegador; o servidor não guarda nada. A localização usada para sugerir a
  origem é arredondada (~10 km) e não é guardada.
- Acessibilidade: calendário navegável por setas, foco devolvido ao fechar; aviso de parceiro com foco preso na
  janela; mapa de calor com resumo por mês para leitor de tela.

### 2026-11-04 · Uso pessoal local

- A pedido do dono do projeto, o Travel Vision passa a rodar **localmente, para uso pessoal**, como o Travel Hacking
  Toolkit. Isso libera APIs de terceiros (SerpAPI · Google Flights e Google Travel Explore) e o Seats.aero com a
  chave do plano Pro do próprio usuário (robô ainda não escrito).
- Continua proibido: contornar anti-robô, captcha, login ou limites; raspar sites de companhias ou programas cujos
  termos proíbam; mostrar preço inventado ou simulado como real. A LGPD continua valendo.
- Antes de um site público: rever as fontes sem licença comercial (SerpAPI, Seats.aero) e trocar por contratos.

### 2026-11-02 · Reestruturação: buscador, robôs nos bastidores

- O produto é o buscador. Os robôs saem do menu e rodam sozinhos dentro do servidor (`src/instrumentation.ts`); a tela
  técnica vai para `/admin/robos`, protegida por senha (`ADMIN_PASSWORD`; sem senha, só em desenvolvimento).
- Menu: Buscar voos, Explorar destinos, Minha carteira, Simulador de milhas, Radar de promoções (em 05/11 entrou
  Férias flexíveis, depois de Buscar voos).
- `/busca` consolida dinheiro e milhas a partir do banco (`src/core/search/flights.ts`), com status por modalidade
  (com resultados, sem resultados, sem fonte, indisponível) e atualização sob demanda quando a fonte permite.
- **A simulação saiu da busca.** Sem fonte conectada, a tela diz que não há resultado real, e por quê.
- Mapa de parceiros de resgate (`src/core/partners`): cada parceria com fonte (oficial, secundária ou conflitante);
  aliança não conta como parceria; programas internacionais ficam fora das respostas até a lista ser conferida.

### 2026-11-02 · Robôs de coleta automatizada

- Novo motor de robôs (`src/core/robots`): cada fonte é um robô plugável; agenda, trava, cota, deduplicação, histórico,
  detecção de mudanças, alertas e registro de erros ficam no motor. Persistência em SQLite (`.data/`). Detalhes em
  `docs/robos.md`.
- Regra 4 aplicada: todo preço carrega a classificação confirmada / não confirmada / histórico / estimativa, a fonte e o
  horário da consulta. Os resultados de demonstração da busca passam a ser rotulados como **simulação**.
- Uma fonte só é "conectada" quando há execução com dados registrada no banco. Programas de fidelidade sem fonte
  autorizada aparecem como tal; nenhum foi declarado integrado.
- Robôs de navegador (Playwright) só rodam com evidência de permissão nos termos da fonte; o motor bloqueia os demais.
  Nenhum foi implementado.

### 2026-10-31 · Mapa de rotas

- Nova tela `/mapa`: voos diretos de cada aeroporto num globo interativo próprio (d3-geo, contornos do Natural
  Earth), com frequência semanal, companhias, horários e destinos com 1 conexão via os 3 maiores hubs.
- Diferenciais em relação a mapas de rotas existentes: ligação direta com a busca de preços, conexões para quem
  sai de cidades sem voo internacional, filtros nacional/internacional, em português.
- Fonte: AirLabs (plano gratuito por enquanto), com cache em disco e chave só no servidor (`.env.local`).
- O mapa ainda não entra no artefato publicado: a chave não pode ir para o navegador e a redistribuição dos dados
  não está confirmada.

### 2026-10-30 · Só buscador, sem venda

- O Travel Vision é exclusivamente um mecanismo de busca e rastreamento (modelo Skyscanner / Seats.aero): o usuário
  vê os resultados e é redirecionado para comprar ou emitir no site da companhia, agência ou programa.
- Consequência: o Duffel (API de reserva) foi descartado. O candidato principal para preços em dinheiro é a
  Travelpayouts (afiliados, com preços por mês em cache). Ver `docs/fornecedores.md`.
- Milhas: nenhuma fonte licenciada com programas brasileiros confirmada; contatos com fornecedores de dados de
  resgate e com os programas são a prioridade.

### 2026-10-30 · Início da Fase 1

- **Estrutura:** um app Next.js (App Router, TypeScript). O domínio fica em `src/core`, sem dependência de
  React/Next, para ser extraído para o backend Node.js separado sem reescrita.
- **Provedores plugáveis:** interfaces `CashFareProvider` e `AwardProvider` em `src/core/providers/types.ts`, com
  metadados de licença obrigatórios. A escolha é por variável de ambiente (`CASH_PROVIDER`), em
  `src/core/providers/registry.ts`.
- **Provedor de demonstração:** `demo` gera dados sintéticos determinísticos para desenvolver a interface. A tela
  mostra sempre o aviso "Modo demonstração". Não pode ir para produção.
- **Primeiro candidato licenciado em dinheiro:** Duffel (adaptador escrito, ainda não testado com chave).
- **Cota e cache:** em memória (`src/core/providers/quota.ts`), com a mesma interface que a versão com Redis terá.
  A cota nunca é contornada: excedeu, a API responde 429.
- **Carteira:** fica só no navegador, gravada após consentimento explícito, com botão de exclusão. Sem login ou
  senha de programas, nunca.
- **3D:** aeronave genérica modelada no próprio código com Three.js (sem arquivo de terceiros, sem pintura de
  companhia), carregada sob demanda após o `load`, só em aparelhos capazes, parada com redução de movimento.
  Fallback em SVG.
- **Radar de promoções:** cadastro por curadoria a partir de fontes oficiais, com link da fonte. Hoje só há
  exemplos fictícios.

## Pendências

| # | Pendência | Frente | Bloqueia |
|---|---|---|---|
| 1 | Abrir conta de afiliado na Travelpayouts e ler os termos da Data API (exibição, cache, atribuição) | Integrações | Critério de sucesso da Fase 1 |
| 2 | Testar a Data API com rotas brasileiras e BRL; escrever o adaptador | Integrações | Busca em dinheiro real |
| 3 | Preencher as fichas de `docs/fornecedores.md` com fonte | Integrações | Critério de sucesso da Fase 1 |
| 4 | Contato comercial com LATAM Pass, Smiles e Azul Fidelidade | Orquestrador | Fase 2 |
| 5 | Conferir paridades de transferência em `src/core/miles/programs.ts` (todas `verified: false`) | Curadoria | Exibir paridades como vigentes |
| 6 | Substituir as promoções de exemplo por curadoria real | Curadoria | Lançamento do radar |
| 7 | Backend separado: PostgreSQL, Redis, agendador de varredura de calendário e alertas | Backend | Fase 2 |
| 8 | Base completa de aeroportos com licença aberta (hoje há uma lista curta) | Backend | Busca "qualquer lugar" e por país |
| 9 | Revisão jurídica da política de privacidade | Conformidade | Lançamento público |
| 10 | Medir LCP em produção (meta < 2,5 s) | Experiência visual | — |
| 11 | ~~Criar conta de afiliado Travelpayouts e pôr `TRAVELPAYOUTS_TOKEN` em `.env.local`~~ feito em 03/11; falta `TRAVELPAYOUTS_MARKER` para os links gerarem comissão | Integrações | Comissão dos links |
| 12 | Fonte de resgates com milhas: chave do Seats.aero (uso local) ou parceria/fornecedor licenciado (site público) | Orquestrador | Qualquer preço em milhas |
| 13 | Hospedar o site em servidor sempre ligado (a coleta roda junto) | Backend | Coleta 24 h |
| 14 | Conferir as parceiras de resgate de TAP, Iberia, Aeroplan, United, AAdvantage, LifeMiles e Flying Blue nas páginas oficiais | Curadoria | Esses programas no mapa de parceiros |
| 15 | Confirmar com a LATAM Pass o status de Alaska, Virgin Atlantic e Aerolíneas Argentinas | Curadoria | Remover o aviso de conflito |
