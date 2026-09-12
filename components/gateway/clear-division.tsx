"use client";

import { useEffect } from "react";
import { useDivision } from "@/lib/hooks/use-division";

/**
 * Tratează `?stay` pe poartă.
 *
 * Verificarea stă aici, pe client, nu în pagină: în pagină ar fi cerut
 * `searchParams`, iar acela scoate rădăcina site-ului din prerender și
 * o transformă în randare pe funcție la fiecare cerere.
 *
 * Fiindcă acum componenta se montează la FIECARE vizită, nu doar când
 * există `?stay`, garda de la început e obligatorie: fără ea,
 * `replaceState` ar șterge query-ul oricărui vizitator — inclusiv
 * `utm_*`, adică exact parametrii pe care `lib/utm.ts` îi citește
 * pentru atribuire.
 *
 * Astăzi niciun link din site nu produce `?stay` — cheia
 * `seeBothDivisions` din messages/*.json a rămas fără consumator după
 * ștergerea vechilor header-e. Componenta rămâne ca ieșire pentru cine
 * are cookie-ul `meridian_division` setat manual.
 */

export function ClearDivision() {
  const { clearDivision } = useDivision();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!params.has("stay")) return;

    clearDivision();
    window.history.replaceState(null, "", window.location.pathname);
  }, [clearDivision]);

  return null;
}
