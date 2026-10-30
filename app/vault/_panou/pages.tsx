"use client";

import { useVault } from "../_components/vault-provider";
import { AlreadyOpen } from "./gate";
import { ActivateFlow, RecoverFlow } from "./onboarding";

/**
 * Paginile /vault/activare și /vault/recuperare. Cât seiful e încuiat, poarta
 * le lasă să-și arate fluxul; în orice altă fază, poarta arată singură pasul
 * potrivit (chei, cod, așteptare, cod de recuperare). Cu seiful deschis nu mai
 * au ce face: un card care spune asta.
 */

export function ActivatePage() {
  const { phase } = useVault();
  if (phase.kind === "unlocked") return <AlreadyOpen title="Contul e activ" text="Seiful e deschis, deci contul tău e deja activat. Parola master o schimbi din Contul meu." />;
  return <ActivateFlow />;
}

export function RecoverPage() {
  const { phase } = useVault();
  if (phase.kind === "unlocked") return <AlreadyOpen title="Seiful e deschis" text="Recuperarea cu codul e pentru când cheile nu se mai deschid. Acum ele sunt deschise, deci nu ai nimic de recuperat." />;
  return <RecoverFlow />;
}
