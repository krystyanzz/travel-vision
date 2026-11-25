// Banco de frases de teste do assistente. Data de referência: quinta, 05/11/2026; origem do usuário: VIX.
// Cada item: [frase, esperado, frase anterior da conversa (opcional)].
// Chaves do esperado: i intenção · o origem · d destino · ida · volta · jan janela "de..até" · per período
// "AAAA-MM..AAAA-MM" · dur "min-max" · dir · teto · tipo · prog · falta (1º item) · amb · seg (é seguimento).

export interface Expect {
  i?: string | null;
  o?: string;
  d?: string | null;
  ida?: string | null;
  volta?: string | null;
  jan?: string;
  per?: string;
  dur?: string;
  dir?: boolean;
  teto?: number;
  tipo?: string;
  prog?: string;
  falta?: string;
  amb?: string;
  seg?: boolean;
}

export const CORPUS: [string, Expect, string?][] = [
  // ---- preço numa data (só ida) ----
  ["quanto fica Vitória pra Lisboa dia 10 de dezembro?", { i: "buscar", o: "VIX", d: "LIS", ida: "2026-12-10", tipo: "ida" }],
  ["VIX pra Lisboa dia 10/12", { i: "buscar", o: "VIX", d: "LIS", ida: "2026-12-10" }],
  ["vix lisboa 10/12", { i: "buscar", o: "VIX", d: "LIS", ida: "2026-12-10" }],
  ["quanto custa uma passagem para Madri no dia 15 de janeiro", { i: "buscar", d: "MAD", ida: "2027-01-15" }],
  ["preco de voo pra salvador dia 20/11", { i: "buscar", d: "SSA", ida: "2026-11-20" }],
  ["voo para recife amanha", { i: "buscar", d: "REC", ida: "2026-11-06" }],
  ["passagem pra fortaleza hoje", { i: "buscar", d: "FOR", ida: "2026-11-05" }],
  ["quanto ta pra floripa depois de amanha", { i: "buscar", d: "FLN", ida: "2026-11-07" }],
  ["de GRU para MIA em 3 de fevereiro", { i: "buscar", o: "GRU", d: "MIA", ida: "2027-02-03" }],
  ["saindo de sao paulo para buenos aires dia 18/12", { i: "buscar", o: "SAO", d: "BUE", ida: "2026-12-18" }],
  ["partindo do rio pra santiago dia 2 de março", { i: "buscar", o: "RIO", d: "SCL", ida: "2027-03-02" }],
  ["BH para Porto Seguro 27/12", { i: "buscar", o: "BHZ", d: "BPS", ida: "2026-12-27" }],
  ["brasilia manaus 05/01/2027", { i: "buscar", o: "BSB", d: "MAO", ida: "2027-01-05" }],
  ["quanto sai de curitiba pra porto alegre na sexta", { i: "buscar", o: "CWB", d: "POA", ida: "2026-11-06" }],
  ["voo pra natal sabado", { i: "buscar", d: "NAT", ida: "2026-11-07" }],
  ["passagem pra Paris dia 10", { i: "buscar", d: "PAR", ida: "2026-11-10" }],
  ["pra Londres dia 3", { i: "buscar", d: "LON", ida: "2026-12-03" }],
  ["voos para nova york 12 de abril de 2027", { i: "buscar", d: "NYC", ida: "2027-04-12" }],
  ["sampa x floripa amanhã", { i: "buscar", o: "SAO", d: "FLN", ida: "2026-11-06" }],
  ["preço pra orlando 20/7", { i: "buscar", d: "MCO", ida: "2027-07-20" }],
  ["quanto é pra cancun no dia 8 de setembro", { i: "buscar", d: "CUN", ida: "2027-09-08" }],
  ["de confins pra galeao dia 30/11", { i: "buscar", o: "CNF", d: "GIG", ida: "2026-11-30" }],
  ["passagem barata pra maceio dia 22 de dezembro", { i: "buscar", d: "MCZ", ida: "2026-12-22" }],
  ["voo de vitoria para brasilia em 14/11", { i: "buscar", o: "VIX", d: "BSB", ida: "2026-11-14" }],
  ["joao pessoa dia 15/12", { i: "buscar", d: "JPA", ida: "2026-12-15" }],
  ["quanto fica pra roma no domingo", { i: "buscar", d: "ROM", ida: "2026-11-08" }],
  ["passagem para Dubai 1/2/27", { i: "buscar", d: "DXB", ida: "2027-02-01" }],
  ["quero ir pra lima dia 9 de janeiro", { i: "buscar", d: "LIM", ida: "2027-01-09" }],
  ["valor da passagem pra Toronto dia 25/12", { i: "buscar", d: "YYZ", ida: "2026-12-25" }],
  ["voo pro rio amanha cedo", { i: "buscar", d: "RIO", ida: "2026-11-06" }],

  // ---- ida e volta com datas ----
  ["ida e volta pra Santiago de 1 a 4 de dezembro", { i: "buscar", d: "SCL", ida: "2026-12-01", volta: "2026-12-04", tipo: "ida_e_volta" }],
  ["lisboa de 10 a 25 de janeiro", { i: "buscar", d: "LIS", ida: "2027-01-10", volta: "2027-01-25" }],
  ["madri 10/03 a 24/03", { i: "buscar", d: "MAD", ida: "2027-03-10", volta: "2027-03-24" }],
  ["porto alegre para porto dia 5/3 voltando dia 20/3", { i: "buscar", o: "POA", d: "OPO", ida: "2027-03-05", volta: "2027-03-20" }],
  ["ida dia 10/12 volta dia 20/12 pra salvador", { i: "buscar", d: "SSA", ida: "2026-12-10", volta: "2026-12-20" }],
  ["recife indo 2/1 voltando 9/1", { i: "buscar", d: "REC", ida: "2027-01-02", volta: "2027-01-09" }],
  ["pra paris do dia 3 ao dia 18 de maio", { i: "buscar", d: "PAR", ida: "2027-05-03", volta: "2027-05-18" }],
  ["buenos aires entre os dias 12 e 16 de outubro", { i: "buscar", d: "BUE", ida: "2027-10-12", volta: "2027-10-16" }],
  ["de sp pra miami 28/12 a 6/1", { i: "buscar", o: "SAO", d: "MIA", ida: "2026-12-28", volta: "2027-01-06" }],
  ["orlando 1 a 15 de julho ida e volta", { i: "buscar", d: "MCO", ida: "2027-07-01", volta: "2027-07-15", tipo: "ida_e_volta" }],
  ["voo pra floripa sexta voltando domingo", { i: "buscar", d: "FLN", ida: "2026-11-06", volta: "2026-11-08" }],
  ["fortaleza 20 de dezembro volta 3 de janeiro", { i: "buscar", d: "FOR", ida: "2026-12-20", volta: "2027-01-03" }],
  ["nova york de 5 a 12/4", { i: "buscar", d: "NYC", ida: "2027-04-05", volta: "2027-04-12" }],
  ["londres 10/6 até 24/6", { i: "buscar", d: "LON", ida: "2027-06-10", volta: "2027-06-24" }],
  ["cancun ida 15/03/2027 volta 22/03/2027", { i: "buscar", d: "CUN", ida: "2027-03-15", volta: "2027-03-22" }],
  ["bariloche de 1 a 8 de agosto", { i: "buscar", d: "BRC", ida: "2027-08-01", volta: "2027-08-08" }],
  ["natal de 26/12 a 2/1", { i: "buscar", d: "NAT", ida: "2026-12-26", volta: "2027-01-02" }],
  ["roma 2 a 16 de setembro de 2027", { i: "buscar", d: "ROM", ida: "2027-09-02", volta: "2027-09-16" }],
  ["porto seguro 27/12 a 3/1 saindo de bh", { i: "buscar", o: "BHZ", d: "BPS", ida: "2026-12-27", volta: "2027-01-03" }],
  ["de vix pra gru dia 15 voltando dia 18", { i: "buscar", o: "VIX", d: "GRU", ida: "2026-11-15", volta: "2026-11-18" }],

  // ---- férias flexíveis ----
  ["qual o mês mais barato pra Madri em 2027?", { i: "ferias", d: "MAD", per: "2027-01..2027-12" }],
  ["quero ficar 2 a 3 semanas em Paris no 1º semestre", { i: "ferias", d: "PAR", per: "2027-01..2027-06", dur: "14-21" }],
  ["2 semanas em lisboa em março", { i: "ferias", d: "LIS", per: "2027-03..2027-03", dur: "13-16" }],
  ["15 dias em orlando nas ferias de julho", { i: "ferias", d: "MCO", jan: "2027-07-01..2027-07-31", dur: "15-15" }],
  ["quando é mais barato ir pra londres", { i: "ferias", d: "LON" }],
  ["melhor época pra ir pra nova york", { i: "ferias", d: "NYC" }],
  ["uma semana em cancun entre março e maio", { i: "ferias", d: "CUN", per: "2027-03..2027-05", dur: "6-9" }],
  ["10 a 15 dias em buenos aires no ano que vem", { i: "ferias", d: "BUE", per: "2027-01..2027-12", dur: "10-15" }],
  ["mes mais barato pra santiago", { i: "ferias", d: "SCL" }],
  ["quero passar 20 dias na europa em roma no segundo semestre", { i: "ferias", d: "ROM", per: "2027-07..2027-12", dur: "20-20" }],
  ["um mes em lisboa em 2027", { i: "ferias", d: "LIS", per: "2027-01..2027-12", dur: "28-31" }],
  ["3 semanas em paris de abril a junho", { i: "ferias", d: "PAR", per: "2027-04..2027-06", dur: "20-23" }],
  ["qual a data mais barata pra miami nos proximos 3 meses", { i: "ferias", d: "MIA", per: "2026-11..2027-01" }],
  ["ferias de 2 a 3 semanas em madri", { i: "ferias", d: "MAD", dur: "14-21" }],
  ["em que mes fica mais barato voar pra recife", { i: "ferias", d: "REC" }],
  ["uma semana em fortaleza em janeiro ou fevereiro", { i: "ferias", d: "FOR", per: "2027-01..2027-02", dur: "6-9" }],
  ["duas semanas em roma em maio de 2027", { i: "ferias", d: "ROM", per: "2027-05..2027-05", dur: "13-16" }],
  ["quero ficar 7 dias em salvador no mes que vem", { i: "ferias", d: "SSA", per: "2026-12..2026-12", dur: "7-7" }],
  ["10 dias em bariloche daqui a 2 meses", { i: "ferias", d: "BRC", per: "2027-01..2027-01", dur: "10-10" }],
  ["melhor periodo para dubai", { i: "ferias", d: "DXB" }],
  ["mais barato pra lima em 2027 ficando uns 12 dias", { i: "ferias", d: "LIM", per: "2027-01..2027-12", dur: "12-12" }],
  ["ida e volta pra miami em janeiro, mais barato", { i: "ferias", d: "MIA", per: "2027-01..2027-01" }],
  ["toronto de 1 a 2 semanas no primeiro semestre de 2027", { i: "ferias", d: "YYZ", per: "2027-01..2027-06", dur: "7-14" }],
  ["fim de ano em lisboa por 10 dias", { i: "ferias", d: "LIS", jan: "2026-12-18..2027-01-05", dur: "10-10" }],
  ["quando sai mais barato ir pra floripa", { i: "ferias", d: "FLN" }],

  // ---- datas flexíveis (o dia mais barato de um período) ----
  ["voo direto pro Rio semana que vem até R$ 500", { i: "buscar", d: "RIO", jan: "2026-11-09..2026-11-15", dir: true, teto: 500 }],
  ["passagem pra salvador semana que vem", { i: "buscar", d: "SSA", jan: "2026-11-09..2026-11-15" }],
  ["de São Paulo para Nova York no natal", { i: "buscar", o: "SAO", d: "NYC", jan: "2026-12-20..2026-12-26" }],
  ["lisboa no carnaval", { i: "buscar", d: "LIS", jan: "2027-02-05..2027-02-10" }],
  ["passagem pra natal em janeiro", { i: "buscar", d: "NAT", jan: "2027-01-01..2027-01-31" }],
  ["voo pra floripa esse fim de semana", { i: "buscar", d: "FLN", jan: "2026-11-06..2026-11-07" }],
  ["recife no proximo fim de semana", { i: "buscar", d: "REC", jan: "2026-11-13..2026-11-14" }],
  ["orlando em julho", { i: "buscar", d: "MCO", jan: "2027-07-01..2027-07-31" }],
  ["passagem pra buenos aires no reveillon", { i: "buscar", d: "BUE", jan: "2026-12-26..2027-01-03" }],
  ["madri no inicio de março", { i: "buscar", d: "MAD", jan: "2027-03-01..2027-03-10" }],
  ["paris no fim de abril", { i: "buscar", d: "PAR", jan: "2027-04-20..2027-04-30" }],
  ["voo pra brasilia nos proximos 10 dias", { i: "buscar", d: "BSB", jan: "2026-11-05..2026-11-15" }],
  ["fortaleza daqui a 10 dias", { i: "buscar", d: "FOR", ida: "2026-11-15" }],
  ["salvador em dezembro", { i: "buscar", d: "SSA", jan: "2026-12-01..2026-12-31" }],
  ["porto seguro no ano novo", { i: "buscar", d: "BPS", jan: "2026-12-26..2027-01-03" }],

  // ---- filtros ----
  ["voo direto pra lisboa dia 10/12", { i: "buscar", d: "LIS", ida: "2026-12-10", dir: true }],
  ["sem escala pra recife 20/11", { i: "buscar", d: "REC", dir: true }],
  ["passagem pra miami ate 3 mil reais em janeiro", { i: "buscar", d: "MIA", teto: 3000 }],
  ["lisboa por menos de R$ 4.000 dia 5/3", { i: "buscar", d: "LIS", teto: 4000, ida: "2027-03-05" }],
  ["madri no maximo 5 mil em março, 2 semanas", { i: "ferias", d: "MAD", teto: 5000, dur: "13-16" }],
  ["so ida pra santiago dia 12/12", { i: "buscar", d: "SCL", tipo: "ida", ida: "2026-12-12" }],
  ["somente ida pra paris em fevereiro", { i: "buscar", d: "PAR", tipo: "ida", jan: "2027-02-01..2027-02-28" }],
  ["executiva pra londres dia 8/1", { i: "buscar", d: "LON", ida: "2027-01-08" }],
  ["voo pra roma ate R$ 3500", { i: "buscar", d: "ROM", teto: 3500, falta: "data" }],
  ["com milhas smiles pra lisboa dia 10/12", { i: "buscar", d: "LIS", prog: "smiles", ida: "2026-12-10" }],
  ["latam pass pra santiago em março", { i: "buscar", d: "SCL", prog: "latampass" }],
  ["direto e ate 800 reais pra salvador amanha", { i: "buscar", d: "SSA", dir: true, teto: 800, ida: "2026-11-06" }],
  ["voos diretos para orlando entre 1/7 e 15/7", { i: "buscar", d: "MCO", dir: true, ida: "2027-07-01", volta: "2027-07-15" }],
  ["passagem barata pra cancun abaixo de 2500", { i: "buscar", d: "CUN", teto: 2500, falta: "data" }],
  ["primeira classe pra dubai dia 20/12", { i: "buscar", d: "DXB", ida: "2026-12-20" }],

  // ---- qualquer destino ----
  ["para onde é mais barato ir em abril?", { i: "explorar", d: null, per: "2027-04..2027-04" }],
  ["pra onde posso ir com ate 2 mil reais", { i: "explorar", d: null, teto: 2000 }],
  ["qualquer lugar no carnaval", { i: "explorar", d: null, jan: "2027-02-05..2027-02-10" }],
  ["destinos baratos saindo de sao paulo em janeiro", { i: "explorar", o: "SAO", d: null, per: "2027-01..2027-01" }],
  ["onde ir por uma semana em março", { i: "explorar", d: null, per: "2027-03..2027-03", dur: "6-9" }],
  ["que destino é mais barato no feriado de natal", { i: "explorar", d: null, jan: "2026-12-20..2026-12-26" }],
  ["algum lugar barato pra viajar semana que vem", { i: "explorar", d: null, jan: "2026-11-09..2026-11-15" }],
  ["pra onde viajar 2 semanas em 2027", { i: "explorar", d: null, per: "2027-01..2027-12", dur: "13-16" }],
  ["qualquer destino direto saindo de vix", { i: "explorar", o: "VIX", dir: true }],
  ["onde ir nas ferias de julho", { i: "explorar", d: null, jan: "2027-07-01..2027-07-31" }],

  // ---- parceiros ----
  ["quais programas me levam pra Lisboa?", { i: "parceiros", d: "LIS" }],
  ["com que milhas eu chego em toronto", { i: "parceiros", d: "YYZ" }],
  ["que programa usar pra ir pra madri", { i: "parceiros", d: "MAD" }],
  ["parceiros da smiles para paris", { i: "parceiros", d: "PAR", prog: "smiles" }],
  ["quais milhas servem pra voar pra santiago", { i: "parceiros", d: "SCL" }],
  ["programas de fidelidade pra nova york", { i: "parceiros", d: "NYC" }],
  ["emitir com azul pra lisboa", { i: "parceiros", d: "LIS" }],
  ["que milhas uso pra ir a orlando", { i: "parceiros", d: "MCO" }],

  // ---- simulador ----
  ["quanto vale meu milheiro se paguei R$ 35 com 80% de bônus?", { i: "simulador" }],
  ["vale a pena transferir pontos da livelo pra smiles", { i: "simulador" }],
  ["calcula o custo do milheiro", { i: "simulador" }],
  ["vale a pena comprar milhas a 17 reais", { i: "simulador" }],
  ["bonus de transferencia de 100% compensa?", { i: "simulador" }],

  // ---- conversa, ajuda, não entendido ----
  ["oi", { i: "ajuda" }],
  ["bom dia", { i: "ajuda" }],
  ["o que voce faz?", { i: "ajuda" }],
  ["como funciona", { i: "ajuda" }],
  ["asdfgh", { i: null }],
  ["obrigado", { i: null }],

  // ---- seguimentos (frase anterior no 3º item) ----
  ["e se for em julho?", { i: "buscar", d: "RIO", jan: "2027-07-01..2027-07-31", seg: true }, "voo direto pro Rio semana que vem até R$ 500"],
  ["e voltando dia 20?", { i: "buscar", d: "LIS", ida: "2026-12-10", volta: "2026-12-20", seg: true }, "VIX pra Lisboa dia 10/12"],
  ["e pra Porto?", { i: "buscar", d: "OPO", ida: "2026-12-10", seg: true }, "VIX pra Lisboa dia 10/12"],
  ["e saindo de São Paulo?", { i: "buscar", o: "SAO", d: "LIS", ida: "2026-12-10", seg: true }, "VIX pra Lisboa dia 10/12"],
  ["e só voo direto?", { i: "buscar", d: "LIS", dir: true, seg: true }, "VIX pra Lisboa dia 10/12"],
  ["e em 3 semanas?", { i: "ferias", d: "MAD", dur: "20-23", seg: true }, "qual o mês mais barato pra Madri em 2027?"],
  ["e no segundo semestre?", { i: "ferias", d: "PAR", per: "2027-07..2027-12", seg: true }, "quero ficar 2 a 3 semanas em Paris no 1º semestre"],
  ["dia 15 então", { i: "buscar", d: "LIS", ida: "2026-11-15", seg: true }, "VIX pra Lisboa dia 10/12"],
  ["e ate 3 mil?", { i: "ferias", d: "MAD", teto: 3000, seg: true }, "qual o mês mais barato pra Madri em 2027?"],
  ["mas de 10/1 a 20/1", { i: "buscar", d: "SCL", ida: "2027-01-10", volta: "2027-01-20", seg: true }, "ida e volta pra Santiago de 1 a 4 de dezembro"],

  // ---- faltando algo / ambiguidade ----
  ["quero viajar dia 10/12", { i: "buscar", d: null, falta: "destino" }],
  ["passagem pra lisboa", { i: "buscar", d: "LIS", falta: "data" }],
  ["quanto fica uma passagem?", { i: "buscar", d: null, falta: "destino" }],
  ["voos de vitoria", { i: "buscar", o: "VIX", d: null, falta: "destino" }],
  ["mais barato em março", { i: "ferias", d: null, falta: "destino" }],
  ["pra santiago dia 10/12", { i: "buscar", d: "SCL", amb: "" }],

  // ---- frases inéditas (05/11/2026), acrescentadas depois do primeiro teste de generalização ----
  ["to pensando em ir pra barcelona em junho, uns 10 dias", { i: "ferias", d: "BCN", per: "2027-06..2027-06", dur: "10-10" }],
  ["qnto ta uma passagem pra bahia dia 15/12", { i: "buscar", d: null, ida: "2026-12-15", falta: "destino" }],
  ["Preciso ir a Brasília na terça que vem", { i: "buscar", d: "BSB", ida: "2026-11-10" }],
  ["Lisboa ida 03/04 e volta 17/04 sem escala", { i: "buscar", d: "LIS", ida: "2027-04-03", volta: "2027-04-17", dir: true }],
  ["quero levar minha familia pra orlando nas ferias de janeiro por 2 semanas", { i: "ferias", d: "MCO", jan: "2027-01-01..2027-01-31", dur: "13-16" }],
  ["tem voo direto de vitoria pra são paulo amanhã de manhã?", { i: "buscar", o: "VIX", d: "SAO", ida: "2026-11-06", dir: true }],
  ["me mostra o melhor preço pra Tóquio no ano que vem", { i: "ferias", d: "TYO", per: "2027-01..2027-12" }],
  ["partindo de Campinas pro Chile em agosto", { i: "buscar", o: "VCP", d: null, falta: "destino" }],
  ["viagem de 5 dias pra Buenos Aires em maio gastando até 2.500", { i: "ferias", d: "BUE", dur: "5-5", teto: 2500 }],
  ["menor preço pra lisboa em março", { i: "ferias", d: "LIS", per: "2027-03..2027-03" }],
];
