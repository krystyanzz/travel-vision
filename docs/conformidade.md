# Checklist de conformidade

Preenchido pelo revisor de conformidade antes de cada entrega (diretriz, seção 2).

## Entrega: robôs de coleta e revisão geral (2026-11-02)

| # | Regra | Situação | Evidência |
|---|---|---|---|
| 1 | Só fontes autorizadas para uso comercial | ⚠️ Ativas: PTAX (dados abertos, uso confirmado) e AirLabs (API oficial; uso comercial **a confirmar por escrito**). Travelpayouts pronta, aguardando token e leitura dos termos | `docs/robos.md`, `docs/fornecedores.md` |
| 2 | Não usar Seats.aero | ✅ Nenhuma referência no código | `src/core/robots/registry.ts` |
| 3 | Não usar dados com licença só pessoal | ✅ | — |
| 4 | Sem scraping proibido | ✅ Robôs só usam APIs; robô de navegador é bloqueado pelo motor sem permissão documentada nos termos | `src/core/robots/engine.ts` (`policyBlock`) |
| 5 | Sem contornar captcha ou limites | ✅ Teto diário de consultas da AirLabs gravado em disco, reserva da cota mensal, espera crescente após falhas, pausa entre consultas da Travelpayouts | `src/core/routes/airlabs.ts`, `src/core/robots/engine.ts` |
| 6 | Sem senhas de programas, bancos ou cartões | ✅ | `src/core/miles/wallet.ts` |
| 7 | Atribuição e redistribuição | ✅ Fonte e horário em todo preço e na malha | `src/app/robos/page.tsx`, `src/components/RobotFares.tsx` |
| 8 | LGPD | ⚠️ Política atualizada (robôs, redirecionamento); falta revisão jurídica | `src/app/privacidade/page.tsx` |
| — | Preço simulado nunca como real | ✅ Busca ao vivo rotulada "Simulação: não são preços reais"; classificação obrigatória em todo preço coletado | `src/app/busca/SearchClient.tsx`, `src/core/robots/types.ts` |
| — | Segredos | ✅ Chaves só no servidor (`.env.local`), fora do zip e do artefato; cabeçalhos de segurança no Next | `next.config.ts` |

## Entrega: Fase 1 · base inicial (2026-10-30)

| # | Regra | Situação | Evidência |
|---|---|---|---|
| 1 | Só fontes autorizadas para uso comercial | ✅ Nenhuma fonte externa ativa; só o provedor `demo` (dados sintéticos). Duffel com licença `a_confirmar` | `src/core/providers/registry.ts` |
| 2 | Não usar Seats.aero | ✅ Nenhuma referência no código | `docs/fornecedores.md` |
| 3 | Não usar dados com licença só pessoal | ✅ | — |
| 4 | Sem scraping proibido | ✅ Nenhum código de coleta | — |
| 5 | Sem contornar captcha ou limites | ✅ Cota bloqueia e devolve 429; sem novas tentativas automáticas | `src/core/providers/quota.ts` |
| 6 | Sem senhas de programas, bancos ou cartões | ✅ Carteira só aceita saldo, validade e custo | `src/core/miles/wallet.ts` |
| 7 | Atribuição e redistribuição | ✅ Campo `license.attribution` exibido junto aos resultados | `src/app/busca/SearchClient.tsx` |
| 8 | LGPD | ⚠️ Consentimento e exclusão da carteira prontos; política em rascunho, falta revisão jurídica | `src/app/privacidade/page.tsx` |
| — | Marcas e imagens | ✅ Sem logotipos ou pinturas de companhias; companhias fictícias no modo demonstração | `docs/licencas-imagens.md` |
| — | Segredos | ✅ `.env*` no `.gitignore`; só `.env.example` versionado | `.gitignore` |

## Regras para as próximas entregas

- Um adaptador só vai para produção com `license.commercialUse = "confirmado"` e ficha preenchida com fonte.
- Nenhum dado de demonstração sem o aviso visível.
- Toda nova coleta de dado pessoal entra na política de privacidade antes do deploy.
