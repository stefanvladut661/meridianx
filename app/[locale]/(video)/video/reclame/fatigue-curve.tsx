"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "@/lib/hooks/use-reduced-motion";

/**
 * SIGNATURE-UL PAGINII /video/reclame (FAZA 3) — „curba de uzură”.
 *
 * Argumentul paginii, desenat: aceeași reclamă devine tot mai scumpă
 * pe măsură ce publicul o vede a zecea oară. Cine doar cumpără media
 * urcă pe curba caldă. Cine produce creativul în aceeași echipă îl
 * schimbă la timp și rămâne jos, pe curba rece.
 *
 * ONESTITATE: graficul nu are valori pe axa Y și nu pretinde date din
 * campanii reale (CLAUDE.md §5). Descrie o formă — mecanismul uzurii —
 * nu un rezultat măsurat. Asta e și scris sub el, nu doar aici.
 *
 * Sub prefers-reduced-motion curba e desenată din prima, completă.
 * Fără JS, la fel: SVG-ul e în HTML, animația doar se adaugă peste.
 */

const VB_W = 900;
const VB_H = 400;
const X0 = 96;
const X1 = 860;
const Y_TOP = 48;
const Y_BOTTOM = 336;
const WEEKS = 8;
const MAX = 1.15;
/** Ciclul de reîmprospătare a creativului, în săptămâni. */
const CYCLE = 3;

const px = (week: number) => X0 + (week / WEEKS) * (X1 - X0);
const py = (value: number) => Y_BOTTOM - (value / MAX) * (Y_BOTTOM - Y_TOP);

/** Costul relativ al aceluiași creativ, care se uzează exponențial. */
const burn = (week: number) => 0.15 * Math.exp(0.245 * week);

/** Același mecanism, dar resetat la fiecare ciclu — cu o saturație mică. */
const refresh = (week: number) => {
  const cycle = Math.floor(week / CYCLE);
  const inCycle = week - cycle * CYCLE;
  return 0.15 * (1 + 0.09 * cycle) * Math.exp(0.245 * inCycle);
};

function line(
  fn: (week: number) => number,
  from: number,
  to: number
): string {
  const steps = Math.round((to - from) / 0.05);
  const points: string[] = [];
  for (let i = 0; i <= steps; i += 1) {
    const week = from + i * 0.05;
    points.push(`${px(week).toFixed(1)},${py(fn(week)).toFixed(1)}`);
  }
  return `M${points.join(" L")}`;
}

const SHARED_PATH = line(burn, 0, CYCLE);
const BURN_PATH = line(burn, CYCLE, WEEKS);
const BURN_AREA = `${BURN_PATH} L${px(WEEKS).toFixed(1)},${Y_BOTTOM} L${px(
  CYCLE
).toFixed(1)},${Y_BOTTOM} Z`;

/** Segmentele curbei reci, între două reîmprospătări. */
const REFRESH_SEGMENTS = [
  line(refresh, CYCLE, CYCLE * 2),
  line(refresh, CYCLE * 2, WEEKS),
];

/** Momentele în care intră creativul nou: căderea verticală + marcaj. */
const REFRESH_MARKS = [CYCLE, CYCLE * 2].map((week) => ({
  week,
  x: px(week),
  from: py(burn(week)),
  to: py(refresh(week)),
}));

const GRID_LINES = [0.25, 0.5, 0.75, 1].map((level) => py(level * MAX));

