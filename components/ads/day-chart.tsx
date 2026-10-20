"use client";

import { useEffect, useId, useRef, useState } from "react";
import { formatAmount, formatCount, formatDay } from "@/lib/ads/metrics";

/**
 * O măsură pe zile — coloane subțiri, o singură serie, o singură axă.
 *
 * Reguli (skill-ul dataviz): coloane de cel mult 24px cu capătul rotunjit și
 * baza dreaptă; grilă din linii subțiri, pline; etichete doar la capete și
 * la maxim; textul în culori de text, niciodată în culoarea datelor. Nicio
 * a doua axă: cheltuiala și rezultatele stau în grafice separate, aliniate.
 *
 * Hover pe coloană și, de la tastatură, săgețile stânga/dreapta dau aceeași
 * fișă. Tabelul cu cifrele pe zile, de sub grafice, e drumul fără grafic.
 *
 * Culoarea seriei: #3987e5 — validată cu `validate_palette.js` pe suprafața
 * panoului (#0c0d11): în banda de luminozitate, peste pragul de croma,
 * contrast peste 3:1.
 */

const SERIES = "#3987e5";
const SERIES_ACTIVE = "#6da7ec";
const HEIGHT = 150;
const AXIS = 22;
const LEFT = 56;
const TOP = 12;

export interface ChartDay {
  date: string;
  value: number;
}

/** Pași „rotunzi” pentru grilă: 1, 2, 2,5, 5 × 10ⁿ. */
function niceMax(max: number): { top: number; ticks: number[] } {
  if (max <= 0) return { top: 1, ticks: [0, 1] };
  const rough = max / 3;
  const power = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((factor) => factor * power).find((candidate) => candidate >= rough) ?? rough;
  const top = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let value = 0; value <= top + step / 2; value += step) ticks.push(Math.round(value * 1000) / 1000);
  return { top, ticks };
}

function barPath(x: number, y: number, width: number, height: number): string {
  const radius = Math.min(4, width / 2, height);
  const bottom = y + height;
  return [
    `M${x},${bottom}`,
    `V${y + radius}`,
    `Q${x},${y} ${x + radius},${y}`,
    `H${x + width - radius}`,
    `Q${x + width},${y} ${x + width},${y + radius}`,
    `V${bottom}`,
    "Z",
  ].join(" ");
}

/** Ce fel de număr e: bani (în moneda contului) sau o numărătoare. */
export type ChartUnit = { type: "money"; currency: string } | { type: "count" };

const shortNumber = new Intl.NumberFormat("ro-RO", { notation: "compact", maximumFractionDigits: 1 });

