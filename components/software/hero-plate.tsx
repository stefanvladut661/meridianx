import type { ReactNode } from "react";
import { DrawIn } from "./draw-in";
import { drawDelay } from "./draw";

/**
 * SIGNATURE-UL PAGINII /software (FAZA 4) — planșa de desen tehnic.
 *
 * Hero-ul e o planșă: grilă de coordonate, geodezica de meridian trasată
 * peste ea și, în colț, CARTUȘUL — blocul de identificare pe care îl are
 * orice desen tehnic real. În cartuș nu punem date decorative, ci
 * parametrii comerciali după care clientul decide dacă suntem potriviți:
 * interval de buget, termen, garanție, proprietatea codului.
 *
 * Asta e locul unde cheltuim îndrăzneala pe pagina de home (CLAUDE.md §3).
 * Restul paginii stă cuminte: hairline-uri și tipografie.
 *
 * Geodezica e firul comun cu divizia video, în dialectul de aici: acolo e
 * un arc de lumină, aici e o curbă măsurată pe grilă, cu gradații.
 */

/** Curba de meridian pe planșă. Cote în sistemul viewBox 1200×640. */
const GEODESIC = "M -40 512 C 260 512, 380 108, 720 96 C 940 88, 1090 168, 1240 232";

/** Gradațiile de latitudine de pe geodezică — poziții pe axa Y. */
const LATITUDES = [512, 424, 336, 248, 160];

export function BlueprintPlate({ className }: { className?: string }) {
  return (
    <DrawIn className={className} threshold={0.05}>
      <svg
        viewBox="0 0 1200 640"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
        focusable="false"
        className="size-full"
      >
        <defs>
          <pattern
            id="sw-plate-grid"
            width="40"
            height="40"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 40 0 L 0 0 0 40"
              fill="none"
              stroke="var(--s-grid)"
              strokeWidth="1"
            />
          </pattern>
          <linearGradient id="sw-plate-fade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="white" stopOpacity="0.55" />
            <stop offset="70%" stopColor="white" stopOpacity="0.12" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </linearGradient>
          <mask id="sw-plate-mask">
            <rect width="1200" height="640" fill="url(#sw-plate-fade)" />
          </mask>
        </defs>

        {/* grila de coordonate, stinsă spre bază ca să nu concureze textul */}
        <rect
          width="1200"
          height="640"
          fill="url(#sw-plate-grid)"
          mask="url(#sw-plate-mask)"
        />

        {/* geodezica — se trasează la intrarea în pagină */}
        <path
          data-draw-path
          d={GEODESIC}
          fill="none"
          stroke="var(--s-signal)"
          strokeWidth="1.5"
          pathLength={1}
          opacity="0.9"
        />

        {/* gradațiile de latitudine: cote reale pe axă, nu ornament */}
        {LATITUDES.map((y, index) => (
          <g key={y} style={drawDelay(160 + index * 45)}>
            <line
              data-draw-path
              x1="0"
              y1={y}
              x2="72"
              y2={y}
              stroke="var(--s-grid)"
              strokeWidth="1"
              pathLength={1}
            />
            <circle
              data-draw-fade
              cx="72"
              cy={y}
              r="2"
              fill="var(--s-data)"
              opacity="0.7"
            />
          </g>
        ))}

        {/* marcaje de colț — planșa e încadrată, ca un desen de execuție */}
        {[
          [16, 16, 1, 1],
          [1184, 16, -1, 1],
          [16, 624, 1, -1],
          [1184, 624, -1, -1],
        ].map(([x, y, sx, sy]) => (
          <path
            key={`${x}-${y}`}
            data-draw-path
            d={`M ${x} ${y + 22 * sy} L ${x} ${y} L ${x + 22 * sx} ${y}`}
            fill="none"
            stroke="var(--s-signal)"
            strokeWidth="1.5"
            pathLength={1}
            opacity="0.5"
            style={drawDelay(320)}
          />
        ))}
      </svg>
    </DrawIn>
  );
}

export interface TitleBlockRow {
  label: string;
  value: ReactNode;
}

/**
 * Cartușul planșei. Un desen tehnic nu e complet fără blocul care spune
 * cine l-a făcut, la ce scară și în ce revizie. Al nostru spune ce
 * întreabă clientul înainte de primul call.
 */
export function TitleBlock({
  rows,
  caption,
}: {
  rows: TitleBlockRow[];
  caption?: string;
}) {
  return (
    <div className="overflow-hidden rounded-md border border-line bg-surface/80 backdrop-blur-sm">
      <p className="flex items-center justify-between gap-4 border-b border-line px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.22em] text-accent-2">
        <span>Fișa diviziei</span>
        <span aria-hidden="true" className="text-muted">
          MRD·SW
        </span>
      </p>
      <dl className="divide-y divide-line">
        {rows.map((row) => (
          <div
            key={row.label}
            className="grid gap-1 px-4 py-3 sm:grid-cols-[9.5rem_1fr] sm:items-baseline sm:gap-4"
          >
            <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
              {row.label}
            </dt>
            <dd className="text-sm leading-snug text-fg">{row.value}</dd>
          </div>
        ))}
      </dl>
      {caption ? (
        <p className="border-t border-line px-4 py-2.5 font-mono text-[10px] leading-relaxed tracking-wide text-muted">
          {caption}
        </p>
      ) : null}
    </div>
  );
}
