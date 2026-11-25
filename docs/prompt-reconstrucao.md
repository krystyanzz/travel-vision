# Prompt para reconstruir o Travel Vision

Cole o texto abaixo numa sessão nova, numa pasta vazia. Ele já incorpora as decisões e as correções feitas até
05/11/2026 (busca com preços reais, Férias flexíveis e assistente próprio), para que a nova construção não repita os
mesmos furos.

---

Construa o **Travel Vision · Inteligência para viajar**: um buscador brasileiro de passagens em dinheiro e com milhas.
É **só um mecanismo de busca e rastreamento**: não vende nada e redireciona o usuário ao parceiro para comprar ou
emitir. Textos da interface em português do Brasil.

## Regras inegociáveis
1. Por enquanto o projeto roda **localmente, para uso pessoal**. Fontes por API de terceiros (Travelpayouts, SerpAPI,
   AirLabs) são aceitas; registrar a licença de cada uma (uso comercial, redistribuição, atribuição, link dos termos),
   porque um lançamento público exige rever as que não permitem uso comercial.
2. Seats.aero só com a chave do próprio usuário e só nesse uso local; nunca como dado redistribuído.
3. Não fazer scraping de companhias, programas ou concorrentes cujos termos proíbam. Não contornar captcha, login,
   bloqueios ou limites de requisição. Coleta por navegador (Playwright) só com permissão expressa nos termos, e o
   sistema deve bloquear isso automaticamente quando a permissão não estiver documentada.
4. **Nunca mostrar preço simulado, estimado ou inventado como real.** Todo preço tem classificação obrigatória:
   `confirmada` (preço e assento confirmados), `nao_confirmada` (preço encontrado, disponibilidade não garantida),
   `historico`, `estimativa`. Toda observação guarda preço ou milhas, taxas, moeda original, programa, companhia, fonte e
   data/hora da consulta. Fonte fora do ar não gera dado nenhum.
5. Não declarar fonte, programa ou companhia como "integrado" sem uma consulta real bem-sucedida registrada no banco.
6. Nunca pedir nem guardar senhas de programas de fidelidade, bancos ou cartões. LGPD: dados do usuário só com
   consentimento e com botão de exclusão.
7. Segredos só em variáveis de ambiente no servidor (`.env.local`, fora do controle de versão). Chave nunca vai ao
   navegador, a um zip ou a uma página estática.
8. Identidade própria: não copiar interface, marca, texto ou código de concorrentes; nenhum logotipo ou pintura real
   de companhia aérea.

## Pilha
Next.js 15 (App Router, TypeScript) com React 19; domínio em `src/core` sem dependência de React/Next (para virar
backend Node depois); Vitest; SQLite nativo do Node (`node:sqlite`, carregado com `process.getBuiltinModule`) para os
robôs; three.js para a aeronave 3D; d3-geo + world-atlas (Natural Earth, domínio público) + topojson-client para o
mapa; base de aeroportos do OurAirports (domínio público) gerada por script; tsx para o agendador.

