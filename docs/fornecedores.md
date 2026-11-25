# Fichas de fornecedores

Documento mantido pelo especialista em integrações (diretriz, seção 4). **Nenhum campo abaixo deve ser tratado como
confirmado até ter fonte: link do contrato, termo de uso, e-mail do fornecedor ou teste registrado.** Onde está
"a confirmar", a informação ainda não foi verificada.

Status possíveis: `a investigar` · `em contato` · `testado` · `aguardando contrato` · `ativo` · `descartado (motivo)`.

## Descartados por regra

| Fornecedor | Motivo |
|---|---|
| Seats.aero | Regra 2 da diretriz: proibido como fonte de dados. |
| Qualquer fonte com licença só para uso pessoal | Regra 3. |
| Scraping de sites de companhias, programas ou concorrentes | Regras 4 e 5. |

---

## A. Tarifas em dinheiro

### A1. Duffel — `descartado` (adaptador removido em 2026-11-02)

| Campo | Valor |
|---|---|
| Tipo | API de busca e reserva (agência online) |
| Companhias cobertas | a confirmar (lista no painel do fornecedor) |
| Dados | ofertas com preço total, segmentos, bagagem por passageiro, cabine |
| Atualização | tempo real (consulta às companhias a cada busca) |
| Cache | permitido? **a confirmar** — impacta o calendário de preços |
| Custo e limites | a confirmar (modelo por reserva/busca; limites de taxa da API) |
| Uso comercial | contrato comercial; **confirmar se exibir preços sem reservar pelo Duffel é permitido** |
| Redistribuição / atribuição | a confirmar |
| Brasil | a confirmar: emissão para cliente brasileiro, BRL, companhias nacionais |
| Calendário de preços | não há endpoint de calendário; exigiria varredura dia a dia (custo e cota) |
| Status | `descartado` — API de reserva; o Travel Vision é só buscador, sem venda (decisão de 2026-10-30) |

### A2. Programas de afiliados de metabuscadores

Pesquisa de 2026-10-30, em grande parte com fontes secundárias: **confirmar nos portais oficiais antes de assinar.**

| Fornecedor | Acesso para site novo | Calendário / cache | Modelo | Status |
|---|---|---|---|---|
| Travelpayouts (dados do Aviasales) | Data API com token gratuito de afiliado; a busca ao vivo exigiria cerca de 50 mil usuários/mês (fonte secundária) | Endpoint de preços por mês (dados em cache das buscas do Aviasales) | Comissão por venda no parceiro | `candidato principal` — confirmar cobertura de rotas brasileiras, BRL, termos de exibição e de cache |
| Skyscanner Partners | Aprovação manual, voltada a parceiros já estabelecidos; há um nível mais leve só de links de afiliado | Cache de preços proibido (fonte secundária) | CPA ou divisão de receita | `depois` — candidatar quando houver tráfego |
| Kiwi.com Tequila | Cadastro aberto encerrado; parcerias seletivas, segundo o próprio Kiwi.com | — | Divisão de receita | `improvável` agora |

Próximo passo: abrir conta de afiliado na Travelpayouts, ler os termos da Data API e testar rotas brasileiras.

