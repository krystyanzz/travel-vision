"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { RoutePair } from "./AirportInput";
import { DateRangeField } from "./DatePicker";
import { rememberOrigin, useHomeAirport } from "./useHomeAirport";

export function QuickSearch() {
  const router = useRouter();
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [roundTrip, setRoundTrip] = useState(true);
  const [departDate, setDepartDate] = useState("");
  const [returnDate, setReturnDate] = useState("");
  const [error, setError] = useState<string | null>(null);

  // origem = aeroporto mais próximo do usuário (ou a última origem buscada)
  useHomeAirport(true, (code) => setOrigin((o) => o || code));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const fail = !/^[A-Z]{3}$/.test(origin) || !/^[A-Z]{3}$/.test(destination)
      ? "Escolha a origem e o destino."
      : !departDate
        ? "Escolha a data de ida."
        : roundTrip && !returnDate
          ? "Escolha a data de volta, ou mude para só ida."
          : null;
    if (fail) {
      setError(fail);
      return;
    }
    rememberOrigin(origin);
    const q = new URLSearchParams({ de: origin, para: destination, ida: departDate });
    if (roundTrip) q.set("volta", returnDate);
    router.push(`/busca?${q}`);
  }

  return (
    <form className="quick-search card" onSubmit={submit} aria-label="Busca rápida">
      <div className="trip-type" role="radiogroup" aria-label="Tipo de viagem">
        {[
          [true, "Ida e volta"],
          [false, "Só ida"],
        ].map(([v, l]) => (
          <button key={String(v)} type="button" role="radio" aria-checked={roundTrip === v} className={roundTrip === v ? "is-on" : ""} onClick={() => setRoundTrip(v as boolean)}>
            {l as string}
          </button>
        ))}
      </div>
      <RoutePair
        idPrefix="qs"
        origin={origin}
        destination={destination}
        onChange={(v) => {
          setOrigin(v.origin);
          setDestination(v.destination);
        }}
      />
      <DateRangeField
        departDate={departDate}
        returnDate={returnDate}
        roundTrip={roundTrip}
        origin={origin}
        destination={destination}
        onChange={(v) => {
          setDepartDate(v.departDate);
          setReturnDate(v.returnDate);
          setError(null);
        }}
      />
      <button className="btn btn-primary" type="submit">
        Buscar
      </button>
      {error && (
        <p className="muted quick-error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
