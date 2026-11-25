# Design system

Fonte da verdade: `src/app/globals.css` (tokens) e `src/app/pages.css` (padrões de tela).

## Cores

| Token | Escuro (padrão) | Claro | Uso |
|---|---|---|---|
| `--bg` | `#07182D` azul-marinho | `#E8F1F8` branco gelo | Fundo |
| `--surface-strong` | `#102D4C` azul profundo | `#FFFFFF` | Cartões sólidos |
| `--accent` | `#48A5E8` azul claro | `#1769AA` azul tecnológico | Ações, destaques |
| `--text` | `#E8F1F8` | `#07182D` | Texto |
| `--text-muted` | `#9FB6CC` | `#3D5670` | Texto secundário |
| `--success` | `#3CCF95` | `#127A52` | Preço baixo, economia |
| `--warning` | `#F2B544` | `#8A5A00` | Avisos, vencimentos |
| `--danger` | `#FF7B7B` | `#B42318` | Preço alto, erros |

Contraste calculado (WCAG AA exige ≥ 4,5:1 para texto normal):

| Par | Escuro | Claro |
|---|---|---|
| `--accent` sobre `--bg` | 6,64:1 | 5,05:1 |
| `--text-muted` sobre `--bg` | 8,52:1 | 6,65:1 |
| `--success` sobre `--bg` | 8,96:1 | 4,67:1 |
| `--warning` sobre `--bg` | 9,74:1 | 5,18:1 |
| `--danger` sobre `--bg` | 7,11:1 | 5,75:1 |
| `--on-accent` sobre `--accent` (botão) | 6,64:1 | — |

O tema segue a preferência do sistema e pode ser trocado no cabeçalho (a escolha fica salva no navegador).

## Tipografia

- Títulos: **Sora** 600, `letter-spacing: -0.02em`.
- Texto: **Inter**.
- Rótulos técnicos (eyebrow): fonte monoespaçada, caixa alta, espaçamento largo, como no painel de um cockpit.
- Números: `font-variant-numeric: tabular-nums` sempre que houver preço ou milhas.

## Espaçamento e forma

Escala de 4 px (`--space-1` a `--space-9`). Raios: 8 px (campos), 14 px (avisos), 22 px (cartões).
Botões com altura mínima de 44 px (área de toque).

## Componentes

`btn` (primary, ghost, sm) · `card` · `field` + `input`/`select` · `badge` (success, warning, danger) ·
`notice` (warning, info) · `stat` · `table` · `PriceCalendar` · `RouteLoader` · `HeroAircraft`.

## Movimento

- `prefers-reduced-motion`: animações CSS desligadas e o 3D renderiza um quadro fixo.
- 3D só depois do evento `load`, em ociosidade, e só com WebGL, ≥ 4 núcleos, ≥ 4 GB e sem economia de dados.
- A animação de busca é SVG + CSS (sem 3D).
