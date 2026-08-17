/**
 * Stilurile de motion ale diviziei SOFTWARE (FAZA 4).
 *
 * De ce un <style> local și nu globals.css: fișierul global e înghețat
 * după FAZA 0 (CLAUDE.md §6). Se montează o dată per pagină, ca
 * `VideoMotionStyles` în F2 — deduplicarea o face F7.
 *
 * Reguli respectate:
 * - nimic peste 400ms (CLAUDE.md §2, lumea software)
 * - `prefers-reduced-motion` → totul e desenat/vizibil din start, fără
 *   nicio tranziție; pagina rămâne completă, nu doar „fără animații”
 * - nu se împrumută nimic din vocabularul video (fără scrub, fără pin)
 */
export function SoftwareMotionStyles() {
  return (
    <style>{`
/* Trasare SVG: căile pornesc nedesenate și se completează la intrarea
   în viewport. pathLength="1" normalizează orice lungime la 0–1. */
[data-draw] [data-draw-path] {
  stroke-dasharray: 1;
  stroke-dashoffset: 1;
  transition: stroke-dashoffset 380ms cubic-bezier(0.22, 1, 0.36, 1);
  transition-delay: var(--draw-delay, 0ms);
}
[data-draw="on"] [data-draw-path] {
  stroke-dashoffset: 0;
}

/* Elemente care apar odată cu trasarea (etichete, puncte, cote). */
[data-draw] [data-draw-fade] {
  opacity: 0;
  transition: opacity 240ms ease-out;
  transition-delay: var(--draw-delay, 0ms);
}
[data-draw="on"] [data-draw-fade] {
  opacity: 1;
}

@media (prefers-reduced-motion: reduce) {
  [data-draw] [data-draw-path] {
    stroke-dashoffset: 0;
    transition: none;
  }
  [data-draw] [data-draw-fade] {
    opacity: 1;
    transition: none;
  }
}
    `}</style>
  );
}
