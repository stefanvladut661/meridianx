"use client";

import { useEffect, useId, useRef, useState } from "react";

/* ============================================================
   Trusa comună a demo-urilor: formatare, date „vii”, grafice SVG.

   Folosită de toate demo-urile din app-demos/<slug>/. Nu conține
   stiluri de marcă: culorile vin mereu prin props, ca fiecare demo
   să arate ca aplicația lui, nu ca MERIDIAN.
   ============================================================ */

/* ---------- formatare, în română ---------- */

const nf0 = new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 0 });
const nf2 = new Intl.NumberFormat("ro-RO", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** 1234567 → „1.234.567” */
export const num = (n: number) => nf0.format(Math.round(n));
/** 1234.5 → „1.234,50” */
export const dec = (n: number) => nf2.format(n);
/** 1234567 → „1.234.567 lei” */
export const lei = (n: number) => `${nf0.format(Math.round(n))} lei`;
/** 12.345 → „12,3%” */
export const pct = (n: number, digits = 1) =>
  `${n.toLocaleString("ro-RO", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}%`;
/** 1_250_000 → „1,25 mil.”, 48_300 → „48,3 mii” */
export function compact(n: number): string {
  if (Math.abs(n) >= 1_000_000)
    return `${(n / 1_000_000).toLocaleString("ro-RO", { maximumFractionDigits: 2 })} mil.`;
  if (Math.abs(n) >= 10_000)
    return `${(n / 1000).toLocaleString("ro-RO", { maximumFractionDigits: 1 })} mii`;
  return nf0.format(n);
}

/* ---------- aleator, dar determinist ----------
   Aceleași date la fiecare încărcare: capturile de ecran și turul
   ghidat arată mereu la fel. */
export function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Serie de `n` valori care urcă ușor, cu zgomot. Pentru grafice. */
export function series(
  n: number,
  { seed = 1, start = 100, drift = 0.03, noise = 0.12 } = {}
): number[] {
  const r = rng(seed);
  const out: number[] = [];
  let v = start;
  for (let i = 0; i < n; i++) {
    v = v * (1 + drift) * (1 + (r() - 0.5) * noise);
    out.push(v);
  }
  return out;
}

/* ---------- viață ---------- */

/** setInterval legat de ciclul de viață; oprit când `enabled` e fals. */
export function useInterval(cb: () => void, ms: number, enabled = true) {
  const saved = useRef(cb);
  useEffect(() => {
    saved.current = cb;
  }, [cb]);
  useEffect(() => {
    if (!enabled) return;
    const id = window.setInterval(() => saved.current(), ms);
    return () => window.clearInterval(id);
  }, [ms, enabled]);
}

/**
 * Un număr care „trăiește”: la fiecare `ms`, `step(v)` îi dă valoarea
 * următoare. Sub reduced motion rămâne fix.
 */
export function useLiveNumber(
  initial: number,
  step: (v: number) => number,
  ms: number,
  enabled = true
) {
  const [v, setV] = useState(initial);
  useInterval(() => setV(step), ms, enabled);
  return v;
}

/**
 * Un flux de evenimente: la fiecare `ms`, `make(i)` produce un element
 * nou care intră primul în listă; lista rămâne la `max` elemente.
 */
export function useLiveFeed<T>(
  seed: T[],
  make: (i: number) => T,
  ms: number,
  { max = 8, enabled = true } = {}
) {
  const [items, setItems] = useState(seed);
  const i = useRef(0);
  useInterval(
    () => setItems((xs) => [make(i.current++), ...xs].slice(0, max)),
    ms,
    enabled
  );
  return items;
}

/** Numără de la 0 la `to` la montare (sau sare direct, sub reduced motion). */
export function useCountUp(to: number, ms = 900, enabled = true) {
  const [v, setV] = useState(enabled ? 0 : to);
  useEffect(() => {
    if (!enabled) {
      setV(to);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / ms);
      setV(to * (1 - Math.pow(1 - k, 3)));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, ms, enabled]);
  return v;
}

/* ---------- grafice SVG ----------
   Fără librărie: fiecare grafic e un <svg> cu viewBox propriu,
   întins pe lățimea părintelui (`width="100%"`). */

function scale(values: number[], h: number, pad = 4) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  return (v: number) => pad + (h - pad * 2) * (1 - (v - min) / span);
}

function path(values: number[], w: number, h: number, pad = 4) {
  const y = scale(values, h, pad);
  const dx = values.length > 1 ? w / (values.length - 1) : 0;
  return values
    .map((v, i) => `${i ? "L" : "M"}${(i * dx).toFixed(1)},${y(v).toFixed(1)}`)
    .join(" ");
}

