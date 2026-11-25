# Travel Vision · Inteligência para viajar

Plataforma de busca e inteligência de passagens com milhas e em dinheiro, para o viajante brasileiro.

## Rodar

```bash
npm install
cp .env.example .env.local   # chaves: TRAVELPAYOUTS_TOKEN, SERPAPI_API_KEY, AIRLABS_API_KEY (sem elas, a busca diz que não há fonte)
npm run dev                   # http://localhost:3000
npm test                      # testes do núcleo
npm run robots -- --status    # estado dos robôs (a coleta já roda sozinha dentro do servidor)
npm run build
```

## O que já existe

| Área | Rota | Situação |
|---|---|---|
| Página inicial com **assistente de viagem** (perguntas em português, sem IA externa) e busca rápida | `/` | Pronto |
| Busca de voos: só ida ou ida e volta, calendário por clique com preço de cada dia, origem pela sua localização, ordenação melhor / mais barato / mais rápido / milhas, aviso de parceiro gratuito | `/busca` | Pronta, com preços reais (Travelpayouts e Google Flights via SerpAPI) |
| **Férias flexíveis:** período em meses + duração em dias → as datas mais baratas, gráfico por mês e mapa de calor por dia | `/ferias` | Pronto |
| Explorar destinos: mapa de rotas + mapa de parceiros de resgate | `/explorar` | Pronto com AirLabs e parcerias com fonte |
| Carteira de pontos | `/carteira` | Pronto (dados só no navegador, com consentimento) |
| Simulador de transferência, compra e milhas x dinheiro | `/simulador` | Pronto |
| Radar de promoções | `/radar` | Interface pronta; promoções de exemplo |
| Privacidade (LGPD) | `/privacidade` | Rascunho |
| Painel técnico (restrito): robôs, fontes, cotas, erros | `/admin/robos` | Senha em `ADMIN_PASSWORD`; ver [robôs](docs/robos.md) |

Preços em milhas ainda não têm fonte: a busca mostra os programas que levam ao destino, sem inventar valores.

## Estrutura

```
src/core/            domínio, sem React/Next (vai para o backend)
  providers/         adaptadores plugáveis, cota e cache, registro
  robots/            robôs de coleta: motor, agendador, banco SQLite, comparação
  search/            busca de voos: viagens, junção de ofertas iguais, preço por dia
  flex/              férias flexíveis: melhores janelas de ida e volta
  assistant/         assistente: entende a frase (regras, sem IA externa) e monta a resposta
  partners/          parcerias de resgate com fonte
  routes/            malha aérea (AirLabs)
  miles/             programas, simulador, carteira
  pricing.ts         preço baixo/normal/alto
  promotions.ts      radar
src/app/             telas e rotas de API (Next.js)
src/components/      componentes de interface e 3D
docs/                decisões, fornecedores, conformidade, design system, licenças
```

## Documentos do projeto

- [Situação atual e o que falta](docs/status-e-pendencias.md)
- [Arquitetura e como funciona](docs/arquitetura.md)
- [Prompt para reconstruir o projeto](docs/prompt-reconstrucao.md)
- [Decisões e pendências](docs/decisoes.md)
- [Arquitetura dos robôs de coleta](docs/robos.md)
- [Fichas de fornecedores](docs/fornecedores.md)
- [Checklist de conformidade](docs/conformidade.md)
- [Design system](docs/design-system.md)
- [Licenças de imagens e 3D](docs/licencas-imagens.md)

## Fontes de dados

Preços reais entram por robôs (`src/core/robots`, ver [docs/robos.md](docs/robos.md)), cada um com fonte e horário:

| Fonte | O que traz | Limite |
|---|---|---|
| Travelpayouts (Aviasales) | Preços em cache por data e calendário do ano | Dados esparsos para cidades pequenas |
| SerpAPI · Google Flights | Voos de um dia, com horário, escalas e companhia | Teto diário `SERPAPI_DAILY_CALLS` (padrão 8), cache de 12 h |
| SerpAPI · Google Travel Explore | Melhor janela por mês e duração (Férias flexíveis) | Só os próximos 6 meses, até 2 semanas |
| AirLabs | Malha (quem voa a rota) | Teto diário e reserva da cota mensal |
| Banco Central (PTAX) | Câmbio | — |

Nada é coletado de site cujos termos proíbam, e nenhum limite ou proteção anti-robô é contornado.
