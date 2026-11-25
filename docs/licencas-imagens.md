# Registro de imagens, modelos 3D e fontes

Toda mídia do projeto precisa de uma linha aqui antes de entrar no código (diretriz, seção 7).

| Item | Arquivo | Origem | Licença | Uso comercial | Observações |
|---|---|---|---|---|---|
| Logotipo Travel Vision | `src/components/Logo.tsx` | Criado no projeto | Próprio | Sim | SVG inline |
| Aeronave 3D | `src/components/three/aircraftScene.ts` | Modelada proceduralmente no código | Próprio | Sim | Genérica, sem pintura ou marca de companhia |
| Silhueta de aeronave (fallback) | `src/components/HeroAircraft.tsx` | Criada no projeto | Próprio | Sim | SVG inline |
| Animação de rota | `src/components/RouteLoader.tsx` | Criada no projeto | Próprio | Sim | SVG + CSS |
| Fonte Sora | via `next/font/google` | Google Fonts | SIL Open Font License 1.1 | Sim | Servida pelo próprio app |
| Fonte Inter | via `next/font/google` | Google Fonts | SIL Open Font License 1.1 | Sim | Servida pelo próprio app |
| Three.js | dependência npm | three.js | MIT | Sim | — |

## Ao adicionar fotos (cockpit, asas sobre nuvens, mapas)

1. Registrar aqui: autor, link da página da imagem, licença e data do download ou da compra.
2. Conferir que não há logotipo, pintura ou matrícula identificável de companhia real.
3. Exportar em AVIF e WebP com tamanhos responsivos (usar `next/image`).

## Mapa de rotas

| Item | Arquivo | Origem | Licença | Uso comercial | Observações |
|---|---|---|---|---|---|
| Contornos dos países | pacote `world-atlas` (countries-110m) | Natural Earth | Domínio público (pacote: ISC) | Sim | Desenhado no app com d3-geo, sem servidor de mapas |
| Base de aeroportos | `src/data/airports.json` | OurAirports | Domínio público | Sim | Gerada por `scripts/build-airports.mjs` |
| d3-geo, topojson-client | dependências npm | d3 / topojson | ISC | Sim | — |
| Limites e nomes dos estados do Brasil | `src/data/br-states.json` | IBGE: malhas territoriais (qualidade mínima) e localidades | Dados abertos do IBGE, uso livre com citação da fonte | Sim | Gerado por `scripts/build-br-states.mjs`; citar "Fonte: IBGE" junto ao mapa |
| Códigos ISO de países (numérico → alfa-2) | dependência npm `i18n-iso-countries` | i18n-iso-countries | MIT | Sim | Só a conversão de códigos; os nomes em português vêm do próprio navegador (Intl) |