## Identidade visual
Azul-marinho predominante (#07182d, #102d4c, #1769aa, #48a5e8, #e8f1f8), tema escuro padrão e claro opcional, tokens
CSS, contraste WCAG AA calculado e documentado, fontes Sora (títulos) e Inter (texto). Aeronave comercial genérica
modelada proceduralmente em three.js (fuselagem, asas com perfil aerodinâmico, winglets, motores, janelas, sem marca),
carregada sob demanda, parada com `prefers-reduced-motion`, com fallback em SVG. Responsivo a partir de 375 px.

## Telas
- `/`: **assistente de viagem** no topo (o usuário escreve "quanto fica pra Lisboa dia 10/12?", "mês mais barato pra
  Madri em 2027", "2 semanas em Paris no 1º semestre", "para onde é mais barato ir em março?", "quais programas me
  levam pra Lisboa?") e o formulário de busca logo abaixo. **Sem IA externa**: parser por regras em português
  (léxico de cidades, meses, números por extenso, estações, feriados), que separa intenção, campos, o que falta, o
  que é ambíguo e o que foi presumido, e segue a conversa só com ajustes curtos ("e em julho?"). A resposta vem do
  banco, com cartões de voo, link para a tela completa e sugestões; se faltar preço, o navegador pede a coleta e
  pergunta de novo. Conversa só no `sessionStorage`. Corpus de ≥ 150 frases nos testes, meta de 90% de acerto.
- `/ferias` (Férias flexíveis): período em meses (até 12) + duração em dias (1 a 45, com atalhos de semanas) →
  as 5 janelas mais baratas (pelo menos 3 dias entre elas), gráfico de barras por mês (o mais barato destacado,
  meses sem preço com "Consultar", meses ainda não à venda marcados) e mapa de calor por dia de saída. Combina
  bilhetes de ida e volta com dois bilhetes só de ida (com aviso). Confirmação no Google só no clique.
- Menu: Buscar voos, Férias flexíveis, Explorar destinos, Minha carteira, Simulador de milhas, Radar de promoções. Os robôs **não**
  aparecem para o usuário: rodam sozinhos dentro do servidor (instrumentation do Next) e alimentam o banco; a tela
  técnica fica em `/admin/robos`, protegida por senha (`ADMIN_PASSWORD`; sem senha, só em desenvolvimento local).
- `/busca` é o coração do produto. Lê o banco e consolida dinheiro e milhas (vários programas) numa lista só, ida e
  volta ou só ida, nacional ou internacional. Cada modalidade (dinheiro e cada programa) mostra seu status: com
  resultados, sem resultados para a busca, sem fonte conectada ou fonte indisponível. **Sem simulação na busca**: sem
  fonte, a tela diz que não há resultado real e explica por quê. Cada resultado: companhia, programa, milhas, valor
  em dinheiro (com conversão PTAX quando a moeda é outra), taxas, horário de partida local, duração, escalas, cabine,
  fonte, última atualização, disponibilidade e link para consultar ou emitir no fornecedor (não mostrar horário de
  chegada calculado, porque o fuso do destino não vem da fonte). Ordenar por menor preço em dinheiro, menor
  quantidade de milhas e melhor custo-benefício (milhas × custo do milheiro informado + taxas). Escolha de datas **por clique**
  (dois meses, um no celular; vazio mostra só "Ida" e "Volta"), com o menor preço real de cada dia, pedido às fontes
  na primeira busca da rota; setas do teclado navegam entre os dias e Esc devolve o foco ao botão. Origem sugerida
  pela localização (arredondada a ~10 km, não guardada). Ofertas iguais de sites diferentes viram uma viagem com
  vários vendedores. Antes do primeiro clique num parceiro, aviso "o Travel Vision é gratuito para você". Datas
  próximas, "Atualizar agora" quando uma fonte permite consulta pontual (limitado por rota).
  Bloco "quem pode levar você": companhias que voam direto na rota (malha) cruzadas com as parcerias de resgate.
- Campos de origem e destino próprios (combobox ARIA, não `<datalist>`): mostram "Cidade (CÓD)"; sugerem
  cidades com todos os aeroportos (SAO, RIO, BHZ, LON, PAR, NYC…) seguidas dos aeroportos delas e os ~4 mil aeroportos
  da base, com país em português e trecho digitado destacado; ignoram acentos; priorizam aeroportos brasileiros e
  começo de palavra ("gu" → Guarulhos; "vit" → Vitória antes do VIT espanhol); setas, Enter e Esc; Enter durante a
  busca espera as sugestões em vez de enviar o formulário; botão para inverter origem e destino; atalho "Explorar
  destinos a partir de X" que abre o mapa. Depois: datas, adultos, cabine, filtros (escalas, bagagem, companhia,
  horário), ordenação, calendário do mês com preço baixo/normal/alto por quartis, horário de chegada só quando a
  fonte informa.
- Mapa de parceiros (em `/explorar` e na busca): por programa (em quais companhias emitir) e por destino (quais
  programas chegam lá). Parceria de resgate ≠ aliança. Cada parceria com evidência (fonte oficial, secundária ou
  conflitante, com link e data); conflitantes ficam à parte; programas cuja lista não foi conferida não aparecem nas
  respostas. Consultar a malha de um aeroporto novo só com clique explícito (gasta cota).
- `/explorar` (Explorar destinos): globo ortográfico e mapa plano (d3-geo, SVG) com arcos de grande círculo dos voos diretos de um aeroporto
  (espessura pela frequência), destinos com 1 conexão via os 3 maiores hubs, filtros nacional/internacional e por
  companhia, zoom que enquadra as rotas, giro animado até a origem, cartão do destino com voos, dias e horários, botões
  "Ver preços" e "Explorar a partir daqui".
- `/admin/robos` (restrito): consumo de cotas, estado de cada robô (em execução, operando, coleta parcial, fonte indisponível, não configurado,
  bloqueado), prova da última consulta real, preços coletados com indicadores (disponibilidade confirmada ou não,
  atualizado recentemente, oportunidade), câmbio, malha monitorada, programas de fidelidade e o que falta para cada um,
  alertas, erros das fontes e registro de execuções. Atualiza a cada 30 s.
- `/carteira`: saldos, validade e custo do milheiro informados pelo usuário, guardados no navegador só com
  consentimento; quanto ele reúne em cada companhia somando transferências e bônus.
- `/simulador`: transferência com bônus, compra de pontos e milhas x dinheiro (custo do milheiro). Paridades marcadas
  como "a conferir" até a curadoria validar.
- `/radar`: promoções de transferência e compra de pontos, com link da fonte oficial; exemplos fictícios rotulados.
- `/privacidade`: dados tratados, robôs sem dados pessoais, redirecionamento a parceiros, o que nunca pedimos,
  direitos.

## Robôs de coleta (`src/core/robots`)
- Contrato `Robot`: id, fonte (com método de acesso `api_oficial` | `api_afiliado` | `api_terceiros` | `dados_abertos` | `navegador`,
  termos, evidência de permissão, uso comercial, atribuição), frequência padrão, `notReady()` (ex.: falta chave) e
  `run()` que devolve observações normalizadas de tarifas, malha ou câmbio, número de consultas, flag de parcial e erros
  por item.
- Motor: agenda (frequência por robô via `ROBOT_<ID>_EVERY_MIN`), trava contra execução dupla, bloqueio por política,
  espera crescente após falhas (até 8x), deduplicação por hash, histórico de preço e disponibilidade, datas passadas
  viram histórico, eventos (queda de preço de 10% ou mais = oportunidade, mais disponibilidade, rota nova ou extinta;
  coleta parcial não remove rota), registro de erros.
- Banco SQLite em `.data/`: `robot_state`, `robot_runs`, `source_errors`, `fares`, `fare_history`, `schedules`,
  `fx_rates` (chave inclui o boletim; preferir o de fechamento), `events`.
- Comparação: dinheiro x milhas na mesma rota e data, valor do milheiro, custo por ponto, economia com o custo do
  milheiro do usuário, veredito; ignora `historico` e `estimativa`; converte moeda só com cotação PTAX registrada;
  avisa sobre fontes diferentes, consultas com mais de 24 h de diferença e disponibilidade não confirmada.
- Agendador fora do Next: `npm run robots` (contínuo), `--once`, `--run=ID`, `--status`.
- Robôs iniciais: preços em dinheiro pela Aviasales Data API (Travelpayouts, `prices_for_dates`, sempre
  `nao_confirmada` porque são buscas das últimas 48 h, link de redirecionamento com marcador de afiliado); malha pela
  AirLabs Routes API; câmbio PTAX do Banco Central (dados abertos). Programas previstos, sem fonte até haver parceria ou
  fornecedor licenciado: Smiles, LATAM Pass, Azul Fidelidade, TAP Miles&Go, Iberia Club, Aeroplan, MileagePlus,
  AAdvantage, LifeMiles, Flying Blue.
- Configuração de monitoramento em `config/monitor.json` (aeroportos, rotas, meses à frente, moedas), lida a cada
  execução.

## Malha (AirLabs)
Cache em disco de 7 dias (rotas) e 90 dias (nomes de companhias). O plano gratuito devolve 50 linhas sem paginação:
consultar por companhia (`airline_iata`) e marcar a coleta como parcial. Proteger a cota: **teto diário por consulta
real** (não por pedido), gravado em disco e compartilhado entre site e robôs, e reserva da cota mensal informada na
resposta da AirLabs; se acabar no meio, guardar o que veio como parcial. Limite por minuto separado, com mensagem
própria.

## Qualidade e entrega
- Testes do domínio: preço por quartis, simulador, carteira, agregação de rotas, motor dos robôs (deduplicação, queda
  de preço com alerta, falha sem dados inventados, espera crescente, bloqueio de navegador, malha parcial, histórico),
  parsers das fontes, comparação, câmbio, orçamento da AirLabs (com `fetch` simulado), ordem das sugestões de lugares.
- Cabeçalhos de segurança no Next. Typecheck e build de produção sem erros.
- Versão estática de demonstração para publicar como página única (esbuild, com troca de `next/link` e
  `next/navigation`, rotas de API atendidas no navegador pela simulação e pela base de aeroportos, e páginas explicando
  que Mapa e Robôs precisam do servidor).
- Documentos em `docs/`: decisões e pendências, fichas de fornecedores com fonte, arquitetura, robôs, conformidade
  (checklist por entrega), design system com contraste, licenças de imagens e dados.
- Antes de declarar pronto: rodar os robôs de verdade e mostrar as evidências (execução, consultas, registros), abrir
  cada tela no navegador em desktop e celular, e listar o que depende de acesso ou autorização externa.
