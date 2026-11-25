# Robôs de coleta automatizada

Estado em 2026-11-02. Painel técnico (restrito): `/admin/robos`. Código: `src/core/robots`.

Os robôs rodam sozinhos dentro do servidor do site (`src/instrumentation.ts` → `src/core/robots/scheduler.ts`), sem
que ninguém precise abrir página nenhuma. `npm run robots` continua disponível para rodar num processo separado
(nesse caso, `ROBOTS_IN_SERVER=0` no site). A busca (`/busca`) lê o banco; com fonte que permite consulta pontual,
o botão "Atualizar agora" chama `refreshRoute` (no máximo 1 vez a cada 15 min por rota).

## Arquitetura

```
config/monitor.json         rotas, aeroportos, meses e moedas monitorados (lido a cada execução)
scripts/robots.ts           agendador: npm run robots  (--once, --run=ID, --status)
src/core/robots/
  types.ts                  contrato Robot, FareObservation, classificação de disponibilidade
  engine.ts                 agenda, trava, política de acesso, espera crescente, eventos
  store.ts                  SQLite: execuções, erros, tarifas, histórico, malha, câmbio, eventos
  compare.ts                dinheiro x milhas, câmbio, custo por ponto, oportunidade
  registry.ts               lista de robôs e de programas; status calculado a partir do banco
  dashboard.ts              dados da tela /robos
  robots/                   um arquivo por fonte
src/app/admin/robos/page.tsx painel técnico restrito: estado, provas, cotas, preços, alertas e registro
src/core/search/flights.ts   motor de busca: consolida dinheiro e milhas a partir do banco
src/app/api/voos             busca (GET) e atualização sob demanda (POST /api/voos/atualizar)
```

Fluxo de uma execução: o agendador verifica a cada minuto quem está na hora → o motor confere a política (robô de
navegador sem permissão documentada ou fonte sem uso comercial é bloqueado) e a configuração (chave) → trava o robô →
o robô consulta a fonte e devolve observações normalizadas → o motor deduplica, grava estado e histórico, gera eventos
(queda de preço ≥ 10 %, mais disponibilidade, rota nova ou extinta) e registra erros → fecha a execução com status
`ok`, `partial` ou `error`. Após falhas seguidas, o intervalo dobra (até 8x). Fonte fora do ar não gera dado nenhum.

Para adicionar uma fonte: criar um `Robot` em `src/core/robots/robots/` e incluí-lo em `ROBOTS` (`registry.ts`).

## Classificação obrigatória dos preços

| Valor | Significado | Indicador |
|---|---|---|
| `confirmada` | Preço e assento confirmados pela fonte na consulta | verde |
| `nao_confirmada` | Preço encontrado, disponibilidade não garantida | amarelo |
| `historico` | Data já passou ou registro antigo | neutro |
| `estimativa` | Simulação; nunca é exibida como preço | vermelho |

O motor de comparação ignora `historico` e `estimativa`, mostra fonte e horário de cada lado, avisa quando as consultas
têm mais de 24 h de diferença e só converte moeda com cotação PTAX registrada.

## Robôs

| Robô | Fonte | Acesso | Frequência padrão | Estado |
|---|---|---|---|---|
| `travelpayouts-precos` | Aviasales Data API (Travelpayouts) | API de afiliado com token | 6 h | **Não configurado**: falta `TRAVELPAYOUTS_TOKEN`. Código e testes prontos; ainda não validado com resposta real |
| `airlabs-malha` | AirLabs Routes API | API oficial com chave | 7 dias (igual ao cache) | **Conectado**: consulta real em 02/11/2026 (FLN e CNF: 51 consultas; VIX vinha do cache de 31/10) |
| `bcb-ptax` | Banco Central, PTAX (Olinda) | Dados abertos | 6 h | **Conectado**: consulta real em 02/11/2026, USD e EUR, 25 boletins cada |

Frequência configurável por robô: `ROBOT_<ID>_EVERY_MIN` em `.env.local` (mínimo 5).

## Evidências (consultas reais de 02/11/2026)

- PTAX de fechamento em 30/10/2026: USD venda R$ 5,4212; EUR venda R$ 6,0522.
- Malha: CNF 162 voos regulares para 24 destinos; FLN 125 voos para 14 destinos; VIX 107 voos para 10 destinos. Exemplo:
  FLN → AEP, voo G3 7692, 17:15–19:30, todos os dias. As três coletas estão marcadas como **parciais** (limite de 50
  linhas por consulta do plano gratuito).

## Limitações por fonte

- **Travelpayouts**: preços das buscas de usuários do Aviasales nas últimas 48 h, por isso ficam sempre como
  `nao_confirmada`. O preço é o total, sem taxas separadas. Só classe econômica. Limite de requisições não confirmado
  (o robô espera 1,1 s entre consultas). Os termos de exibição e de armazenamento ainda precisam ser lidos ao criar a
  conta.
- **AirLabs**: malha programada, sem preço. No plano gratuito os aeroportos grandes ficam parciais. Uso comercial e
  redistribuição a confirmar por escrito. A chave gratuita vence em 30/11/2026.
- **PTAX**: só dias úteis; o boletim de fechamento sai por volta das 13 h.

## O que depende de acesso ou autorização externa

| Item | Depende de |
|---|---|
| Preços reais em dinheiro | Conta de afiliado Travelpayouts (token) |
| Qualquer preço em milhas (Smiles, LATAM Pass, Azul, TAP, Iberia, Aeroplan, United, AAdvantage, LifeMiles, Flying Blue) | Parceria com o programa ou fornecedor licenciado. Nenhuma API pública de resgate identificada. Robô de navegador só com permissão expressa nos termos, ainda não obtida |
| Disponibilidade confirmada em dinheiro | API de busca ao vivo (Skyscanner, GDS ou companhia), por aprovação comercial |
| Coleta 24 h | Servidor com o agendador rodando continuamente |

Seats.aero continua fora como fonte (regra 2 da diretriz original): a assinatura Pro é para uso pessoal, e o uso
comercial exige acordo por escrito.
