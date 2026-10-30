"use client";

import { useEffect, useId, useRef, useState } from "react";
import { formatAmount, formatCount, formatDay } from "@/lib/ads/metrics";
import { EYEBROW } from "./tone";

/**
 * O măsură pe zile, ca graficul de arie din prototip (`TrendArea`): linie
 * netezită cu degrade dedesubt, grilă fină, fișa zilei la trecerea mouse-ului.
 * SVG simplu, fără pachete. O singură serie, o singură axă: cheltuiala și
 * rezultatele stau în grafice separate, ca să nu inducă în eroare.
 *
 * Fără mouse: săgețile stânga/dreapta (și Home/End) trec de la o zi la alta,
 * iar ziua aleasă se anunță cu `aria-live`. Tabelul cu cifrele pe zile de sub
 * grafic e drumul fără grafic.
 */

const HEIGHT = 150;
const AXIS = 22;
const LEFT = 48;
const RIGHT = 8;
const TOP = 10;
const GRID = "rgba(255,255,255,0.055)";
const TICK = "rgba(255,255,255,0.42)";

export interface ChartDay {
  date: string;
  value: number;
}

/** Ce fel de număr e: bani (în moneda contului) sau o numărătoare. */
export type ChartUnit = { type: "money"; currency: string } | { type: "count" };

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

/** Curba netezită prin puncte (Hermite monoton): nu depășește niciodată valorile reale. */
function smoothPath(points: Array<[number, number]>): string {
  const n = points.length;
  if (n === 0) return "";
  if (n === 1) return `M${points[0][0]},${points[0][1]}`;
  const dx: number[] = [];
  const slope: number[] = [];
  for (let i = 0; i < n - 1; i += 1) {
    dx.push(points[i + 1][0] - points[i][0]);
    slope.push((points[i + 1][1] - points[i][1]) / (dx[i] || 1));
  }
  const tangent: number[] = [slope[0]];
  for (let i = 1; i < n - 1; i += 1) {
    tangent.push(slope[i - 1] * slope[i] <= 0 ? 0 : (slope[i - 1] + slope[i]) / 2);
  }
  tangent.push(slope[n - 2]);
  for (let i = 0; i < n - 1; i += 1) {
    if (slope[i] === 0) {
      tangent[i] = 0;
      tangent[i + 1] = 0;
      continue;
    }
    const a = tangent[i] / slope[i];
    const b = tangent[i + 1] / slope[i];
    const sum = a * a + b * b;
    if (sum > 9) {
      const scale = 3 / Math.sqrt(sum);
      tangent[i] = scale * a * slope[i];
      tangent[i + 1] = scale * b * slope[i];
    }
  }
  let path = `M${points[0][0]},${points[0][1]}`;
  for (let i = 0; i < n - 1; i += 1) {
    const h = dx[i] / 3;
    path += ` C${points[i][0] + h},${points[i][1] + tangent[i] * h} ${points[i + 1][0] - h},${points[i + 1][1] - tangent[i + 1] * h} ${points[i + 1][0]},${points[i + 1][1]}`;
  }
  return path;
}

const shortNumber = new Intl.NumberFormat("ro-RO", { notation: "compact", maximumFractionDigits: 1 });