Fontes: [Travelpayouts Data API (documentação não oficial)](https://travelpayouts-data-api.readthedocs.io/),
[Zuplo sobre Travelpayouts](https://zuplo.com/blog/2025/05/13/travelpayouts-api),
[Supergood sobre Skyscanner](https://supergood.ai/api-report-card/skyscanner-api),
[Kiwi.com sobre parcerias](https://media.kiwi.com/articles-and-interviews/better-for-business-kiwi-com-takes-a-new-approach-to-partnerships/),
[Vervotech sobre Tequila](https://www.vervotech.com/hub/integrations/tequila-api/).

### A3. APIs de GDS e de companhias aéreas (NDC) — `a investigar`

Amadeus, Sabre, Travelport e APIs NDC das companhias. Normalmente exigem contrato empresarial e/ou credenciamento
como agência. Avaliar na Fase 2 ou 3.

---

## B. Disponibilidade com milhas

Ordem de prioridade da diretriz (seção 4.2).

### B1. LATAM Pass · Smiles · Azul Fidelidade — `em contato (pendente)`

| Campo | LATAM Pass | Smiles | Azul Fidelidade |
|---|---|---|---|
| API pública de disponibilidade de resgate | não identificada | não identificada | não identificada |
| Programa de parceria/afiliados | a confirmar | a confirmar | a confirmar |
| Contato comercial | a iniciar | a iniciar | a iniciar |
| Status | `a investigar` | `a investigar` | `a investigar` |

Lacuna: não há, até onde se sabe, API pública desses programas com disponibilidade de assentos para resgate.
Caminhos legítimos propostos:
1. Proposta de parceria de dados (o Travel Vision gera tráfego qualificado e emissões para o programa).
2. Programa de afiliados que exponha disponibilidade ou links profundos para a busca do programa.
3. Enquanto isso, links diretos para a busca oficial do programa com os parâmetros preenchidos (sem coletar dados).

### B2. APIs comerciais de dados de resgate (exceto Seats.aero) — `a investigar`

Pesquisa de 2026-10-30. Nenhum fornecedor confirmou ainda cobertura de Smiles, LATAM Pass ou Azul Fidelidade.

| Fornecedor | O que foi encontrado | Próximo passo |
|---|---|---|
| AwardTool | Vende API empresarial, licenciada por programa (cerca de 28 programas) | Pedir lista de programas, termos e preço |
| AwardWallet | API de busca de resgates (rotas, cabine, milhas, taxas); termos comerciais não encontrados | Contato comercial |
| AwardClaw, Award Flight Daily, Award Travel Finder | APIs anunciadas; licença não encontrada | Verificar termos e origem dos dados |
| PointsYeah, Point.me, AwardFares, ExpertFlyer, Roame, Flightpoints | Nenhuma API comercial encontrada | Contato direto |

Ponto de atenção: confirmar **como cada fornecedor obtém os dados**. Se ele mesmo faz scraping dos programas, a
licença dele não resolve o risco (regras 1 e 4).

Observação: o Seats.aero oferece uso comercial da API **mediante acordo por escrito**, e por isso a ressalva vale
a pena, mas a regra 2 da diretriz o exclui. Só reavaliar se a diretriz mudar.

Fontes: [AwardTool Enterprise API](https://www.awardtool.com/enterprise-api),
[AwardWallet API](https://awardwallet.com/api/main), [AwardClaw](https://www.awardclaw.com/developers),
[Award Travel Finder](https://awardtravelfinder.com/developers/api), [termos do Seats.aero](https://seats.aero/terms).

### B3. Outros fornecedores de disponibilidade de resgate com licença comercial — `a investigar`

### B4. Parcerias diretas com programas internacionais — `a investigar`

Prioridade para programas com rotas a partir do Brasil (alianças Oneworld, Star Alliance e SkyTeam).

---

## D. Rotas e malha aérea (mapa de rotas)

### D1. AirLabs — `ativo em desenvolvimento` · `src/core/routes/airlabs.ts`

| Campo | Valor |
|---|---|
| Dados | Voos regulares por rota: companhia, número, horários, duração, dias da semana (Routes API v9) |
| Atualização | Malha programada, não é tempo real; campo `updated` por registro |
| Cache | 7 dias para rotas e 90 dias para nomes de companhias, em `.cache/airlabs` |
| Plano atual | Gratuito: 1.000 consultas/mês, 50 linhas por consulta, **sem paginação**; chave válida até 30/11/2026 (testado em 31/10/2026) |
| Contorno do limite de linhas | Consulta por companhia (filtro documentado `airline_iata`), cada uma contando na cota. Aeroportos grandes ficam **parciais**, e a tela avisa |
| Uso comercial / redistribuição | **a confirmar**: os [termos](https://airlabs.co/terms-of-service) não tratam de licença de dados nem de exibição a usuários finais |
| Status | Pedir à AirLabs, por escrito, condições comerciais e um plano pago com paginação antes do lançamento |

Alternativas para produção: AirLabs pago (500 linhas por consulta, com paginação), Aviation Edge (Routes API),
OAG ou Cirium (referência do setor em malha aérea, contrato empresarial). O OpenFlights é gratuito, mas está
desatualizado desde 2014 e não serve como fonte.

### D2. OurAirports — `ativo`

Base de aeroportos (nome, cidade, país, coordenadas), domínio público. Gerada por `scripts/build-airports.mjs`.

## C. Referências de mercado: como os concorrentes obtêm dados (pesquisa de 2026-10-30)

Não são fornecedores; servem para entender o mercado.

| Serviço | Programas brasileiros (segundo fontes secundárias) | Origem dos dados |
|---|---|---|
| Seats.aero | Smiles e Azul; LATAM Pass não | Consultas automáticas aos sites dos programas. A Air Canada o processa nos EUA por isso (caso em andamento) |
| AwardFares | Smiles e Azul; LATAM Pass não | Não divulgado |
| TKMilhas, EconoMilha, alertas do Passageiro de Primeira | LATAM Pass, Smiles e Azul | Não divulgado |
| ExpertFlyer | Fraca | Conexão via GDS; deixou de mostrar resgates Star Alliance |
| point.me, PointsYeah, Roame, SeatSpy | Fraca ou nenhuma | Não divulgado |

Conclusão: o setor de busca de resgates funciona majoritariamente com robôs nos sites dos programas, sem
autorização, e as companhias vêm reagindo (processo da Air Canada, restrições de busca da Singapore Airlines).
Isso confirma a lacuna: uma fonte licenciada com os programas brasileiros só virá por parceria ou contrato.

**Por que o Google Flights mostra a LATAM:** é um metabuscador. As companhias e agências **enviam** tarifas e
disponibilidade ao Google (feed de preços em cache ou consulta ao vivo), porque recebem tráfego e vendas em troca.
O motor de preços vem da ITA Software, comprada pelo Google. Isso é para tarifas em dinheiro: o Google não mostra
disponibilidade de resgate com milhas.

Fontes: [One Mile at a Time](https://onemileatatime.com/news/airlines-shut-down-websites-scraping-awards/),
[View from the Wing](https://viewfromthewing.com/air-canada-says-award-scraping-is-computer-fraud-seats-aero-says-thats-anticompetitive/),
[MileLion](https://milelion.com/2026/07/24/sia-new-search-restrictions-to-combat-automated-and-repetitive-search-activity/),
[MilhasBot](https://www.milhasbot.com.br/ferramentas/buscadores-de-passagem-em-milhas/),
[Ajuda do Google Flights para parceiros](https://support.google.com/travel/answer/9905232),
[ITA Software (Wikipedia)](https://en.wikipedia.org/wiki/ITA_Software).

## Critério de sucesso da Fase 1

- [ ] Fichas acima preenchidas com fonte em todos os campos.
- [ ] Pelo menos um caminho viável para dados de milhas (contrato, licença ou parceria em andamento).
- [ ] Um fornecedor de tarifas em dinheiro testado com chave real e com licença confirmada.
