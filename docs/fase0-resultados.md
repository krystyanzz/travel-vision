# Fase 0: resultado do teste das fontes (05/11/2026)

Testes reais para decidir de onde vêm os dados das Férias flexíveis. Custo: 6 consultas da SerpAPI (plano grátis) e
cerca de 30 consultas grátis da Aviasales. Respostas brutas guardadas em `.data/fase0/` (fora do controle de versão).

## Google Travel Explore (SerpAPI)

Parâmetros confirmados na documentação: `travel_duration` = 1 (fim de semana), 2 (1 semana) ou 3 (2 semanas);
`month` = 1 a 12 ou 0 (próximos 6 meses). **Só cobre os próximos 6 meses** e **não tem opção de 3 semanas**.

| Teste | Resposta | Melhor janela | A partir de |
|---|---|---|---|
| VIX → MAD, 2 semanas, 6 meses | 1 janela + 3 voos | 12/11 → 25/11/2026 | R$ 5.010 |
| GRU → MAD, 2 semanas, 6 meses | 1 janela + 4 voos | 23/11 → 06/12/2026 | R$ 3.521 |
| VIX → SCL, 2 semanas, 6 meses | 1 janela + 3 voos | 24/04 → 07/05/2027 | R$ 1.944 |
| VIX → MAD, 1 semana, 6 meses | 1 janela + 3 voos | 23/11 → 30/11/2026 | R$ 5.191 |
| GRU → MAD, 2 semanas, **março** | 1 janela + 3 voos | 04/03 → 18/03/2027 | R$ 3.972 (Avianca, 1 escala) |
| VIX → **qualquer destino**, 2 semanas | **91 destinos**, cada um com as melhores datas | ex.: Lisboa 05/04 → 19/04/2027, R$ 4.144 | — |

Formato com destino definido: `start_date`, `end_date`, `flights[]` (cada um com aeroportos, `duration` em minutos,
`price`, `number_of_stops`, `airline`, `airline_code`, `cheapest_flight`) e `google_flights_link`. Não traz número
do voo nem horário (para isso, a busca normal na data).

**Conclusão:** funciona bem, inclusive saindo de Vitória. Uma consulta por mês dá a melhor janela real daquele mês.
A busca "qualquer destino" é muito boa e barata: uma consulta, 91 destinos.

## Aviasales (Travelpayouts), ida e volta de 14 a 21 dias

| Rota | Calendário ida e volta | Busca por duração | Meses com dado |
|---|---|---|---|
| VIX → MAD | 0 | 0 | nenhum |
| SAO → MAD | 45 (16 com 14 a 21 dias) | 78 | 11 meses, com 2 a 72 viagens cada; menor R$ 3.470 |
| VIX → SCL | 0 | 0 | nenhum |

A busca por duração devolveu o mesmo resultado para 2 e 3 semanas: o filtro de duração parece ser ignorado. O
Travel Vision filtra a duração por conta própria.

**Conclusão:** bom para cidades grandes (São Paulo) e meses distantes; **quase nada saindo de cidades menores**
(Vitória).

## Decisão para a Fase 1

| Parte do período | Fonte principal | Complemento |
|---|---|---|
| Próximos 6 meses | **Google Travel Explore**: 1 consulta por mês, com a duração mais próxima (fim de semana, 1 ou 2 semanas), e cache de 24 h | Aviasales e Google Flights nas datas exatas já guardadas no banco |
| Depois de 6 meses | Aviasales (calendário ida e volta + busca por duração), quando houver | Sem dado: "sem preço ainda"; depois de cerca de 11 meses: "ainda não à venda" |
| Duração de 3 semanas | O motor do Travel Vision, com os preços de ida e de volta do banco (bilhete único ou 2 bilhetes) | Google Travel Explore de 2 semanas como referência, com aviso de que a janela é de 14 dias |
| Confirmar a melhor janela | Google Flights na data exata ("Confirmar preço agora"), 2 consultas | — |

### O que muda no plano

1. **"Gráfico por mês" vira o centro da tela**, com a melhor janela real de cada mês (Google, nos próximos 6 meses). O
   mapa de calor dia a dia fica como detalhe, onde houver dado.
2. **Nova função quase de graça: "Para onde ir?"**. Com o destino em branco, uma consulta devolve dezenas de
   destinos com as melhores datas e preços. Entra no assistente ("para onde é mais barato ir em abril?") e pode ser
   uma aba "Qualquer lugar".
3. **Cota:** uma pesquisa de férias de 6 meses gasta até 6 consultas (menos com cache). O plano grátis (250 por mês,
   teto de 8 por dia no Travel Vision) dá para testar localmente. Com usuários reais, é preciso o plano Starter
   (US$ 25/mês, 1.000 consultas).
