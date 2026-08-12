"use client";

import { useEffect } from "react";
import { useDivision } from "@/lib/hooks/use-division";

/**
 * Se randează pe gateway doar când există `?stay=1` (FAZA 1):
 * șterge cookie-ul `meridian_division` (utilizatorul a cerut explicit
 * să vadă ambele divizii) și curăță param-ul din URL fără navigare,
 * ca refresh-ul și switch-ul de limbă să rămână pe gateway-ul curat.
 */

export function ClearDivision() {
  const { clearDivision } = useDivision();

  useEffect(() => {
    clearDivision();
    if (window.location.search) {
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, [clearDivision]);

  return null;
}