export function Sparkline({
  values,
  color,
  width = 120,
  height = 36,
  strokeWidth = 2,
  fill = true,
}: {
  values: number[];
  color: string;
  width?: number;
  height?: number;
  strokeWidth?: number;
  fill?: boolean;
}) {
  const id = useId();
  const d = path(values, width, height);
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height={height}
      preserveAspectRatio="none"
      aria-hidden
    >
      {fill && (
        <>
          <defs>
            <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.28" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={`${d} L${width},${height} L0,${height} Z`} fill={`url(#${id})`} />
        </>
      )}
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/**
 * Grafic de suprafață cu una sau două serii, grilă orizontală și
 * etichete pe axa X. `labels.length` trebuie să fie egal cu lungimea
 * seriilor.
 */
export function AreaChart({
  series: data,
  labels,
  height = 220,
  grid = "rgba(128,128,128,0.15)",
  labelColor = "rgba(128,128,128,0.9)",
  fontSize = 11,
}: {
  series: { values: number[]; color: string; dashed?: boolean }[];
  labels?: string[];
  height?: number;
  grid?: string;
  labelColor?: string;
  fontSize?: number;
}) {
  const id = useId();
  const W = 600;
  const H = height;
  const bottom = labels ? 22 : 0;
  const all = data.flatMap((s) => s.values);
  const min = Math.min(...all) * 0.92;
  const max = Math.max(...all) * 1.04;
  const y = (v: number) => 6 + (H - bottom - 12) * (1 - (v - min) / (max - min || 1));
  const n = data[0]?.values.length ?? 0;
  const x = (i: number) => (n > 1 ? (i * W) / (n - 1) : 0);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" aria-hidden>
      {[0, 1, 2, 3].map((g) => {
        const gy = 6 + ((H - bottom - 12) * g) / 3;
        return <line key={g} x1="0" x2={W} y1={gy} y2={gy} stroke={grid} strokeWidth="1" vectorEffect="non-scaling-stroke" />;
      })}
      {data.map((s, si) => {
        const d = s.values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
        return (
          <g key={si}>
            {!s.dashed && (
              <>
                <defs>
                  <linearGradient id={`${id}-${si}`} x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor={s.color} stopOpacity="0.25" />
                    <stop offset="100%" stopColor={s.color} stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d={`${d} L${W},${H - bottom} L0,${H - bottom} Z`} fill={`url(#${id}-${si})`} />
              </>
            )}
            <path
              d={d}
              fill="none"
              stroke={s.color}
              strokeWidth="2.25"
              strokeDasharray={s.dashed ? "5 5" : undefined}
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          </g>
        );
      })}
      {labels?.map((l, i) =>
        i % Math.ceil(labels.length / 8) === 0 ? (
          <text
            key={i}
            x={x(i)}
            y={H - 5}
            fill={labelColor}
            fontSize={fontSize}
            textAnchor={i === 0 ? "start" : i === labels.length - 1 ? "end" : "middle"}
          >
            {l}
          </text>
        ) : null
      )}
    </svg>
  );
}

export function BarChart({
  values,
  labels,
  color,
  muted,
  highlight,
  height = 160,
  labelColor = "rgba(128,128,128,0.9)",
  fontSize = 11,
  radius = 4,
}: {
  values: number[];
  labels?: string[];
  color: string;
  /** Culoarea barelor ne-evidențiate; implicit `color`. */
  muted?: string;
  /** Indexul barei evidențiate. */
  highlight?: number;
  height?: number;
  labelColor?: string;
  fontSize?: number;
  radius?: number;
}) {
  const W = 600;
  const bottom = labels ? 20 : 0;
  const max = Math.max(...values) || 1;
  const slot = W / values.length;
  const bw = slot * 0.62;
  return (
    <svg viewBox={`0 0 ${W} ${height}`} width="100%" height={height} preserveAspectRatio="none" aria-hidden>
      {values.map((v, i) => {
        const h = ((height - bottom - 4) * v) / max;
        return (
          <rect
            key={i}
            x={i * slot + (slot - bw) / 2}
            y={height - bottom - h}
            width={bw}
            height={h}
            rx={radius}
            fill={highlight === undefined || highlight === i ? color : (muted ?? color)}
          />
        );
      })}
      {labels?.map((l, i) => (
        <text key={i} x={i * slot + slot / 2} y={height - 5} fill={labelColor} fontSize={fontSize} textAnchor="middle">
          {l}
        </text>
      ))}
    </svg>
  );
}

