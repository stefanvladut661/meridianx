"use client";

import { use, type ReactNode } from "react";

/**
 * Hidratează portalul abia după ce browserul a terminat de citit pagina.
 *
 * DE CE: paginile mari (liste, tabele) primesc datele RSC în mai multe
 * bucăți, ca scripturi puse DUPĂ scriptul care pornește hidratarea. Când
 * scriptul acela vine din cache, rulează înainte ca browserul să fi citit
 * bucățile de după el. React ajunge la o bucată lipsă, se oprește, iar când
 * bucata sosește reia elementul HTML la care se oprise — și, cu React 19.2
 * canary (inclus în Next 15.5), îl „revendică” din DOM a doua oară: găsește
 * primul lui copil în locul lui (`<li>` unde aștepta `<ol>`), dă eroarea
 * #418 și reconstruiește toată pagina în browser. Intermitent, doar la
 * paginile mari, doar cu scripturile deja în cache.
 *
 * CUM: dacă documentul încă se citește când începe hidratarea, componenta
 * se suspendă până la `DOMContentLoaded` — moment în care toate bucățile au
 * sosit. Fiind o componentă-funcție, reluarea ei nu revendică nimic din DOM.
 * Între timp se vede HTML-ul trimis de server, neschimbat. Pe server și la
 * navigarea dintre pagini (documentul e deja citit) nu așteaptă nimic.
 */

let parsed: Promise<void> | null = null;

function whenParsed(): Promise<void> | null {
  if (typeof document === "undefined" || document.readyState !== "loading") return null;
  parsed ??= new Promise((resolve) => {
    document.addEventListener("DOMContentLoaded", () => resolve(), { once: true });
  });
  return parsed;
}

export function HydrateWhenParsed({ children }: { children: ReactNode }) {
  const pending = whenParsed();
  if (pending) use(pending);
  return children;
}
