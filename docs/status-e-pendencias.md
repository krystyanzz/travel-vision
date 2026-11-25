# Travel Vision: situação atual e o que falta

Atualizado em 05/11/2026 (Travelpayouts e SerpAPI conectadas; Férias flexíveis e assistente prontos), a partir do
código e do banco local.

## 1. O projeto em poucas linhas

O Travel Vision é um **buscador de passagens em dinheiro e com milhas** para quem viaja a partir do Brasil. O usuário
informa origem, destino e datas e vê, numa lista só, as passagens pagas e as emissões com milhas encontradas,
com fonte e horário de cada preço, e é redirecionado ao parceiro para comprar ou emitir. Ele não vende passagens.

Por trás da busca, **robôs** coletam dados sozinhos dentro do servidor e alimentam um banco local. A busca só lê esse
banco: se nenhuma fonte de preço está conectada, a tela diz que não há resultado real, em vez de inventar.

Telas: página inicial com o assistente de viagem, Buscar voos, Férias flexíveis, Explorar destinos (mapa de rotas e
mapa de parceiros), Minha carteira, Simulador de milhas, Radar de promoções e o painel técnico restrito
(`/admin/robos`). Hoje roda localmente, para uso pessoal (ver `docs/decisoes.md`, 04/11).

## 2. O que funciona hoje

| Parte | Estado | Dados reais no banco |
|---|---|---|
| Busca consolidada (dinheiro + milhas, ida e volta, filtros, 3 ordenações, calendário) | **Funcionando com preços reais em dinheiro** (Travelpayouts, desde 03/11) | 94 preços nas rotas monitoradas; rotas novas são buscadas na hora quando alguém pesquisa. Milhas: ainda sem fonte |
| Férias flexíveis (período + duração → datas mais baratas) | Funcionando | Calendário do ano da Travelpayouts + Google Travel Explore (6 meses). Ex.: VIX → MAD em março, melhor janela R$ 5.185 |
| Assistente de viagem (sem IA externa) | Funcionando | Responde com o banco; 160 frases de teste, 100% de acerto |
| Mapa de rotas (Explorar destinos) | Funcionando | 394 voos regulares de CNF, FLN e VIX; GRU, GIG e CGH em cache (AirLabs) |
| Mapa de parceiros de resgate | Funcionando | Smiles (20 parceiras, fonte oficial), LATAM Pass (14), Azul (7) |
| Câmbio oficial (PTAX) | Funcionando | Dólar e euro do Banco Central. A coleta das 9h de 03/11 falhou por erro de rede; o robô tenta de novo sozinho |
| Robôs em segundo plano, histórico, alertas, painel técnico | Funcionando | — |
| Carteira, simulador, radar | Funcionando | Radar ainda com promoções de exemplo |

## 3. O que está travando: fontes de preço

Preços em dinheiro: **Travelpayouts conectada em 03/11/2026** (primeira coleta real: 94 preços em 15 consultas, feita
sozinha pelo servidor). Milhas: nenhuma fonte ainda.

| Fonte | O que traria | Situação no código | O que falta | Quem resolve | Custo |
|---|---|---|---|---|---|
| **Travelpayouts** (Aviasales) | Preços em dinheiro reais, das buscas dos últimos 2 dias; disponibilidade não confirmada | **Conectada e validada** com a resposta real; busca automática para rotas novas | Pôr `TRAVELPAYOUTS_MARKER` no `.env.local` (sem ele os links funcionam, mas não geram comissão). Dados esparsos: nem todo dia tem preço | Você (marcador) | Grátis; ganha comissão por venda |
| **Seats.aero** | Resgates com milhas reais: Smiles, Azul e cerca de 25 programas internacionais. Não cobre LATAM Pass | **Robô não escrito** | Gerar a chave da API no painel do plano Pro; eu escrevo e testo o robô | Você (chave) e eu (robô) | Plano Pro (assinatura mensal). **Só uso pessoal**: vale para a versão local; um site público exige acordo comercial por escrito |
| **SerpAPI** (dados do Google Flights) | Preços em dinheiro de várias companhias, por data exata, com horário de chegada | **Conectada e validada em 04/11/2026** (VIX → LIS em 10/12: 10 voos reais). Só consulta quando alguém busca; cache de 12 h; teto de 8 consultas/dia | Ler os termos da SerpAPI antes de um site público. Links levam ao Google Flights (sem comissão) | Você (termos) | Plano grátis: 250 consultas/mês |
| **Ignav** | Preços em dinheiro (alternativa) | **Robô não escrito** | Criar conta, gerar chave; eu escrevo o robô | Você e eu | 1.000 consultas grátis por mês, segundo o Travel Hacking Toolkit (confirmar no site) |
| **AirLabs** | Rotas e horários (sem preço) | Funcionando | Plano pago com paginação antes de lançar; confirmação por escrito dos termos comerciais | Você | **A chave grátis vence em 30/11/2026** |