export function FatigueCurve() {
  const reducedMotion = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const [drawn, setDrawn] = useState(false);

  useEffect(() => {
    if (reducedMotion) {
      setDrawn(true);
      return;
    }
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setDrawn(true);
          observer.disconnect();
        }
      },
      { threshold: 0.25 }
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [reducedMotion]);

  return (
    <figure ref={ref} data-drawn={drawn ? "" : undefined} className="mv-curve">
      <style>{`
.mv-curve .mv-draw{stroke-dasharray:1;stroke-dashoffset:1;transition:stroke-dashoffset 1600ms cubic-bezier(0.33,1,0.68,1)}
.mv-curve[data-drawn] .mv-draw{stroke-dashoffset:0}
.mv-curve .mv-late{opacity:0;transition:opacity 500ms ease}
.mv-curve[data-drawn] .mv-late{opacity:1}
@media (prefers-reduced-motion:reduce){
  .mv-curve .mv-draw{stroke-dashoffset:0;transition:none}
  .mv-curve .mv-late{opacity:1;transition:none}
}
`}</style>

      {/* Sub ~760px etichetele mono ar scădea sub 10px dacă am strânge
          tot graficul în lățimea ecranului — preferăm o glisare
          orizontală explicită unei axe pe care nu o poate citi nimeni. */}
      <div className="overflow-x-auto rounded-md border border-line bg-surface/40">
        <svg
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          className="h-auto w-full min-w-[48rem] text-fg"
          role="img"
          aria-labelledby="mv-curve-title mv-curve-desc"
        >
          {/* i18n: */}
          <title id="mv-curve-title">
            Costul per rezultat pe opt săptămâni, cu și fără schimbarea
            creativului
          </title>
          <desc id="mv-curve-desc">
            Două linii pornesc din același punct. Cea care păstrează aceeași
            reclamă urcă tot mai abrupt, până la un cost de câteva ori mai mare
            în săptămâna a opta. Cea în care intră un creativ nou la fiecare
            trei săptămâni coboară de fiecare dată aproape de punctul de
            plecare și rămâne jos. Graficul descrie mecanismul uzurii, nu
            rezultate măsurate.
          </desc>

          <defs>
            <linearGradient id="mv-burn-fill" x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="0%"
                stopColor="var(--v-tungsten)"
                stopOpacity="0.28"
              />
              <stop
                offset="100%"
                stopColor="var(--v-tungsten)"
                stopOpacity="0"
              />
            </linearGradient>
          </defs>

          {/* grilă hairline — orientare, fără valori inventate */}
          {GRID_LINES.map((y) => (
            <line
              key={y}
              x1={X0}
              x2={X1}
              y1={y}
              y2={y}
              stroke="currentColor"
              strokeOpacity="0.09"
              strokeWidth="1"
            />
          ))}

          {/* axe */}
          <line
            x1={X0}
            x2={X1}
            y1={Y_BOTTOM}
            y2={Y_BOTTOM}
            stroke="currentColor"
            strokeOpacity="0.3"
            strokeWidth="1"
          />
          <line
            x1={X0}
            x2={X0}
            y1={Y_TOP - 8}
            y2={Y_BOTTOM}
            stroke="currentColor"
            strokeOpacity="0.3"
            strokeWidth="1"
          />

          {/* etichete axa X — săptămâni, în vocabularul de plan de filmare */}
          {Array.from({ length: WEEKS }, (_, index) => index + 1).map(
            (week) => (
              <g key={week}>
                <line
                  x1={px(week)}
                  x2={px(week)}
                  y1={Y_BOTTOM}
                  y2={Y_BOTTOM + 6}
                  stroke="currentColor"
                  strokeOpacity="0.3"
                />
                <text
                  x={px(week)}
                  y={Y_BOTTOM + 24}
                  textAnchor="middle"
                  fill="currentColor"
                  fillOpacity="0.6"
                  fontSize="12"
                  letterSpacing="2"
                  className="font-mono"
                >
                  S{String(week).padStart(2, "0")}
                </text>
              </g>
            )
          )}

          {/* axa Y — direcție, nu valori */}
          <text
            transform={`translate(34 ${(Y_TOP + Y_BOTTOM) / 2}) rotate(-90)`}
            textAnchor="middle"
            fill="currentColor"
            fillOpacity="0.6"
            fontSize="12"
            letterSpacing="3"
            className="font-mono"
          >
            {/* i18n: */}
            COST PER REZULTAT ↑
          </text>

          {/* aria arsă sub curba caldă */}
          <path d={BURN_AREA} fill="url(#mv-burn-fill)" className="mv-late" />

          {/* traseul comun — până la prima decizie, situația e identică */}
          <path
            d={SHARED_PATH}
            className="mv-draw"
            pathLength={1}
            fill="none"
            stroke="currentColor"
            strokeOpacity="0.4"
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray="1"
          />

          {/* curba caldă: aceeași reclamă, opt săptămâni */}
          <path
            d={BURN_PATH}
            className="mv-draw"
            pathLength={1}
            fill="none"
            stroke="var(--v-tungsten)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray="1"
            style={{ transitionDelay: "260ms" }}
          />

          {/* curba rece: creativ nou la fiecare trei săptămâni */}
          {REFRESH_SEGMENTS.map((segment, index) => (
            <path
              key={segment.slice(0, 24)}
              d={segment}
              className="mv-draw"
              pathLength={1}
              fill="none"
              stroke="var(--v-daylight)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray="1"
              style={{ transitionDelay: `${420 + index * 260}ms` }}
            />
          ))}

          {/* momentele de reîmprospătare */}
          {REFRESH_MARKS.map((mark) => (
            <g key={mark.week} className="mv-late" style={{ transitionDelay: "900ms" }}>
              <line
                x1={mark.x}
                x2={mark.x}
                y1={mark.from}
                y2={mark.to}
                stroke="var(--v-daylight)"
                strokeWidth="1.5"
                strokeDasharray="3 4"
                strokeOpacity="0.7"
              />
              <path
                d={`M${mark.x} ${mark.to - 11} L${mark.x + 7} ${
                  mark.to + 1
                } L${mark.x - 7} ${mark.to + 1} Z`}
                fill="var(--v-daylight)"
              />
            </g>
          ))}

          {/* capătul curbei calde — unde ajunge bugetul dacă nu schimbi nimic */}
          <g className="mv-late" style={{ transitionDelay: "1100ms" }}>
            <circle
              cx={px(WEEKS)}
              cy={py(burn(WEEKS))}
              r="5"
              fill="var(--v-tungsten)"
            />
          </g>
        </svg>
      </div>

      <p
        aria-hidden="true"
        className="mt-3 font-mono text-[10px] tracking-[0.25em] text-fg/60 sm:hidden"
      >
        {/* i18n: */}
        GLISEAZĂ GRAFICUL →
      </p>

      <figcaption className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <ul className="flex flex-wrap gap-x-6 gap-y-2">
          <li className="flex items-center gap-2 font-mono text-[11px] tracking-[0.18em] text-fg/70">
            <span
              aria-hidden="true"
              className="inline-block h-0.5 w-6 rounded-full bg-v-tungsten"
            />
            {/* i18n: */}
            ACEEAȘI RECLAMĂ, OPT SĂPTĂMÂNI
          </li>
          <li className="flex items-center gap-2 font-mono text-[11px] tracking-[0.18em] text-fg/70">
            <span
              aria-hidden="true"
              className="inline-block h-0.5 w-6 rounded-full bg-v-daylight"
            />
            {/* i18n: */}
            CREATIV NOU LA FIECARE TREI SĂPTĂMÂNI
          </li>
          <li className="flex items-center gap-2 font-mono text-[11px] tracking-[0.18em] text-fg/70">
            <span aria-hidden="true" className="text-v-daylight">
              ▲
            </span>
            {/* i18n: */}
            INTRĂ CREATIVUL NOU
          </li>
        </ul>
        <p className="max-w-sm text-sm text-fg/60">
          {/* i18n: */}
          Formă, nu cifre: graficul arată mecanismul uzurii, nu rezultatele unei
          campanii anume. Axa verticală n-are valori pentru că n-avem cum să ți
          le promitem înainte să-ți vedem conturile.
        </p>
      </figcaption>
    </figure>
  );
}
