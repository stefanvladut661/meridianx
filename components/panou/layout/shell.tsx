import type { ReactNode } from "react";
import { getShellState } from "@/lib/panou/alerts";
import { PanouFrame } from "./frame";

/**
 * Cadrul comun al panoului (lead-uri, prospectare, reclame, postări, firmă): îl
 * pune o singură dată `app/(admin)/admin/layout.tsx`, deci rămâne pe loc când
 * treci dintr-un modul în altul — doar conținutul se schimbă.
 *
 * Alertele și numerele din meniu se citesc din bază, dar nu se așteaptă: pleacă
 * spre browser ca promisiune și apar când sosesc, fără să țină pagina.
 */
export function PanouShell({ email, signOut, children }: { email: string | null; signOut?: () => Promise<void>; children: ReactNode }) {
  return (
    <PanouFrame email={email} state={getShellState()} signOut={signOut}>
      {children}
    </PanouFrame>
  );
}
