// Lista inicial para autocompletar. Códigos de cidade (SAO, RIO, BHZ...) cobrem
// vários aeroportos. Será substituída por uma base completa com licença aberta.

export interface Airport {
  code: string;
  name: string;
  city: boolean;
}

export const AIRPORTS: Airport[] = [
  { code: "SAO", name: "São Paulo (todos os aeroportos)", city: true },
  { code: "GRU", name: "São Paulo · Guarulhos", city: false },
  { code: "CGH", name: "São Paulo · Congonhas", city: false },
  { code: "VCP", name: "Campinas · Viracopos", city: false },
  { code: "RIO", name: "Rio de Janeiro (todos os aeroportos)", city: true },
  { code: "GIG", name: "Rio de Janeiro · Galeão", city: false },
  { code: "SDU", name: "Rio de Janeiro · Santos Dumont", city: false },
  { code: "BSB", name: "Brasília", city: false },
  { code: "BHZ", name: "Belo Horizonte (todos os aeroportos)", city: true },
  { code: "CNF", name: "Belo Horizonte · Confins", city: false },
  { code: "VIX", name: "Vitória", city: false },
  { code: "POA", name: "Porto Alegre", city: false },
  { code: "CWB", name: "Curitiba", city: false },
  { code: "FLN", name: "Florianópolis", city: false },
  { code: "SSA", name: "Salvador", city: false },
  { code: "REC", name: "Recife", city: false },
  { code: "FOR", name: "Fortaleza", city: false },
  { code: "BEL", name: "Belém", city: false },
  { code: "MAO", name: "Manaus", city: false },
  { code: "LIS", name: "Lisboa", city: false },
  { code: "OPO", name: "Porto", city: false },
  { code: "MAD", name: "Madri", city: false },
  { code: "PAR", name: "Paris (todos os aeroportos)", city: true },
  { code: "LON", name: "Londres (todos os aeroportos)", city: true },
  { code: "ROM", name: "Roma (todos os aeroportos)", city: true },
  { code: "MIA", name: "Miami", city: false },
  { code: "MCO", name: "Orlando", city: false },
  { code: "NYC", name: "Nova York (todos os aeroportos)", city: true },
  { code: "SCL", name: "Santiago", city: false },
  { code: "EZE", name: "Buenos Aires · Ezeiza", city: false },
];
