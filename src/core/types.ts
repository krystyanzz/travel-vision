// Tipos de domínio do Travel Vision. Este diretório (src/core) não depende de
// Next.js nem de React: será extraído para o backend Node.js sem mudanças.

export type Cabin = "economy" | "premium_economy" | "business" | "first";

export const CABIN_LABEL: Record<Cabin, string> = {
  economy: "Econômica",
  premium_economy: "Premium Economy",
  business: "Executiva",
  first: "Primeira",
};

export interface Passengers {
  adults: number;
  children: number;
  infants: number;
}

export interface CashSearchQuery {
  origin: string; // IATA de aeroporto ou cidade (ex.: SAO, GRU)
  destination: string;
  departureDate: string; // AAAA-MM-DD
  returnDate?: string;
  passengers: Passengers;
  cabin: Cabin;
}

export interface Segment {
  carrierName: string; // nome comercial, sem logotipo
  flightNumber: string;
  origin: string;
  destination: string;
  departAt: string; // ISO local
  arriveAt: string;
}

export interface Itinerary {
  segments: Segment[];
  durationMinutes: number;
}

export interface CashOffer {
  id: string;
  providerId: string;
  totalAmount: number;
  currency: string;
  outbound: Itinerary;
  inbound?: Itinerary;
  stops: number;
  baggageIncluded: boolean | null; // null = fornecedor não informou
  bookingUrl?: string; // redirecionamento para compra no parceiro
}

export interface CalendarDay {
  date: string;
  lowestAmount: number | null;
  currency: string;
}

export type PriceLevel = "baixo" | "normal" | "alto";