export function DayChart({
  title,
  days,
  unit,
}: {
  title: string;
  days: ChartDay[];
  unit: ChartUnit;
}) {
  const format = (value: number) =>
    unit.type === "money" ? formatAmount(value, unit.currency) : formatCount(value);
  const tickFormat = (value: number) => shortNumber.format(value);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState<number | null>(null);
  const [active, setActive] = useState<number | null>(null);
  const titleId = useId();

  useEffect(() => {
    const element = wrapRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const max = Math.max(0, ...days.map((day) => day.value));
  const { top, ticks } = niceMax(max);
  const peak = days.findIndex((day) => day.value === max && max > 0);

  const plotWidth = width ? width - LEFT - 8 : 0;
  const band = days.length > 0 ? plotWidth / days.length : 0;
  const barWidth = Math.max(2, Math.min(24, band - 2));
  const y = (value: number) => TOP + HEIGHT - (value / top) * HEIGHT;
  const xOf = (index: number) => LEFT + index * band + (band - barWidth) / 2;

  const pick = (clientX: number) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect || band <= 0) return;
    const index = Math.floor((clientX - rect.left - LEFT) / band);
    setActive(index >= 0 && index < days.length ? index : null);
  };

  const onKey = (event: React.KeyboardEvent) => {
    if (days.length === 0) return;
    const current = active ?? days.length - 1;
    const next =
      event.key === "ArrowLeft"
        ? Math.max(0, current - 1)
        : event.key === "ArrowRight"
          ? Math.min(days.length - 1, current + 1)
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? days.length - 1
              : null;
    if (next === null) return;
    event.preventDefault();
    setActive(next);
  };

  const shown = active !== null ? days[active] : null;
  // Etichetele axei: prima zi, ultima și ziua de vârf — vârful doar dacă
  // nu se lovește de capete (o etichetă are ~56px).
  const peakClear =
    peak > 0 && peak < days.length - 1 && Math.abs(xOf(peak) - xOf(0)) > 64 && Math.abs(xOf(days.length - 1) - xOf(peak)) > 64;
  const labelIndexes = new Set([0, days.length - 1, ...(peakClear ? [peak] : [])].filter((index) => index >= 0));

  return (
    <figure className="min-w-0">
      <figcaption id={titleId} className="text-[13.5px] font-semibold text-bone">
        {title}
      </figcaption>
      <div
        ref={wrapRef}
        tabIndex={0}
        role="group"
        aria-labelledby={titleId}
        aria-describedby={`${titleId}-help`}
        onPointerMove={(event) => pick(event.clientX)}
        onPointerLeave={() => setActive(null)}
        onFocus={() => setActive((value) => value ?? days.length - 1)}
        onBlur={() => setActive(null)}
        onKeyDown={onKey}
        className="relative mt-3 rounded-panel-sm"
        style={{ height: HEIGHT + TOP + AXIS }}
      >
        <p id={`${titleId}-help`} className="sr-only">
          Săgețile stânga și dreapta trec de la o zi la alta. Toate cifrele sunt și în tabelul de sub grafice.
        </p>
        {width ? (
          <svg width={width} height={HEIGHT + TOP + AXIS} aria-hidden className="block overflow-visible">
            {ticks.map((tick) => (
              <g key={tick}>
                <line x1={LEFT} x2={width - 8} y1={y(tick)} y2={y(tick)} stroke="rgb(255 255 255 / 0.08)" strokeWidth={1} />
                <text
                  x={LEFT - 8}
                  y={y(tick)}
                  textAnchor="end"
                  dominantBaseline="middle"
                  className="fill-[var(--color-dim)] font-md-mono text-[10.5px]"
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {tickFormat(tick)}
                </text>
              </g>
            ))}
            {days.map((day, index) =>
              day.value > 0 ? (
                <path
                  key={day.date}
                  d={barPath(xOf(index), y(day.value), barWidth, TOP + HEIGHT - y(day.value))}
                  fill={index === active ? SERIES_ACTIVE : SERIES}
                />
              ) : null
            )}
            {days.map((day, index) =>
              labelIndexes.has(index) ? (
                <text
                  key={`label-${day.date}`}
                  x={Math.min(Math.max(xOf(index) + barWidth / 2, LEFT + 16), width - 24)}
                  y={TOP + HEIGHT + 15}
                  textAnchor="middle"
                  className="fill-[var(--color-dim)] font-md-mono text-[10.5px]"
                >
                  {formatDay(day.date)}
                </text>
              ) : null
            )}
            {active !== null ? (
              <line
                x1={xOf(active) + barWidth / 2}
                x2={xOf(active) + barWidth / 2}
                y1={TOP}
                y2={TOP + HEIGHT}
                stroke="rgb(255 255 255 / 0.18)"
                strokeWidth={1}
              />
            ) : null}
          </svg>
        ) : null}

        {shown && width ? (
          <div
            className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 whitespace-nowrap rounded-panel-sm border border-hair-strong bg-ink px-3 py-2 shadow-lg"
            style={{ left: Math.min(Math.max(xOf(active ?? 0) + barWidth / 2, 70), width - 70) }}
          >
            <p className="text-[14px] font-semibold text-bone">{format(shown.value)}</p>
            <p className="flex items-center gap-1.5 text-[12px] text-dim">
              <span aria-hidden className="inline-block h-0.5 w-3 rounded-full" style={{ background: SERIES }} />
              {formatDay(shown.date, true)}
            </p>
          </div>
        ) : null}
      </div>
      <p className="sr-only" aria-live="polite">
        {shown ? `${formatDay(shown.date, true)}: ${format(shown.value)}` : ""}
      </p>
    </figure>
  );
}
