# Plano: Férias flexíveis e Assistente de viagem

Versão para validação · 05/11/2026 · Fase 0 concluída: ver `docs/fase0-resultados.md`

## 1. Objetivo

Duas funções novas, que usam o mesmo motor:

1. **Férias flexíveis:** o usuário diz para onde vai, em que período tem disponibilidade e quantos dias quer ficar
   (ex.: "Madri, em 2027, de 2 a 3 semanas"), e o Travel Vision mostra **as datas mais baratas** dentro desse período.
2. **Assistente de viagem:** uma barra onde o usuário escreve em português ("quanto fica Vitória → Lisboa dia
   10/12?", "qual o mês mais barato pra Madri em 2027?") e recebe a resposta com os voos.

### Princípios (decididos)

- **Sem IA de terceiros.** O assistente é feito por nós e roda no nosso servidor: custo zero por uso, nenhuma conversa
  sai do Travel Vision.
- **Só dado real.** O assistente nunca inventa preço: ele entende o pedido, chama o motor e conta o que o motor achou.
  Dia sem dado aparece como "sem dado", não como estimativa.
- **Escolhas de produto já aprovadas:** aba própria no menu ("Férias flexíveis"); período por meses; duração em
  dias com atalhos de 1, 2 e 3 semanas; dois bilhetes separados entram no ranking (com aviso); confirmação no
  Google só ao clicar.

## 2. O que os testes com dados reais mostraram (05/11/2026)

| Fonte | O que retornou | Conclusão |
|---|---|---|
| Aviasales, preços por mês (só ida) | Vitória → Madri: 1 dia com preço em 12 meses. São Paulo → Madri: 1 a 13 dias por mês até maio de 2027, quase nada depois | Sozinha, não preenche um ano: serve para os meses próximos |
| Aviasales, calendário de ida e volta | São Paulo → Madri: cerca de 45 viagens de ida e volta no ano, 1 a 12 por mês | Bom para achar janelas reais; pouco nos meses distantes |
| Aviasales, busca por duração (semanas) | 30 viagens de ida e volta no ano para São Paulo → Madri com cerca de 2 semanas | Útil e já filtra pela duração |
| Google Travel Explore (SerpAPI) | **Testado na Fase 0:** 1 consulta = melhor janela real do período para a rota, inclusive saindo de Vitória. Só próximos 6 meses e no máximo 2 semanas | **Fonte principal dos próximos 6 meses** (ver `docs/fase0-resultados.md`) |
| Google Flights (SerpAPI), data exata | 10 voos reais VIX → LIS em 10/12 | Para **confirmar** as melhores janelas |

**Consequências para o desenho:**
- **Cobertura variável:** a tela mostra o quanto de dado existe em cada mês, e meses vazios oferecem "consultar
  este mês".
- **Cidades pequenas:** saindo de uma cidade pequena (Vitória), há bem menos dado do que saindo de São Paulo. A tela
  pode mostrar, separado e bem rotulado: "saindo de São Paulo há mais opções". Nunca misturar uma origem com a
  outra.
- **Datas ainda não à venda:** as companhias vendem com cerca de 11 meses de antecedência. Hoje, o período depois de
  outubro de 2027 aparece como "ainda não à venda".

## 3. Férias flexíveis

### 3.1 O que o usuário informa

| Campo | Formato | Padrão |
|---|---|---|
| Origem | Aeroporto ou cidade | Da localização ou da última busca |
| Destino | Aeroporto ou cidade | — |
| Período | Mês inicial e final (ex.: mar/2027 a jul/2027) ou "ano todo" | Próximos 6 meses |
| Duração | De X a Y dias, com atalhos 1, 2 e 3 semanas | 14 a 21 dias |
| Opções | Só direto; dias da semana para sair; teto de preço | Nenhuma |

### 3.2 O que a tela mostra

1. **Resumo:** "Melhor janela: sai qui, 4 mar e volta dom, 21 mar (17 dias), R$ 2.890 ida e volta. Dados de hoje,
   Aviasales e Google."
2. **Top 5 janelas,** cada uma com datas, duração, preço total, tipo (bilhete único ou 2 bilhetes), companhia, idade
   do dado e os botões "Ver voos" (abre a busca normal com as datas) e "Confirmar preço agora" (Google, 2 consultas).
3. **Mapa de calor do período,** um quadrado por dia de saída, pintado pelo preço da melhor viagem que começa nele:
   verde barato, vermelho caro, cinza sem dado, hachurado ainda não à venda. Ao passar o mouse: "sai 4/mar → volta
   21/mar, R$ 2.890".
4. **Gráfico por mês:** menor preço de cada mês e quantidade de dado ("março: 9 dias com preço").
5. **Meses sem dado:** botão "Consultar este mês no Google", que gasta 1 consulta da cota e avisa antes.

### 3.3 Como o cálculo funciona (motor `src/core/flex`)

Entrada: preços reais já guardados no banco para a rota, nos dois sentidos, no período.

1. **Bilhetes únicos de ida e volta:** cada tarifa com ida em D e volta em R entra se a duração R − D estiver entre
   X e Y dias.
2. **Dois bilhetes separados:** para cada dia D, pega a ida mais barata em D e a volta mais barata entre D+X e D+Y. O
   mínimo nessa janela deslizante é calculado de uma vez para o período todo (fila monotônica), então um ano inteiro
   leva milissegundos.
3. **Filtros:** só direto, dias da semana, teto de preço.
4. **Melhor de cada dia D:** o menor entre (1) e (2), guardando tipo, fonte e idade do dado.
5. **Top 5:** as janelas mais baratas, sem repetir praticamente a mesma viagem (no mínimo 3 dias de diferença entre
   uma e outra).
6. **Cobertura:** a porcentagem de dias de saída com algum preço, por mês.

Não há estimativa nem interpolação: cada número na tela veio de uma fonte, com data e hora.

### 3.4 De onde vêm os dados (coleta sob demanda, com cache)

| Ordem | Fonte | Quando | Custo por pesquisa |
|---|---|---|---|
| 1 | O que já está no banco | Sempre, na hora | Zero |
| 2 | Aviasales: calendário de ida e volta do ano + busca por duração + meses só ida (2 sentidos) | Rota/período sem dado recente (6 h) | Grátis; cerca de 15 a 30 consultas, 20 a 40 s na primeira vez, em segundo plano |
| 3 | Google Travel Explore | Se a Fase 0 aprovar: ano todo para a duração escolhida | Cerca de 1 a 12 consultas da SerpAPI por pesquisa, com cache de 24 h |
| 4 | Google Flights, data exata | Só ao clicar em "Confirmar preço agora" | 2 consultas |

A tela aparece logo com o que já existe e vai se completando, com o aviso "buscando mais preços…", como a busca
normal já faz.

### 3.5 Peças novas

- `src/core/flex/` com `types`, `engine` (cálculo das janelas), `collect` (coleta nas fontes) e testes.
- Robô Travelpayouts: os modos "calendário ida e volta do ano" e "busca por duração".
- Robô SerpAPI: o modo "Travel Explore" (se a Fase 0 aprovar).
- API: `GET /api/ferias` (resultado) e `POST /api/ferias/atualizar` (coleta), com limite por rota.
- Tela: `src/app/ferias/` (formulário, resumo, top 5, mapa de calor, gráfico por mês).
- Menu: "Férias flexíveis", entre "Buscar voos" e "Explorar destinos".

## 4. Assistente de viagem (próprio, sem IA externa)

### 4.1 Onde aparece

- **Página inicial:** barra grande "Para onde você quer ir?" com exemplos clicáveis embaixo.
- **Busca e Férias flexíveis:** um ícone para abrir o assistente.
- A resposta aparece em conversa: frase curta + cartões de voo ou o resumo das férias flexíveis, com o botão para o
  parceiro.

### 4.2 O que ele entende

| Pedido | Intenção | Ação |
|---|---|---|
| "quanto fica VIX pra Lisboa dia 10/12?" | Preço numa data | Busca só ida |
| "ida e volta pra Santiago de 1 a 4 de dezembro" | Ida e volta | Busca ida e volta |
| "qual o mês mais barato pra Madri em 2027?" | Período mais barato | Férias flexíveis, ano todo |
| "2 a 3 semanas em Paris no 1º semestre" | Janela de férias | Férias flexíveis, jan a jun |
| "direto pro Rio semana que vem até R$ 500" | Preço com filtros | Busca com só direto e teto |
| "e se for em julho?" / "e voltando dia 20?" | Ajuste da anterior | Mantém o resto e troca o período ou a data |
| "quais programas me levam pra Lisboa?" | Parceiros | Mapa de parceiros |
| "quanto vale meu milheiro se paguei R$ 35 com 80% de bônus?" | Simulador | Simulador de milhas |

### 4.3 Como ele entende (módulo `src/core/assistant`)

1. **Normaliza:** minúsculas, sem acento, números por extenso ("dez" → 10, "duas semanas" → 14 dias).
2. **Cidades:** procura trechos que casem com a base de 4 mil aeroportos e as cidades conhecidas. Usa as pistas
   "de/saindo de" (origem) e "para/pra/até/em" (destino). Sem origem → a cidade do usuário.
3. **Datas e períodos:** "dia 10", "10/12", "10 de dezembro", "dezembro", "em 2027", "1º semestre", "férias de
   julho", "semana que vem", "fim de semana", "daqui a 2 meses", "de 1 a 4 de dezembro".
4. **Duração:** "15 dias", "2 semanas", "2 a 3 semanas", "uma semana", "um mês".
5. **Filtros:** "direto/sem escala", "até R$ 500", "barato/mais barato", "só ida", "ida e volta", "executiva".
6. **Intenção:** decidida pelas peças encontradas (ex.: período + duração → férias flexíveis; uma data → preço
   naquela data).
7. **O que falta:** se faltar algo essencial, pergunta só isso ("Para quando? Ex.: em março, ou de 10 a 20/12"), com
   botões de resposta rápida.
8. **Ambiguidade:** "São José" (vários lugares) → mostra as opções para escolher. Nunca chuta.
9. **Conversa:** guarda a última busca na sessão do navegador para entender "e se for em julho?". Nada é gravado no
   servidor.

### 4.4 Como ele responde

- Frases prontas e variadas, preenchidas com os números do motor: "Achei 9 voos de Vitória para Lisboa em 10/12. O
  mais barato é Azul, R$ 2.269, com 1 escala (13h05)."
- Sempre com fonte e idade do dado: "preços do Google Flights, consultados agora".
- Sem dado: "Não encontrei preço real para essa data. Quer ver as datas próximas?" (botão).
- Mostra sempre "Entendi: Vitória → Lisboa · 10/12 · só ida", com a opção de editar no formulário.

### 4.5 Garantia de qualidade

- **Banco de frases de teste:** pelo menos 150 frases reais em português (com erros de digitação, gírias, sem
  acento), cada uma com o resultado esperado. Os testes automáticos rodam a cada mudança.
- **Meta:** 90% das frases entendidas corretamente. Nas outras, o assistente pergunta em vez de errar.
- **Registro anônimo opcional** das frases não entendidas (sem dados pessoais, com consentimento), para melhorar o
  entendimento.

### 4.6 Peças novas

- `src/core/assistant/` com `normalize`, `entities` (cidades, datas, duração, filtros), `intent`, `dialog`
  (contexto da conversa), `reply` (frases) e o banco de frases de teste.
- API: `POST /api/assistente` (texto + contexto → o que entendeu, o que falta, ação e resposta).
- Telas: barra na página inicial, painel de conversa reutilizável e os cartões de resultado já existentes.

## 5. Fases e critérios de aceite

| Fase | Entrega | Pronto quando |
|---|---|---|
| **0. Validar fontes** | Testes reais do Google Travel Explore (duração 1, 2 e 3 semanas) e do calendário ida e volta da Aviasales | Sei, com números reais, quanto cada fonte cobre de um ano para 3 rotas (VIX → MAD, SAO → MAD, VIX → SCL). Custo: cerca de 6 consultas SerpAPI |
| **1. Motor de janelas** | `src/core/flex` + coleta + APIs + testes | Testes cobrindo bilhete único, dois bilhetes, filtros, top 5 sem repetição, cobertura, "ainda não à venda" |
| **2. Tela Férias flexíveis** | Aba nova, formulário, resumo, top 5, mapa de calor, gráfico por mês, "consultar este mês", "confirmar agora" | VIX → MAD em 2027, 14 a 21 dias, mostra janelas reais com fonte e data, em computador e celular |
| **3. Entendimento do assistente** | `src/core/assistant` + banco de 150 frases | 90% das frases do banco entendidas; o resto vira pergunta, nunca erro |
| **4. Assistente na tela** | Barra na página inicial, conversa, perguntas de acompanhamento, respostas com cartões | Os 8 tipos de pedido da tabela 4.2 funcionam de ponta a ponta |
| **5. Refinos** | Exemplos clicáveis, acessibilidade, desempenho, documentação | Revisão final e testes passando |

Depois deste plano (não incluído): alertas "me avise quando baixar" (exige cadastro e LGPD), "qualquer destino"
("para onde é mais barato ir em março?") e milhas (com o Seats.aero).

## 6. Cotas e custos

| Ação | Consultas SerpAPI (plano grátis: 250/mês, teto de 8/dia) |
|---|---|
| Férias flexíveis só com Aviasales | 0 |
| Férias flexíveis com Google Travel Explore (se aprovado) | 1 a 12 por rota e duração, com cache de 24 h |
| "Confirmar preço agora" | 2 |
| "Consultar este mês no Google" | 1 |
| Assistente | O mesmo que a busca que ele dispara |

Com o Google Travel Explore aprovado, o teto de 8 por dia fica curto para uso real. O plano Starter (US$ 25/mês,
1.000 consultas) resolve na fase de testes com usuários.

## 7. Riscos e como lidar

| Risco | Como lidar |
|---|---|
| Pouco dado nos meses distantes | Cobertura visível, "consultar este mês", Google Travel Explore |
| Cidade pequena com pouco dado | Mostrar à parte "saindo de São Paulo há mais opções", sem misturar |
| Google Travel Explore instável (bugs nas notas de versão) | Fase 0 antes de depender dele; o motor funciona sem ele |
| Assistente entende errado | Sempre mostra "Entendi: …" com edição; pergunta quando há dúvida; banco de frases de teste |
| Cota da SerpAPI acaba | Cache, teto diário, a tela continua com o que há no banco |
| Preço mudou desde a coleta | Idade do dado em todo preço e botão "Confirmar preço agora" |

## 8. Fontes

- [Google Travel Explore API (SerpAPI, anúncio)](https://serpapi.com/blog/introducing-serpapi-google-travel-explore-api/)
- [Notas de versão do Google Travel Explore API](https://serpapi.com/google-travel-explore-api/release-notes)
- Testes de 05/11/2026 com a Aviasales Data API (endpoints `v3/prices_for_dates`, `v1/prices/calendar`,
  `v2/prices/latest`, `v2/prices/month-matrix`, `v3/grouped_prices`), feitos com o token do projeto.

## 9. Andamento

### Fase 1 concluída (05/11/2026)

- Motor: `src/core/flex/engine.ts` (função pura, fila monotônica para "dois bilhetes", bilhete único, folga de ±1
  dia para janelas do Google Explore, filtros, top 5 sem repetição, status por dia e por mês, cobertura).
- Carregamento: `src/core/flex/load.ts` (dois sentidos, códigos de cidade e de aeroporto, câmbio PTAX).
- Pedido: `src/core/flex/query.ts` (até 12 meses, 1 a 45 dias, só direto, teto, dias da semana).
- Coleta: robô novo `serpapi-explore` (sob demanda, cache 24 h, teto diário da SerpAPI) e modo férias no robô
  `travelpayouts-precos` (ida e volta do ano + só ida mês a mês nos dois sentidos).
- APIs: `GET /api/ferias` e `POST /api/ferias/atualizar`.
- Testes: 11 novos (60 no total).
- **Teste real VIX → MAD, jan a jun/2027, 14 a 21 dias:** 30 s de coleta (14 consultas Aviasales, 4 SerpAPI).
  Melhor janela: 06/03 → 21/03/2027, 15 dias, R$ 5.185 (Google Explore, LATAM). Maio sem preço; junho só com dois
  bilhetes (R$ 9.314).

**Para a Fase 2 (tela):** a cobertura dia a dia é baixa (3% nesse teste) porque o Google dá uma janela por mês: a
tela gira em torno da "melhor janela de cada mês", com o mapa de calor como detalhe. Mês sem preço oferece
"consultar este mês". Código de companhia `multi` vira "várias companhias".

### Fase 2 concluída (05/11/2026)

- Tela `/ferias` ("Férias flexíveis" no menu): origem pela localização, meses (de/até, atalhos 3, 6 e 12 meses),
  duração com atalhos (fim de semana, 1, 2, 2 a 3, 3 semanas, 1 mês) e controles de mínimo/máximo, mais opções (só
  direto, teto, dias da semana para sair).
- Resultado: melhor janela do período, gráfico "melhor janela de cada mês" (uma cor, a mais barata destacada e
  rotulada, mês sem preço com "Consultar", mês não à venda hachurado), as 5 melhores janelas com "Ver voos" (abre a
  busca nas datas, que consulta o Google na hora), mapa de calor por dia de saída e a cobertura explicada.
- Mostra primeiro o que está no banco e consulta as fontes em segundo plano.
- Verificado no navegador com VIX → MAD, jan a jun/2027, 14 a 21 dias, no computador e no celular.

### Fase 3 concluída (05/11/2026)

- Módulo `src/core/assistant/` (sem IA externa, roda no servidor):
  - `lexicon.ts`: meses, números por extenso, épocas (Natal, Réveillon, Carnaval 2026 a 2029, férias de julho…),
    cerca de 150 nomes de cidade em português e apelidos (Sampa, Floripa, BH, Noronha), nomes com acento para
    cidades de fora (Tóquio, Milão, Nova Délhi), programas de milhas.
  - `parse.ts`: tira do texto, nesta ordem, preço máximo, programa, cabine, "direto", só ida/ida e volta, épocas,
    períodos relativos, duração, fins de semana, datas (intervalos, dd/mm, "10 de dezembro", hoje/amanhã, dia da
    semana, "dia 10"), meses, semestres e anos; depois acha as cidades no que sobrou (até 4 palavras, código IATA,
    papel de origem ou destino pelas preposições). Decide a intenção, trata seguimento de conversa, presume o que é
    razoável (origem da localização, próximos 6 meses, 14 a 21 dias) e lista o que falta.
  - `describe.ts`: "Entendi: Vitória (VIX) → Lisboa (LIS) · 10/12 · só ida", a próxima pergunta e o que foi
    presumido.
- Banco de 160 frases (`corpus.ts`), com erros de digitação, gírias, sem acento e seguimentos: **100% entendidas**
  (meta 90%). Primeira rodada: 94%; as 9 falhas eram do parser e foram corrigidas (palavras comuns que são códigos de
  aeroporto como "bom" e "mas", separador de milhar, dia da semana sem "na", volta contada a partir do mês da ida…).
- Teste de generalização com 10 frases inéditas: 7 certas de primeira. Nas outras, o assistente perguntou em vez de
  chutar (estado "Bahia", país "Chile") ou não entendeu (região "nordeste"). Elas entraram no banco.
- Limites conhecidos: estados, países e regiões ainda não viram opções de aeroporto; perguntas fora de viagem não são
  respondidas.

### Fase 4 concluída (05 e 06/11/2026)

- Motor de respostas `src/core/assistant/reply.ts`: para cada intenção roda o motor certo (busca, dia mais barato
  de uma janela, Férias flexíveis, "para onde ir" pelo Google Explore sem destino, parceiros por rota ou pelo destino,
  cálculo do milheiro) e monta frase, cartões, link para a tela completa e sugestões de seguimento.
- API `POST /api/assistente` (`{ text, previous, home }` ou `{ parsed }`): responde na hora com o que está no banco e
  devolve a coleta a fazer; a tela faz a coleta em segundo plano e pede a resposta de novo. Nada da conversa é
  guardado no servidor (fica só no navegador, na sessão).
- Componente `src/components/Assistant.tsx` na página inicial: barra "Para onde você quer ir?", exemplos clicáveis,
  conversa com "Entendi: …", cartões, botões de resposta rápida e de escolha em caso de ambiguidade, "Nova conversa".
  O formulário tradicional continua um clique abaixo.
- Verificado de ponta a ponta no navegador com dados reais: preço numa data (17 opções VIX → LIS em 10/12, a partir de
  R$ 2.263), "e voltando dia 20?", "e só voo direto?", mês mais barato para Madri em 2027 (R$ 5.185), "e em 1
  semana?", programas para Lisboa (Smiles, LATAM Pass, Azul, depois de buscar a malha do destino), milheiro (R$ 19,44)
  e "para onde ir em março" (Rio R$ 504, Salvador R$ 999, Buenos Aires R$ 2.489…).
- Correções no caminho: duração da ida (não a soma) na frase de ida e volta; parceiros caem para as companhias do
  destino quando não há voo direto; nomes de companhias europeias; o assistente vazava 28 px no celular (coluna do
  hero sem limite) e foi corrigido.
- Testes: 4 novos de respostas (70 no total).

### Fase 5 concluída (05/11/2026)

- Acessibilidade: o calendário de datas foca o dia escolhido ao abrir, anda com as setas (±1 dia, ±1 semana,
  Home/End, PageUp/PageDown para mês), não deixa ir antes do mínimo, troca de mês sozinho e devolve o foco ao botão
  Ida ou Volta ao fechar (Esc, escolha ou "Fechar"); só um dia entra na ordem do Tab. O aviso de parceiro prende o
  Tab dentro da janela e devolve o foco ao link. O mapa de calor tem um resumo por mês para leitor de tela ("Março:
  12 de 31 dias com preço; mais barato saindo Sáb, 6 mar, R$ …") e os botões "Consultar" dizem o mês. Conferido no
  navegador com teclado simulado.
- Desempenho: build de produção limpo; primeira carga de 116 kB (início), 126 kB (busca) e 120 kB (férias); só
  `/explorar` passa de 200 kB, por causa do globo. As APIs respondem em 30 a 70 ms com o banco local.
- Documentação: README, arquitetura (Férias flexíveis e assistente), decisões (uso pessoal local, 04/11; Férias e
  assistente, 05/11), situação atual e prompt de reconstrução atualizados.
