import type { ReactNode } from "react";
import { CommandPalette } from "./command-palette";
import { PanouMobileNav } from "./mobile-nav";
import { PanouSidebar } from "./sidebar";

/**
 * Cadrul comun al panoului (lead-uri, reclame, postări, firmă): meniul în
 * stânga, deasupra conținutului bara modulului (`topBar`: clienți și perioadă la
 * reclame, starea cozii la postări), jos pe telefon bara de module. Fiecare
 * layout își face singur garda de sesiune și își dă bara; cadrul e același.
 */
export function PanouShell({
  email,
  googleTools = false,
  signOut,
  topBar,
  children,
}: {
  email: string | null;
  /** Doar la reclame: arată „Căutări” în meniu când clientul ales are cont Google. */
  googleTools?: boolean;
  signOut: () => Promise<void>;
  topBar?: ReactNode;
  children: ReactNode;
}) {
  // `ads-portal` poartă regulile din portal.css (butoane, carduri, tabele); `panou` e numele nou, același lucru.
  return (
    <div className="ads-portal panou relative min-h-dvh">
      <a href="#continut" className="skip-link">
        Sari la conținut
      </a>

      <div className="lg:grid lg:min-h-dvh lg:grid-cols-[248px_minmax(0,1fr)]">
        <PanouSidebar email={email} googleTools={googleTools} signOut={signOut} />
        <div className="flex min-h-dvh min-w-0 flex-col">
          {topBar}
          <div id="continut" className="relative flex-1 pb-20 lg:pb-0">
            {children}
          </div>
        </div>
      </div>

      <PanouMobileNav email={email} googleTools={googleTools} signOut={signOut} />
      <CommandPalette googleTools={googleTools} />
    </div>
  );
}
