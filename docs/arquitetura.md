# Arquitetura do Travel Vision

Estado em 2026-11-05: buscador com robôs nos bastidores, Férias flexíveis e assistente próprio.

## Em uma frase

Um **buscador** (não vende nada) de passagens em dinheiro e com milhas, que mostra só dados de fontes autorizadas,
sempre com a fonte, o horário da consulta e se a disponibilidade está confirmada, e redireciona o usuário ao parceiro
para comprar ou emitir.

## Camadas

```
┌──────────────────────────── Navegador ─────────────────────────────┐
│ Telas (Next.js App Router, React 19)                               │
│  /  /busca  /ferias  /explorar  /carteira  /simulador  /radar      │
│  /privacidade                                                      │
│  /admin/robos (restrito, senha)                                    │
│ Componentes: AirportInput, DatePicker, Assistant, PartnerLink,     │
│ RouteGlobe (d3-geo), 3D                                            │
│ Carteira no localStorage, só com consentimento; conversa do        │
│ assistente no sessionStorage                                       │
└──────────────┬─────────────────────────────────────────────────────┘
               │ fetch /api/*
┌──────────────▼──────────── Servidor Next.js ───────────────────────┐
│ /api/voos (+ /atualizar)     → search/flights → banco dos robôs    │
│ /api/calendario              → menor preço por dia (dayPrices)     │
│ /api/ferias (+ /atualizar)   → flex/engine → banco dos robôs       │
│ /api/assistente              → assistant/parse + reply             │
│ /api/parceiros               → partners + malha AirLabs (cache)    │
│ /api/rotas                   → routes/registry → AirLabs           │
│ /api/aeroportos              → airportsDb (OurAirports, 4.010)     │
│ instrumentation.ts           → agendador dos robôs (bastidores)    │
└──────────────┬─────────────────────────────────────────────────────┘
               │ importa
┌──────────────▼──────── src/core (sem React/Next) ──────────────────┐
│ robots/   motor, agendador, SQLite, comparação, robôs por fonte    │
│ search/   viagens, junção de ofertas iguais, preço por dia         │
│ flex/     melhores janelas de ida e volta (função pura)            │
│ assistant/ léxico, parser por regras, resposta com cartões         │
│ partners/ parcerias de resgate com nível de evidência              │
│ routes/   malha aérea (AirLabs) com cache e orçamento de consultas │
│ providers/ contratos de fornecedor, cota, cache, provedor simulado │
│ miles/    programas, simulador do milheiro, carteira               │
│ airportsDb, pricing, promotions, validation                       │
└──────────────┬─────────────────────────────────────────────────────┘
               │
┌──────────────▼──────── Bastidores ─────────────────────────────────┐
│ Agendador dentro do servidor (ou npm run robots à parte): a cada   │
│ minuto roda os robôs na hora e grava em .data/travel-vision.db     │
└────────────────────────────────────────────────────────────────────┘
```

O domínio (`src/core`) não depende de React nem de Next: pode ir para um backend Node separado sem reescrita.
O agendador já roda fora do Next pelo mesmo motivo.

## Como foi pensado

1. **Regras primeiro.** Desde 2026-11-04 o projeto roda para **uso pessoal local** (ver `docs/decisoes.md`): APIs de
   terceiros como a SerpAPI são aceitas, mas continua proibido contornar anti-robô, captcha ou limites, e raspar sites
   cujos termos proíbam. Cada fonte entra como adaptador com **metadados de licença**, e o motor **bloqueia** coleta
   por navegador sem permissão documentada.
2. **Nunca inventar preço.** Todo preço carrega uma classificação (`confirmada`, `nao_confirmada`, `historico`,
   `estimativa`), a fonte e o horário. A simulação saiu da busca: sem fonte, a tela diz que não há resultado real.
3. **"Conectado" só com prova.** O status de cada fonte é calculado do banco: só vira "conectada" depois de uma
   execução bem-sucedida com dados. Programa de fidelidade sem fonte aparece como "sem fonte autorizada".
4. **Plugável.** Nova fonte = um arquivo em `src/core/robots/robots/` incluído em `ROBOTS`. Agenda, deduplicação,
   histórico, alertas, erros e tela não mudam.
5. **Cota protegida.** Cache em disco (rotas por 7 dias), teto diário de consultas gravado em disco (site e robôs
   juntos), reserva da cota mensal, espera crescente após falhas.
6. **Identidade própria.** Azul-marinho, aeronave 3D modelada no código (sem marca de companhia), globo desenhado com
   d3-geo sobre contornos de domínio público. Nenhum logotipo real.

## Como funciona, tela a tela

