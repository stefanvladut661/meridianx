import {
  fundingTimeline,
  fundingTimelineWeeks,
  type TimelinePhase,
} from "@/content/software/funding";
import { DrawIn } from "./draw-in";
import { drawDelay } from "./draw";

/**
 * SIGNATURE-UL PAGINII /software/fonduri (FAZA 4) — calendarul de decontare.
 *
 * Ideea care face pagina imposibil de copiat de pe alt site: calendarul se
 * citește INVERS. Marginea din dreapta e termenul TĂU de decontare, nu
 * lansarea noastră. Scara spune câte săptămâni înainte de termen trebuie
 * semnat, ca omul cu finanțare să afle într-o privire dacă mai are timp.
 *
 * Două benzi, pentru că un dosar de decontare are doi responsabili:
 * ce livrăm noi și ce depinde de tine sau de consultantul tău.
 *
 * Accesibilitate: desenul e `aria-hidden` (e o redare a aceleiași
 * informații), iar sub el stă mereu lista semantică — ea e conținutul
 * real și e singura variantă la 360px. Nu există informație doar în SVG.
 */

const VIEW_W = 1000;
const VIEW_H = 250;
const PAD_L = 24;
const PAD_R = 92;
const TRACK_W = VIEW_W - PAD_L - PAD_R;

const LANE_Y = { meridian: 54, client: 176 } as const;
const LANE_H = 30;
const AXIS_Y = 120;

function weekToX(week: number) {
  return PAD_L + (week / fundingTimelineWeeks) * TRACK_W;
}

function laneColor(lane: TimelinePhase["lane"]) {
  return lane === "meridian" ? "var(--s-signal)" : "var(--s-data)";
}

export function FundingTimeline() {
  // Gradații: o săptămână = o gradație minoră, etichetă la fiecare 5.
  const ticks = Array.from({ length: fundingTimelineWeeks + 1 }, (_, w) => w);

  return (
    <div>
      {/* ---------- Desenul ---------- */}
      <DrawIn className="hidden md:block" threshold={0.2}>
        <svg
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          aria-hidden="true"
          focusable="false"
          className="w-full"
        >
          {/* eticheta benzii noastre */}
          <text
            data-draw-fade
            x={PAD_L}
            y={LANE_Y.meridian - 14}
            fill="var(--s-signal)"
            className="font-mono"
            fontSize="11"
            letterSpacing="2.2"
          >
            MERIDIAN LIVREAZĂ
          </text>

          {/* eticheta benzii clientului */}
          <text
            data-draw-fade
            x={PAD_L}
            y={LANE_Y.client + LANE_H + 22}
            fill="var(--s-data)"
            className="font-mono"
            fontSize="11"
            letterSpacing="2.2"
          >
            TU SAU CONSULTANTUL TĂU
          </text>

          {/* axa cu gradații — scara instrumentului */}
          <line
            data-draw-path
            x1={PAD_L}
            y1={AXIS_Y}
            x2={PAD_L + TRACK_W}
            y2={AXIS_Y}
            stroke="var(--s-grid)"
            strokeWidth="1"
            pathLength={1}
          />
          {ticks.map((week) => {
            const labelled = week % 5 === 0;
            return (
              <g key={week} style={drawDelay(120 + week * 8)}>
                <line
                  data-draw-fade
                  x1={weekToX(week)}
                  y1={AXIS_Y}
                  x2={weekToX(week)}
                  y2={AXIS_Y + (labelled ? 9 : 4)}
                  stroke={labelled ? "var(--s-muted)" : "var(--s-grid)"}
                  strokeWidth="1"
                />
                {labelled ? (
                  <text
                    data-draw-fade
                    x={weekToX(week)}
                    y={AXIS_Y + 24}
                    fill="var(--s-muted)"
                    className="font-mono"
                    fontSize="10"
                    textAnchor="middle"
                  >
                    {week === fundingTimelineWeeks
                      ? "0"
                      : `−${fundingTimelineWeeks - week}`}
                  </text>
                ) : null}
              </g>
            );
          })}

          {/* etapele, pe banda proprie */}
          {fundingTimeline.map((phase, index) => {
            const x = weekToX(phase.fromWeek);
            const width = weekToX(phase.toWeek) - x;
            const y = LANE_Y[phase.lane];
            const color = laneColor(phase.lane);
            return (
              <g key={phase.id} style={drawDelay(200 + index * 70)}>
                <rect
                  data-draw-fade
                  x={x}
                  y={y}
                  width={width}
                  height={LANE_H}
                  rx="2"
                  fill={color}
                  fillOpacity={phase.lane === "meridian" ? 0.16 : 0.12}
                  stroke={color}
                  strokeWidth="1"
                />
                <text
                  data-draw-fade
                  x={x + 8}
                  y={y + 19}
                  fill={color}
                  className="font-mono"
                  fontSize="11"
                  letterSpacing="1.4"
                >
                  {phase.code}
                </text>
                {/* legătura etapei cu axa — desenul arată că totul e măsurat */}
                <line
                  data-draw-fade
                  x1={x}
                  y1={phase.lane === "meridian" ? y + LANE_H : AXIS_Y}
                  x2={x}
                  y2={phase.lane === "meridian" ? AXIS_Y : y}
                  stroke={color}
                  strokeWidth="1"
                  strokeDasharray="2 4"
                  strokeOpacity="0.5"
                />
              </g>
            );
          })}

          {/* termenul clientului — capătul din dreapta, citirea inversă */}
          <g style={drawDelay(620)}>
            <line
              data-draw-path
              x1={PAD_L + TRACK_W}
              y1="28"
              x2={PAD_L + TRACK_W}
              y2={VIEW_H - 28}
              stroke="var(--s-data)"
              strokeWidth="1.5"
              strokeDasharray="4 4"
              pathLength={1}
            />
            <text
              data-draw-fade
              x={PAD_L + TRACK_W + 10}
              y="34"
              fill="var(--s-data)"
              className="font-mono"
              fontSize="11"
              letterSpacing="1.4"
            >
              <tspan x={PAD_L + TRACK_W + 10} dy="0">
                TERMENUL
              </tspan>
              <tspan x={PAD_L + TRACK_W + 10} dy="14">
                TĂU DE
              </tspan>
              <tspan x={PAD_L + TRACK_W + 10} dy="14">
                DECONTARE
              </tspan>
            </text>
          </g>
        </svg>
      </DrawIn>

      {/* ---------- Conținutul: lista etapelor ---------- */}
      <ol className="mt-8 border-t border-line md:mt-10">
        {fundingTimeline.map((phase) => {
          const ours = phase.lane === "meridian";
          return (
            <li
              key={phase.id}
              className="grid gap-x-6 gap-y-2 border-b border-line py-5 sm:grid-cols-[4rem_1fr] lg:grid-cols-[4rem_16rem_1fr_9rem]"
            >
              <p
                className={
                  ours
                    ? "font-mono text-[11px] tracking-[0.2em] text-accent"
                    : "font-mono text-[11px] tracking-[0.2em] text-accent-2"
                }
              >
                {phase.code}
              </p>
              <h3 className="text-balance font-display text-base font-semibold tracking-tight">
                {phase.label}
              </h3>
              <p className="text-sm leading-relaxed text-fg/70">
                {phase.description}
              </p>
              <p className="font-mono text-[10px] uppercase leading-snug tracking-[0.14em] text-muted lg:text-right">
                {/* i18n: */}
                Săpt. {phase.fromWeek}–{phase.toWeek}
                <span className="block text-muted">
                  {ours ? "noi" : "tu"}
                </span>
              </p>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