**Ordem sugerida:** Travelpayouts (já em andamento) → Seats.aero (destrava as milhas) → SerpAPI ou Ignav (segunda
fonte em dinheiro, com preço por data exata).

## 4. O que falta para ser um "Seats.aero" sem usar a API do Seats.aero

### Como o Seats.aero consegue os dados

O Seats.aero **não recebe** os dados dos programas por parceria: ele faz consultas automáticas em grande volume nos
sites dos programas de fidelidade, guarda tudo num banco e mostra o resultado já pronto. É o que o próprio mercado
descreve, e é por isso que a Air Canada o processa nos Estados Unidos. A Singapore Airlines também passou a restringir
buscas automáticas no próprio site em 2026.

Ou seja: ter o próprio "Seats.aero" significa **ter a própria fonte de disponibilidade de resgates**. Essa é a parte
difícil; o resto o Travel Vision já tem ou está perto de ter.

### O que o Travel Vision já tem e o Seats.aero também tem

- Banco com histórico, deduplicação e detecção de mudança (queda de preço, mais assentos).
- Robôs agendados, com controle de cota e espera após falhas.
- Busca consolidada por rota e data, com filtros e calendário.
- Mapa de parceiros de resgate por programa e por destino.
- Classificação de disponibilidade (confirmada, sem confirmação, histórico).

### O que falta no produto (independente da fonte)

| Funcionalidade do Seats.aero | Situação no Travel Vision |
|---|---|
| Calendário de disponibilidade por programa e cabine (mês inteiro, por classe Y/W/J/F) | Calendário só de preço em dinheiro; falta versão por milhas e cabine |
| Busca por região ("Brasil → Europa", "qualquer destino") | Falta |
| Alertas por e-mail ou notificação quando abre assento | Os eventos já são detectados; falta conta de usuário e envio (com LGPD: consentimento e exclusão) |
| Quantidade de assentos e cabines mistas | Campos existem no banco; nenhuma fonte preenche ainda |
| Cobertura ampla e contínua (milhões de pares rota/data atualizados sozinhos) | Hoje são 5 rotas monitoradas em `config/monitor.json` |
| Banco preparado para volume (PostgreSQL) e servidor sempre ligado | Hoje é SQLite local |

### Os caminhos para ter a própria fonte de milhas

| Caminho | Como funciona | Prós | Contras |
|---|---|---|---|
| **A. Parceria com os programas** (Smiles, LATAM Pass, Azul) | O programa fornece a disponibilidade por contrato, em troca de tráfego e emissões | Dados oficiais, sem risco jurídico, pode incluir a LATAM Pass | Exige empresa, proposta comercial e tempo de negociação |
| **B. Fornecedor licenciado** (ex.: API empresarial da AwardTool) | Contrato de dados com quem já coleta | Rápido de integrar | Custo; é preciso confirmar como o fornecedor obtém os dados (se ele coleta sem autorização, o risco continua) |
| **C. Coleta própria nos sites dos programas** (o modelo do Seats.aero) | Robôs consultam os sites dos programas em grande volume | Cobertura e controle totais | Os termos dos programas costumam proibir; risco de processo (caso Air Canada); bloqueios técnicos crescentes; infraestrutura cara (servidores, filas, manutenção a cada mudança de site). **Precisa de parecer jurídico antes de qualquer linha de código** |
| **D. Dados enviados pelos próprios usuários** | O usuário compartilha, com consentimento, o resultado das buscas que ele mesmo faz no site do programa (por exemplo, por uma extensão de navegador) | Base cresce com o uso | Cobertura irregular; ainda depende dos termos de cada programa; exige cuidado com LGPD |

