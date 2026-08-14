import { softwareProcess } from "@/content/software/process";
import { DrawIn } from "./draw-in";
import { drawDelay } from "./draw";

/**
 * SIGNATURE-UL PAGINII /software/proces (FAZA 4) — graficul de
 * responsabilitate.
 *
 * Diagrama nu arată „etapele proiectului” (aia o știe oricine). Arată
 * PREDĂRILE: o linie care țese între banda noastră și banda ta, cu un nod
 * la fiecare punct în care mingea trece dintr-o curte în alta. Un IMM care
 * n-a mai lucrat cu o agenție are exact frica asta — că i se cere ceva
 * când nu are omul disponibil — iar diagrama i-o răspunde dintr-o privire.
 *
 * Țesătura e geodezica de meridian în dialectul software: o curbă măsurată
 * între două paralele, nu un arc de lumină (CLAUDE.md §2, firul comun).
 *
 * `aria-hidden`: aceeași informație stă, integral, în lista de sub ea.
 * Sub 768px desenul dispare — lista rămâne, completă.
 */

const VIEW_W = 1000;
const VIEW_H = 260;
const PAD_X = 60;
const LANE_US = 62;
const LANE_YOU = 198;

const steps = softwareProcess;

function stepX(index: number) {
  if (steps.length <= 1) return VIEW_W / 2;
  return PAD_X + (index / (steps.length - 1)) * (VIEW_W - PAD_X * 2);
}

/** Curba care coboară/urcă între benzi, cu tangente verticale la noduri. */
function weave(x1: number, y1: number, x2: number, y2: number) {
  const dy = (y2 - y1) * 0.55;
  const dx = (x2 - x1) * 0.5;
  return `C ${x1 + dx * 0.3} ${y1 + dy}, ${x2 - dx * 0.3} ${y2 - dy}, ${x2} ${y2}`;
}

export function ResponsibilityChart() {
  // Traseul: la fiecare etapă coborâm în banda clientului și urcăm înapoi.
  let path = `M ${stepX(0)} ${LANE_US}`;
  steps.forEach((_, index) => {
    const x = stepX(index);
    path += ` ${weave(x, LANE_US, x + 18, LANE_YOU)}`;
    const next = index < steps.length - 1 ? stepX(index + 1) : x + 46;
    path += ` ${weave(x + 18, LANE_YOU, next, LANE_US)}`;
  });

  return (
    <div>
      <DrawIn className="hidden md:block" threshold={0.2}>
        <svg
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          aria-hidden="true"
          focusable="false"
          className="w-full"
        >
          {/* paralelele: cele două benzi de responsabilitate */}
          <line
            data-draw-path
            x1="0"
            y1={LANE_US}
            x2={VIEW_W}
            y2={LANE_US}
            stroke="var(--s-grid)"
            strokeWidth="1"
            pathLength={1}
          />
          <line
            data-draw-path
            x1="0"
            y1={LANE_YOU}
            x2={VIEW_W}
            y2={LANE_YOU}
            stroke="var(--s-grid)"
            strokeWidth="1"
            pathLength={1}
          />
          <text
            data-draw-fade
            x="0"
            y={LANE_US - 16}
            fill="var(--s-signal)"
            className="font-mono"
            fontSize="11"
            letterSpacing="2.2"
          >
            NOI
          </text>
          <text
            data-draw-fade
            x="0"
            y={LANE_YOU + 26}
            fill="var(--s-data)"
            className="font-mono"
            fontSize="11"
            letterSpacing="2.2"
          >
            TU
          </text>

          {/* țesătura predărilor */}
          <path
            data-draw-path
            d={path}
            fill="none"
            stroke="var(--s-signal)"
            strokeWidth="1.5"
            strokeOpacity="0.75"
            pathLength={1}
            style={drawDelay(120)}
          />

          {/* nodurile: câte o predare pe etapă, în fiecare bandă */}
          {steps.map((step, index) => (
            <g key={step.id} style={drawDelay(260 + index * 55)}>
              <circle
                data-draw-fade
                cx={stepX(index)}
                cy={LANE_US}
                r="4.5"
                fill="var(--s-ink)"
                stroke="var(--s-signal)"
                strokeWidth="1.5"
              />
              <circle
                data-draw-fade
                cx={stepX(index) + 18}
                cy={LANE_YOU}
                r="4.5"
                fill="var(--s-ink)"
                stroke="var(--s-data)"
                strokeWidth="1.5"
              />
              <text
                data-draw-fade
                x={stepX(index)}
                y={LANE_US - 16}
                fill="var(--s-muted)"
                className="font-mono"
                fontSize="11"
                textAnchor="middle"
              >
                {String(step.order).padStart(2, "0")}
              </text>
              <text
                data-draw-fade
                x={stepX(index)}
                y={VIEW_H - 8}
                fill="var(--s-paper)"
                className="font-mono"
                fontSize="11"
                letterSpacing="1.2"
                textAnchor="middle"
                opacity="0.75"
              >
                {step.title.toUpperCase()}
              </text>
            </g>
          ))}
        </svg>
      </DrawIn>

      <p className="mt-6 max-w-3xl border-l-2 border-line pl-5 text-sm leading-relaxed text-muted md:mt-8">
        {/* i18n: */}
        Fiecare punct de pe linie e o predare. Proiectele nu întârzie din
        cauza codului, ci în punctele astea — de aceea le-am desenat.
      </p>
    </div>
  );
}