export function Donut({
  parts,
  size = 140,
  thickness = 18,
  track = "rgba(128,128,128,0.15)",
  children,
}: {
  parts: { value: number; color: string }[];
  size?: number;
  thickness?: number;
  track?: string;
  /** Conținut în centru (cifra mare). */
  children?: React.ReactNode;
}) {
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const total = parts.reduce((a, p) => a + p.value, 0) || 1;
  let acc = 0;
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={thickness} />
        {parts.map((p, i) => {
          const len = (p.value / total) * c;
          const el = (
            <circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={p.color}
              strokeWidth={thickness}
              strokeDasharray={`${Math.max(0, len - 2)} ${c}`}
              strokeDashoffset={-acc}
            />
          );
          acc += len;
          return el;
        })}
      </svg>
      {children && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
          {children}
        </div>
      )}
    </div>
  );
}

/**
 * Bara de stare iOS pentru layout-ul de telefon: 44px, ora în stânga,
 * semnal/wifi/baterie în dreapta, mijlocul liber pentru insula dinamică.
 * `tone="light"` = text alb (pe header închis), `"dark"` = text negru.
 */
export function StatusBar({ tone = "dark", bg }: { tone?: "light" | "dark"; bg?: string }) {
  const c = tone === "light" ? "#fff" : "#000";
  return (
    <div
      aria-hidden
      style={{
        height: 44,
        flexShrink: 0,
        background: bg,
        color: c,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "4px 30px 0 34px",
        fontFamily: "-apple-system, 'SF Pro Text', system-ui, sans-serif",
        fontWeight: 600,
        fontSize: 15,
        letterSpacing: "-0.01em",
      }}
    >
      <span>9:41</span>
      <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <svg width="18" height="11" viewBox="0 0 18 11" fill={c}>
          <rect x="0" y="7" width="3" height="4" rx="1" />
          <rect x="5" y="5" width="3" height="6" rx="1" />
          <rect x="10" y="2.5" width="3" height="8.5" rx="1" />
          <rect x="15" y="0" width="3" height="11" rx="1" />
        </svg>
        <svg width="16" height="11" viewBox="0 0 16 11" fill={c}>
          <path d="M8 2.2c2.3 0 4.4.9 6 2.4l1.1-1.1A10 10 0 0 0 8 .6 10 10 0 0 0 .9 3.5L2 4.6a8.4 8.4 0 0 1 6-2.4Zm0 3.2c1.4 0 2.7.5 3.7 1.4l1.1-1.1A7 7 0 0 0 8 3.8a7 7 0 0 0-4.8 1.9l1.1 1.1c1-.9 2.3-1.4 3.7-1.4Zm0 3.2c.6 0 1.1.2 1.5.6L8 10.7 6.5 9.2c.4-.4.9-.6 1.5-.6Z" />
        </svg>
        <svg width="26" height="12" viewBox="0 0 26 12" fill="none">
          <rect x="0.5" y="0.5" width="22" height="11" rx="3.5" stroke={c} strokeOpacity="0.4" />
          <rect x="2" y="2" width="19" height="8" rx="2" fill={c} />
          <path d="M24 4v4c.8-.3 1.3-1.1 1.3-2S24.8 4.3 24 4Z" fill={c} fillOpacity="0.4" />
        </svg>
      </span>
    </div>
  );
}

/** Cod QR decorativ, determinist (nu se poate scana — e demo). */
export function FakeQR({ size = 160, color = "#000", seed = 7 }: { size?: number; color?: string; seed?: number }) {
  const n = 25;
  const r = rng(seed);
  const cells: [number, number][] = [];
  const finder = (x: number, y: number) =>
    (x < 7 && y < 7) || (x >= n - 7 && y < 7) || (x < 7 && y >= n - 7);
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) if (!finder(x, y) && r() > 0.52) cells.push([x, y]);
  const u = size / n;
  const Finder = ({ x, y }: { x: number; y: number }) => (
    <g>
      <rect x={x * u} y={y * u} width={7 * u} height={7 * u} fill={color} rx={u} />
      <rect x={(x + 1) * u} y={(y + 1) * u} width={5 * u} height={5 * u} fill="#fff" rx={u * 0.6} />
      <rect x={(x + 2) * u} y={(y + 2) * u} width={3 * u} height={3 * u} fill={color} rx={u * 0.5} />
    </g>
  );
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
      <rect width={size} height={size} fill="#fff" />
      {cells.map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x * u} y={y * u} width={u} height={u} fill={color} />
      ))}
      <Finder x={0} y={0} />
      <Finder x={n - 7} y={0} />
      <Finder x={0} y={n - 7} />
    </svg>
  );
}