| Tela | O que faz | De onde vêm os dados |
|---|---|---|
| `/` | Assistente de viagem (pergunta livre → resposta com voos) e busca rápida | Banco dos robôs, via `/api/assistente` |
| `/ferias` | Período em meses + duração em dias → 5 melhores janelas, gráfico por mês, mapa de calor por dia, opção de dois bilhetes | Banco dos robôs (Travelpayouts + Google Travel Explore) |
| `/busca` | Ida e volta ou só ida; dinheiro e milhas numa lista só; status de cada modalidade; filtros (modalidade, programa, escalas, disponibilidade, horário, companhia); ordenação por preço, milhas ou custo-benefício; datas próximas; calendário; programas que levam ao destino; "Atualizar agora" quando a fonte permite | Banco dos robôs (só dados reais) + malha AirLabs + parcerias |
| `/explorar` | Globo/mapa de rotas e mapa de parceiros (por programa ou por destino) | AirLabs (cache 7 dias) + parcerias com fonte |
| `/admin/robos` | Restrito: robôs, prova da última consulta, consumo de cotas, preços, câmbio, malha, programas, alertas, erros, execuções | Banco dos robôs |
| `/carteira` | Saldos informados pelo usuário e quanto ele reúne em cada companhia com transferências | Navegador do usuário |
| `/simulador` | Custo do milheiro em transferências e compras, milhas x dinheiro | Cálculo (paridades a conferir) |
| `/radar` | Promoções de transferência e compra de pontos | Exemplos fictícios, rotulados |

## Férias flexíveis (`src/core/flex`)

1. `parseFlexQuery` valida o pedido: até 12 meses, duração de 1 a 45 dias, dias da semana e teto de preço opcionais.
2. `loadFlexData` lê do banco as idas, as voltas e as viagens de ida e volta já coletadas (inclui o código da cidade,
   como SAO, que o calendário da Travelpayouts usa).
3. `computeWindows` (função pura) cruza, para cada dia de ida `d`, a volta mais barata entre `d+min` e `d+max` com uma
   fila monotônica, compara com os bilhetes de ida e volta e devolve as 5 melhores janelas com pelo menos 3 dias de
   distância, o melhor de cada mês e o melhor de cada dia (mapa de calor). Meses além de 330 dias aparecem como
   "ainda não à venda".
4. Faltou dado? `/api/ferias/atualizar` pede à Travelpayouts (calendário do ano) e ao Google Travel Explore (6 meses)
   e a tela recalcula. Janelas do Explore são aproximadas e levam o link de confirmação no Google.

## Assistente (`src/core/assistant`)

Sem IA externa: um parser por regras, em português.

1. `lexicon.ts`: normalização, meses, números por extenso, cerca de 150 apelidos de cidades, estações, feriados e
   programas de milhas.
2. `parse.ts`: tira da frase, nesta ordem, preço, programa, cabine, "direto", tipo de viagem, estações e períodos,
   duração, datas, meses e por fim as cidades (índice de n-gramas + códigos IATA). Sai um `Parsed` com a intenção, os
   campos, o que falta, o que é ambíguo e o que foi presumido. Só continua a conversa anterior ("e em julho?") quando a
   frase é um ajuste curto.
3. `reply.ts`: consulta o banco (busca, férias, "para onde ir", parceiros) e monta texto, cartões, link e sugestões.
   Se faltam preços, devolve um pedido de atualização; o navegador o dispara e pergunta de novo com o mesmo `Parsed`.
4. Corpus de 160 frases nos testes, com meta de 90% de acerto (hoje 100%).

## Fluxo de um robô

1. O agendador verifica a cada minuto quem está na hora (frequência por robô, configurável).
2. O motor confere a política (fonte permitida?) e a configuração (tem chave?).
3. Trava o robô contra execução dupla e chama `run()`.
4. O robô consulta a fonte e devolve observações normalizadas.
5. O motor deduplica, grava o estado e o histórico, gera eventos (queda de 10% ou mais vira oportunidade, mais
   disponibilidade, rota nova ou extinta) e registra os erros.
6. Fecha a execução como `ok`, `partial` ou `error`. Depois de falhas seguidas, o intervalo dobra (até 8x).

## Dados guardados

`.data/travel-vision.db` (SQLite nativo do Node): `robot_state`, `robot_runs`, `source_errors`, `fares`,
`fare_history`, `schedules`, `fx_rates`, `events`. Nenhum dado pessoal. `.cache/airlabs/`: respostas da AirLabs e o
contador diário de consultas.

## Revisão de 2026-11-02: o que foi corrigido

| Problema | Correção |
|---|---|
| O mapa público podia esgotar a cota mensal da AirLabs: o limite contava pedidos, mas cada pedido faz até 30 consultas | Teto diário por consulta real, gravado em disco, e reserva da cota mensal informada pela AirLabs. Se acabar no meio, guarda o que veio como parcial. Testado |
| Limite por minuto e limite diário tinham o mesmo nome e mostravam a mensagem errada | Nomes separados e mensagem própria para o limite diário |
| No artefato publicado, o novo campo de origem/destino não achava nada e as telas Mapa e Robôs abriam a página inicial | O artefato responde às sugestões com a mesma base e mostra uma página explicando que essas telas precisam do servidor |
| Adaptador Duffel (API de reserva) ainda ligável, contra a decisão "só buscador" | Removido, com as referências |
| Sem cabeçalhos de segurança | `nosniff`, `Referrer-Policy`, `X-Frame-Options`, `Permissions-Policy` |
| Política de privacidade não citava os robôs nem o redirecionamento | Atualizada |
| Checklist de conformidade parado na entrega de 30/10 | Nova entrada de 02/11 |

## Pendências que dependem de terceiros

- Fonte autorizada de resgates com milhas (parceria ou fornecedor licenciado).
- Confirmação por escrito dos termos comerciais da AirLabs; plano pago antes do lançamento. A chave gratuita vence em
  30/11/2026.
- Servidor para rodar o agendador 24 h; migração de SQLite para PostgreSQL quando houver mais de uma instância.
- Revisão jurídica da política de privacidade.
