import type { ReactNode } from "react";
import { getShellState, type ShellState } from "@/lib/panou/alerts";
import { PanouFrame } from "./frame";

/**
 * Cadrul comun al panoului (lead-uri, reclame, postări, firmă), din redesign:
 * meniul în stânga, bara de sus, bara de module pe telefon, căutarea Ctrl+K.
 * Fiecare layout își face singur garda de sesiune și își dă `selectors` (ce
 * alege omul în modulul lui: client, perioadă, platformă) și, la nevoie,
 * `banner` (coada oprită). Alertele și numerele din meniu se citesc aici, din
 * bază; un layout care le are deja le poate da prin `state`.
 */
export async function PanouShell({
  email,
  signOut,
  selectors,
  banner,
  state,
  children,
}: {
  email: string | null;
  signOut?: () => Promise<void>;
  selectors?: ReactNode;
  banner?: ReactNode;
  state?: ShellState;
  children: ReactNode;
}) {
  const { alerts, badges } = state ?? (await getShellState());
  return (
    <PanouFrame email={email} alerts={alerts} badges={badges} selectors={selectors} banner={banner} signOut={signOut}>
      {children}
    </PanouFrame>
  );
}