**Recomendação:** para a versão local, usar a API do Seats.aero com o plano Pro (uso pessoal) e as APIs de preço em
dinheiro da seção 3. Para lançar como produto, buscar os caminhos **A** e **B** em paralelo, com o caminho **C** só
depois de ouvir um advogado.

## 5. Próximos passos

1. ~~Token da Travelpayouts~~ feito em 03/11. Falta o marcador (`TRAVELPAYOUTS_MARKER`) para os links gerarem comissão.
2. Você: chave da API do Seats.aero no `.env.local`. Eu: escrever e testar o robô de milhas.
3. ~~SerpAPI~~ conectada em 04/11 (segunda fonte de preço em dinheiro, por data exata).
4. ~~Busca dispara a coleta sozinha~~ feito em 03/11 (rota sem preço no banco é consultada na hora, uma vez).
5. Você: renovar ou trocar o plano da AirLabs antes de 30/11/2026.
6. Se a SerpAPI for muito usada: subir `SERPAPI_DAILY_CALLS` (padrão 8 por dia; o plano grátis tem 250 por mês).

## Fontes

- [Termos do Seats.aero](https://seats.aero/terms) · [O que é o Seats.aero](https://docs.seats.aero/article/46-what-is-seats-aero)
- [Air Canada x Seats.aero (View from the Wing)](https://viewfromthewing.com/air-canada-says-award-scraping-is-computer-fraud-seats-aero-says-thats-anticompetitive/)
- [Restrições da Singapore Airlines (MileLion)](https://milelion.com/2026/07/24/sia-new-search-restrictions-to-combat-automated-and-repetitive-search-activity/)
- [Companhias encerrando buscas automáticas (One Mile at a Time)](https://onemileatatime.com/news/airlines-shut-down-websites-scraping-awards/)
- [AwardTool Enterprise API](https://www.awardtool.com/enterprise-api)
- [Aviasales Data API (Travelpayouts)](https://support.travelpayouts.com/hc/en-us/articles/203956163)
- [README do Travel Hacking Toolkit](https://cdn.jsdelivr.net/gh/borski/travel-hacking-toolkit@main/README.md) (fonte da cota grátis da Ignav)

## 6. Buscar em "500 sites", como o Skyscanner

O Skyscanner não visita 500 sites a cada busca: as companhias e agências **enviam** preços e disponibilidade para
ele por contrato (feeds e APIs de parceiros), e ele ganha quando o viajante clica ou compra no parceiro. O viajante
não paga nada. O Travel Vision já segue o mesmo modelo de receita (link de afiliado, aviso "gratuito para você" na
primeira ida ao parceiro). O que falta é a cobertura de dados, e ela vem de contratos:

| Caminho | O que dá | O que exige |
|---|---|---|
| **Aviasales / Travelpayouts, busca ao vivo** | Consulta em tempo real às agências e companhias que o próprio Aviasales cobre (centenas) | Aprovação da Travelpayouts; costuma exigir volume de visitas (fonte secundária fala em cerca de 50 mil usuários/mês) |
| **Skyscanner Partners** | A cobertura do Skyscanner, via API | Aprovação comercial, voltada a sites já com tráfego |
| **SerpAPI (Google Flights)** | Preços do Google Flights, que já agrega centenas de vendedores | Chave paga; confirmar se os termos permitem exibir no site |
| **Ignav, Duffel, GDS** | Preços ao vivo de companhias | Chave ou contrato; Duffel e GDS são APIs de reserva |
| **Acordos diretos** com companhias e agências brasileiras | Feeds próprios (LATAM, GOL, Azul, agências) | Empresa constituída e negociação comercial |

Ordem sugerida: SerpAPI ou Ignav agora (local), Travelpayouts ao vivo e Skyscanner Partners quando o site tiver
visitas, acordos diretos depois.
