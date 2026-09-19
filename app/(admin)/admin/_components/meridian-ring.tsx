/**
 * Arcul de meridian, în varianta neutră a porții: cercul și cele două
 * geodezice, desenate static, fără lumină care circulă și fără grilă —
 * niciuna dintre lumi, doar firul comun (CLAUDE.md §2). Aceeași
 * geometrie ca în `components/site/meridian.tsx`; copiată aici fiindcă
 * admin-ul nu are voie să atingă zona site-ului.
 */

const ARC_LEFT = "M160 10 C 62 72, 62 248, 160 310";
const ARC_RIGHT = "M160 10 C 258 72, 258 248, 160 310";

export function MeridianRing({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 320 320"
      className={className}
      fill="none"
      aria-hidden
      role="presentation"
    >
      <circle
        cx="160"
        cy="160"
        r="150"
        stroke="currentColor"
        strokeOpacity="0.16"
        strokeWidth="1"
      />
      <path d={ARC_LEFT} stroke="currentColor" strokeOpacity="0.28" strokeWidth="1" />
      <path d={ARC_RIGHT} stroke="currentColor" strokeOpacity="0.28" strokeWidth="1" />
      <line
        x1="10"
        y1="160"
        x2="310"
        y2="160"
        stroke="currentColor"
        strokeOpacity="0.1"
        strokeWidth="1"
      />
      <circle cx="160" cy="10" r="2.5" fill="currentColor" fillOpacity="0.6" />
      <circle cx="160" cy="310" r="2.5" fill="currentColor" fillOpacity="0.6" />
    </svg>
  );
}