export function DayChart({
  title,
  days,
  unit,
  withTable = true,
  color = "#C6B5FF",
  name,
  height = HEIGHT,
}: {
  title: string;
  days: ChartDay[];
  unit: ChartUnit;
  /** Există un tabel cu aceleași cifre sub grafic (fișa campaniei, Statistici). */
  withTable?: boolean;
  /** Lavanda pentru cheltuială, caisa pentru rezultate, ca în prototip. */
  color?: string;
  /** Numele seriei din fișa zilei; implicit titlul. */
  name?: string;
  height?: number;
}) {
  const format = (value: number) => (unit.type === "money" ? formatAmount(value, unit.currency) : formatCount(value));
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState<number | null>(null);
  const [active, setActive] = useState<number | null>(null);
  const titleId = useId();
  const gradientId = `${titleId.replace(/:/g, "")}-g`;

  useEffect(() => {
    const element = wrapRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const max = Math.max(0, ...days.map((day) => day.value));
  const { top, ticks } = niceMax(max);

  const plotWidth = width ? Math.max(0, width - LEFT - RIGHT) : 0;
  const stepX = days.length > 1 ? plotWidth / (days.length - 1) : 0;
  const xOf = (index: number) => (days.length > 1 ? LEFT + index * stepX : LEFT + plotWidth / 2);
  const y = (value: number) => TOP + height - (value / top) * height;
  const points: Array<[number, number]> = days.map((day, index) => [xOf(index), y(day.value)]);
  const line = smoothPath(points);
  const baseline = TOP + height;
  const area = points.length > 1 ? `${line} L${points[points.length - 1][0]},${baseline} L${points[0][0]},${baseline} Z` : "";

  const pick = (clientX: number) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect || days.length === 0) return;
    const raw = stepX > 0 ? Math.round((clientX - rect.left - LEFT) / stepX) : 0;
    setActive(Math.min(days.length - 1, Math.max(0, raw)));
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
  // Etichetele axei: prima zi, ultima și, dacă încape, una la mijloc.
  const middle = Math.floor((days.length - 1) / 2);
  const labelIndexes = new Set([0, days.length - 1, ...(plotWidth > 360 && days.length > 4 ? [middle] : [])].filter((index) => index >= 0));

  return (
    <figure className="min-w-0">
      <figcaption id={titleId} className={EYEBROW}>
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
        className="relative mt-2 rounded-lg"
        style={{ height: height + TOP + AXIS }}
      >
        <p id={`${titleId}-help`} className="sr-only">
          Săgețile stânga și dreapta trec de la o zi la alta.{withTable ? " Toate cifrele sunt și în tabelul de sub grafice." : ""}
        </p>
        {width ? (
          <svg width={width} height={height + TOP + AXIS} aria-hidden className="block overflow-visible">
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.24} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            {ticks.map((tick) => (
              <g key={tick}>
                <line x1={LEFT} x2={width - RIGHT} y1={y(tick)} y2={y(tick)} stroke={GRID} strokeWidth={1} />
                <text x={LEFT - 8} y={y(tick)} textAnchor="end" dominantBaseline="middle" fill={TICK} fontSize={10.5} style={{ fontVariantNumeric: "tabular-nums" }}>
                  {shortNumber.format(tick)}
                </text>
              </g>
            ))}
            {area ? <path d={area} fill={`url(#${gradientId})`} /> : null}
            {line && points.length > 1 ? <path d={line} fill="none" stroke={color} strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" /> : null}
            {points.length === 1 ? <circle cx={points[0][0]} cy={points[0][1]} r={3} fill={color} /> : null}
            {days.map((day, index) =>
              labelIndexes.has(index) ? (
                <text
                  key={`label-${day.date}`}
                  x={Math.min(Math.max(xOf(index), LEFT + 12), width - 24)}
                  y={TOP + height + 16}
                  textAnchor={index === 0 ? "start" : index === days.length - 1 ? "end" : "middle"}
                  fill={TICK}
                  fontSize={10.5}
                >
                  {formatDay(day.date)}
                </text>
              ) : null
            )}
            {active !== null && points[active] ? (
              <>
                <line x1={points[active][0]} x2={points[active][0]} y1={TOP} y2={baseline} stroke="rgba(255,255,255,0.16)" strokeWidth={1} />
                <circle cx={points[active][0]} cy={points[active][1]} r={3.5} fill={color} />
              </>
            ) : null}
          </svg>
        ) : null}

        {shown && width ? (
          <div
            className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 whitespace-nowrap rounded-xl border border-white/[0.1] bg-[#08080B] px-3 py-2 shadow-[0_16px_40px_-16px_rgba(0,0,0,0.9)]"
            style={{ left: Math.min(Math.max(xOf(active ?? 0), 72), width - 72) }}
          >
            <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">{formatDay(shown.date, true)}</p>
            <p className="pu-num flex items-center gap-2 text-[12.5px] text-foreground">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} aria-hidden="true" />
              <span className="text-muted-foreground">{name ?? title}</span>
              <span className="ml-auto font-medium">{format(shown.value)}</span>
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
