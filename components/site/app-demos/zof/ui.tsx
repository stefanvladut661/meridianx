"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { TrendingDown, TrendingUp, Minus } from "lucide-react";
import { num } from "../kit";

/* ============================================================
   Zof Stoc Online — piesele vizuale ale demo-ului.

   Paleta e cea a aplicației reale, în modul întunecat implicit
   (shadcn/ui: background 224 71% 4%, card 224 50% 8%, primary
   221 83% 53%, accent 262 83% 58%, radius 0.75rem), scrisă aici
   ca hex, fără tokenurile site-ului.
   ============================================================ */

export const C = {
  bg: "#030711",
  panel: "#0A101F",
  panelHi: "#0E1629",
  row: "#0F1729",
  rowHi: "#131D33",
  line: "#1C2336",
  lineHi: "#283149",
  fg: "#E1E7EF",
  dim: "#808999",
  dim2: "#A3ACBB",
  primary: "#2563EB",
  blue: "#3B82F6",
  blueText: "#60A5FA",
  violet: "#7C3AED",
  violetText: "#A78BFA",
  green: "#10B981",
  greenText: "#34D399",
  red: "#EF4444",
  redText: "#F87171",
  amber: "#F59E0B",
  amberText: "#FBBF24",
  /* încasări: card / numerar / online — validate pentru daltonism */
  card: "#3B82F6",
  cash: "#B8841C",
  online: "#8B5CF6",
  compare: "#4B5670",
};

export const FONT = "var(--font-switzer), Inter, ui-sans-serif, system-ui, sans-serif";
/* ca font-mono din aplicație (stiva Tailwind implicită) */
export const MONO = "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";

/** Stilurile care nu se pot scrie ca utilitare: keyframes, scrollbar, focus. */
export const ZOF_CSS = `
.zof-root { -webkit-font-smoothing: antialiased; }
.zof-root :focus-visible { outline: 2px solid #60A5FA; outline-offset: 2px; border-radius: revert-layer; }
.zof-root ::selection { background: rgba(37,99,235,.45); color: #fff; }
.zof-scroll { scrollbar-width: thin; scrollbar-color: #283149 transparent; }
.zof-scroll::-webkit-scrollbar { width: 8px; height: 8px; }
.zof-scroll::-webkit-scrollbar-track { background: transparent; }
.zof-scroll::-webkit-scrollbar-thumb { background: #283149; border-radius: 99px; border: 2px solid transparent; background-clip: content-box; }
.zof-root input[type=search]::-webkit-search-cancel-button { -webkit-appearance: none; display: none; }
.zof-root select option { background: #0A101F; color: #E1E7EF; }
.zof-noscroll { scrollbar-width: none; }
.zof-noscroll::-webkit-scrollbar { display: none; }
@keyframes zofPing { 0% { transform: scale(1); opacity: .75 } 75%, 100% { transform: scale(2.4); opacity: 0 } }
.zof-ping { animation: zofPing 1.6s cubic-bezier(0,0,.2,1) infinite; }
@keyframes zofFlash { 0% { background-color: rgba(59,130,246,.22) } 100% { background-color: transparent } }
.zof-flash { animation: zofFlash 2.2s ease-out both; }
@keyframes zofIn { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: none } }
.zof-in { animation: zofIn .3s ease-out both; }
@keyframes zofSpin { to { transform: rotate(360deg) } }
.zof-spin { animation: zofSpin .9s linear infinite; }
@keyframes zofSlide { from { transform: translateX(24px); opacity: 0 } to { transform: none; opacity: 1 } }
.zof-slide { animation: zofSlide .24s ease-out both; }
@keyframes zofUp { from { transform: translateY(24px); opacity: 0 } to { transform: none; opacity: 1 } }
.zof-up { animation: zofUp .24s ease-out both; }
@keyframes zofFade { from { opacity: 0 } to { opacity: 1 } }
.zof-fade { animation: zofFade .2s ease-out both; }
@keyframes zofTravelX { 0% { left: 0%; opacity: 0 } 12% { opacity: 1 } 88% { opacity: 1 } 100% { left: 100%; opacity: 0 } }
@keyframes zofTravelY { 0% { top: 0%; opacity: 0 } 12% { opacity: 1 } 88% { opacity: 1 } 100% { top: 100%; opacity: 0 } }
.zof-still, .zof-still * { animation: none !important; transition: none !important; }
`;

/* ---------- formatare, ca în aplicație: „14.520 RON” ---------- */

export const ron = (n: number) => `${num(n)} RON`;
export function ronCompact(n: number) {
  if (Math.abs(n) >= 1_000_000)
    return `${(n / 1_000_000).toLocaleString("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} mil. RON`;
  if (Math.abs(n) >= 10_000) return `${(n / 1000).toLocaleString("ro-RO", { maximumFractionDigits: 1 })} mii RON`;
  return ron(n);
}
export const axisK = (v: number) =>
  v >= 1_000_000 ? `${(v / 1_000_000).toLocaleString("ro-RO", { maximumFractionDigits: 1 })}M` : v >= 1000 ? `${Math.round(v / 1000)}k` : `${Math.round(v)}`;
export const pctSigned = (v: number) =>
  `${v > 0 ? "+" : ""}${v.toLocaleString("ro-RO", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
export const clock = (t: number, sec = true) =>
  new Date(t).toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit", ...(sec ? { second: "2-digit" } : {}) });

/** „chiar acum”, „acum 12 s”, „acum 3 min” */
export function ago(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 5) return "chiar acum";
  if (s < 60) return `acum ${s} s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `acum ${m} min`;
  return `acum ${Math.floor(m / 60)} h`;
}

/* ---------- mișcare ---------- */

/**
 * Valoare care alunecă spre țintă (600ms), pornind de la 0 la montare.
 * Sub reduced motion sare direct.
 */
export function useTween(target: number, enabled: boolean, ms = 650) {
  const [v, setV] = useState(enabled ? 0 : target);
  const cur = useRef(enabled ? 0 : target);
  useEffect(() => {
    if (!enabled) {
      cur.current = target;
      setV(target);
      return;
    }
    const from = cur.current;
    const t0 = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / ms);
      const e = 1 - Math.pow(1 - k, 3);
      cur.current = from + (target - from) * e;
      setV(cur.current);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, enabled, ms]);
  return v;
}

/* ---------- piese mici ---------- */

export const CARD = "rounded-xl border border-[#1C2336] bg-[#0A101F]";

export function Card({
  children,
  className = "",
  as: Tag = "section",
  label,
}: {
  children: ReactNode;
  className?: string;
  as?: "section" | "div";
  label?: string;
}) {
  return (
    <Tag aria-label={label} className={`${CARD} ${className}`}>
      {children}
    </Tag>
  );
}

export function LiveDot({ color = C.green, still, size = 8 }: { color?: string; still?: boolean; size?: number }) {
  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }} aria-hidden>
      {!still && <span className="zof-ping absolute inset-0 rounded-full" style={{ background: color }} />}
      <span className="relative inline-flex rounded-full" style={{ width: size, height: size, background: color }} />
    </span>
  );
}

export function Trend({ value, className = "" }: { value: number | null; className?: string }) {
  if (value === null) return <span style={{ color: C.dim }}>—</span>;
  const Icon = value > 0.05 ? TrendingUp : value < -0.05 ? TrendingDown : Minus;
  const color = value > 0.05 ? C.greenText : value < -0.05 ? C.redText : C.dim;
  return (
    <span className={`inline-flex items-center gap-0.5 tabular-nums ${className}`} style={{ color }}>
      <Icon size={14} strokeWidth={2.25} aria-hidden />
      {pctSigned(value)}
    </span>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  full,
  small,
}: {
  options: { id: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
  full?: boolean;
  small?: boolean;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={`flex rounded-lg bg-[#131C34] p-0.5 ${full ? "w-full" : ""}`}
    >
      {options.map((o) => {
        const on = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(o.id)}
            className={`${full ? "flex-1" : ""} whitespace-nowrap rounded-md font-medium transition-colors duration-150 ${
              small ? "px-2.5 py-1 text-[12px]" : "px-3 py-1.5 text-[12.5px]"
            } ${on ? "bg-[#0A101F] text-[#E1E7EF] shadow-sm" : "text-[#808999] hover:text-[#E1E7EF]"}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Badge({
  children,
  color,
  bg,
  border,
  className = "",
}: {
  children: ReactNode;
  color: string;
  bg: string;
  border?: string;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[10.5px] font-semibold ${className}`}
      style={{ color, background: bg, borderColor: border ?? "transparent" }}
    >
      {children}
    </span>
  );
}

export function PageHeader({
  title,
  subtitle,
  meta,
  actions,
  mobile,
}: {
  title: string;
  subtitle?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  mobile?: boolean;
}) {
  return (
    <div className={`flex ${mobile ? "flex-col gap-3" : "items-start justify-between gap-4"} mb-5`}>
      <div className="min-w-0">
        <h1 className={`${mobile ? "text-[21px]" : "text-[24px]"} font-bold leading-tight tracking-[-0.02em]`}>{title}</h1>
        {subtitle && <p className="mt-0.5 text-[13.5px] text-[#808999]">{subtitle}</p>}
        {meta && <div className="mt-1.5">{meta}</div>}
      </div>
      {actions && <div className={`flex shrink-0 flex-wrap items-center gap-2 ${mobile ? "" : "pt-1"}`}>{actions}</div>}
    </div>
  );
}

export function Btn({
  children,
  onClick,
  variant = "outline",
  size = "sm",
  label,
  disabled,
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "outline" | "ghost";
  size?: "sm" | "xs" | "md";
  label?: string;
  disabled?: boolean;
  className?: string;
}) {
  const v =
    variant === "primary"
      ? "bg-[#2563EB] text-white hover:bg-[#1D4ED8] shadow-md shadow-[#2563EB]/20"
      : variant === "outline"
        ? "border border-[#283149] bg-[#0A101F] text-[#E1E7EF] hover:bg-[#131D33]"
        : "text-[#A3ACBB] hover:bg-[#131D33] hover:text-[#E1E7EF]";
  const s =
    size === "xs"
      ? "h-7 px-2.5 text-[11.5px] gap-1"
      : size === "md"
        ? "h-10 px-4 text-[13.5px] gap-2"
        : "h-8 px-3 text-[12.5px] gap-1.5";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      disabled={disabled}
      className={`inline-flex shrink-0 items-center justify-center rounded-lg font-medium transition-colors duration-150 disabled:cursor-default disabled:opacity-60 ${v} ${s} ${className}`}
    >
      {children}
    </button>
  );
}

/* ---------- grafice ---------- */

function niceMax(v: number) {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  const step = n <= 1.2 ? 1.2 : n <= 1.5 ? 1.5 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 3 ? 3 : n <= 4 ? 4 : n <= 5 ? 5 : n <= 6 ? 6 : n <= 8 ? 8 : 10;
  return step * p;
}

/** curbă netedă (cardinal), ca `type="monotone"` din recharts, fără să iasă sub 0 */
function smooth(pts: [number, number][], floor: number) {
  if (pts.length < 2) return pts.length ? `M${pts[0][0]},${pts[0][1]}` : "";
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const t = 0.18;
    const c1x = p1[0] + (p2[0] - p0[0]) * t;
    const c1y = Math.min(floor, p1[1] + (p2[1] - p0[1]) * t);
    const c2x = p2[0] - (p3[0] - p1[0]) * t;
    const c2y = Math.min(floor, p2[1] - (p3[1] - p1[1]) * t);
    d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d;
}

/**
 * Graficul de evoluție: o serie (suprafață) + comparația (linie
 * punctată), axă Y în HTML (textul nu se deformează la scalare),
 * cruce + tooltip la hover și la săgeți.
 */
export function TrendChart({
  values,
  compare,
  labels,
  height = 220,
  color = C.blue,
  fmt,
  fmtAxis = axisK,
  name,
  compareName,
  maxLabels = 7,
  live,
  still,
  tipLabel,
  lastX,
  partialLast,
}: {
  values: (number | null)[];
  compare?: number[];
  labels: string[];
  height?: number;
  color?: string;
  fmt: (v: number) => string;
  fmtAxis?: (v: number) => string;
  name: string;
  compareName?: string;
  maxLabels?: number;
  /** ultimul punct e „în curs” (azi) */
  live?: boolean;
  still?: boolean;
  tipLabel?: (i: number) => string;
  /** poziția fracționară a ultimului punct (ex. 9,4 = 18:24 pe axa orelor) */
  lastX?: number;
  /** ultimul punct e o perioadă neîncheiată: segment punctat, fără umplere */
  partialLast?: boolean;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const plot = useRef<HTMLDivElement>(null);
  const n = values.length;
  const H = height;
  const all = [...(values.filter((v) => v !== null) as number[]), ...(compare ?? [])];
  const max = niceMax(Math.max(1, ...all) * 1.05);
  let last = -1;
  values.forEach((v, i) => {
    if (v !== null) last = i;
  });
  const X = (i: number) =>
    n > 1 ? ((i === last && lastX !== undefined ? lastX : i) / (n - 1)) * 1000 : 500;
  const Y = (v: number) => H - (v / max) * (H - 8);
  const solidTo = partialLast && last >= 1 ? last - 1 : last;
  const pts: [number, number][] = [];
  for (let i = 0; i <= solidTo; i++) pts.push([X(i), Y(values[i] ?? 0)]);
  const line = smooth(pts, H);
  const area = pts.length ? `${line} L${X(solidTo)},${H} L0,${H} Z` : "";
  const tail =
    partialLast && last >= 1
      ? `M${X(last - 1)},${Y(values[last - 1] ?? 0)} L${X(last)},${Y(values[last] ?? 0)}`
      : "";
  const cmp = compare ? smooth(compare.map((v, i) => [X(i), Y(v)] as [number, number]), H) : "";
  const every = Math.max(1, Math.ceil(n / maxLabels));
  const gid = `zg-${name.replace(/\W/g, "")}`;

  const pick = (clientX: number) => {
    const el = plot.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const f = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    setHover(Math.round(f * (n - 1)));
  };

  // indexul poate rămâne în afara seriei când se schimbă perioada
  const hi = hover !== null && hover < n ? hover : null;
  const hv = hi !== null ? (values[hi] ?? null) : null;
  const hc = hi !== null && compare ? (compare[hi] ?? null) : null;
  const left = hi !== null ? (X(hi) / 1000) * 100 : 0;

  return (
    <div className="flex w-full select-none">
      <div className="relative w-10 shrink-0" style={{ height }} aria-hidden>
        {[1, 0.5, 0].map((k) => (
          <span
            key={k}
            className="absolute right-2 -translate-y-1/2 text-[10.5px] tabular-nums text-[#808999]"
            style={{ top: Y(max * k) }}
          >
            {fmtAxis(max * k)}
          </span>
        ))}
      </div>
      <div className="min-w-0 flex-1">
        <div
          ref={plot}
          role="img"
          tabIndex={0}
          aria-label={`${name}: ${labels[0]} – ${labels[n - 1]}. Folosește săgețile pentru valori.`}
          className="relative outline-none"
          style={{ height }}
          onPointerMove={(e) => pick(e.clientX)}
          onPointerDown={(e) => pick(e.clientX)}
          onPointerLeave={() => setHover(null)}
          onBlur={() => setHover(null)}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") setHover((h) => Math.min(n - 1, (h ?? -1) + 1));
            else if (e.key === "ArrowLeft") setHover((h) => Math.max(0, (h ?? n) - 1));
            else if (e.key === "Escape") setHover(null);
            else return;
            e.preventDefault();
          }}
        >
          <svg viewBox={`0 0 1000 ${H}`} width="100%" height={H} preserveAspectRatio="none" className="absolute inset-0 overflow-visible" aria-hidden>
            <defs>
              <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity="0.3" />
                <stop offset="95%" stopColor={color} stopOpacity="0" />
              </linearGradient>
            </defs>
            {[1, 0.5, 0].map((k) => (
              <line key={k} x1="0" x2="1000" y1={Y(max * k)} y2={Y(max * k)} stroke={C.line} strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
            ))}
            {cmp && <path d={cmp} fill="none" stroke={C.compare} strokeWidth="1.5" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />}
            {area && <path d={area} fill={`url(#${gid})`} />}
            {line && <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />}
            {tail && <path d={tail} fill="none" stroke={color} strokeWidth="2" strokeDasharray="3 4" strokeLinecap="round" vectorEffect="non-scaling-stroke" opacity="0.8" />}
          </svg>
          {/* punctul „azi”, viu */}
          {live && last >= 0 && hi === null && (
            <span
              className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${(X(last) / 1000) * 100}%`, top: Y(values[last] ?? 0) }}
            >
              <LiveDot color={color} still={still} size={9} />
            </span>
          )}
          {hi !== null && (
            <>
              <span className="pointer-events-none absolute top-0 w-px bg-[#3B4660]" style={{ left: `${left}%`, height: H }} />
              {hc !== null && (
                <span
                  className="pointer-events-none absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#0A101F]"
                  style={{ left: `${left}%`, top: Y(hc), background: C.compare }}
                />
              )}
              {hv !== null && (
                <span
                  className="pointer-events-none absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#0A101F]"
                  style={{ left: `${left}%`, top: Y(hv), background: color }}
                />
              )}
              <div
                className="pointer-events-none absolute top-1 z-10 min-w-[150px] rounded-lg border border-[#283149] bg-[#0E1629]/95 px-3 py-2 text-[11.5px] shadow-xl shadow-black/40"
                style={{
                  left: `${left}%`,
                  transform: `translateX(${left > 60 ? "calc(-100% - 10px)" : "10px"})`,
                }}
              >
                <p className="mb-1 font-semibold text-[#E1E7EF]">{tipLabel ? tipLabel(hi) : labels[hi]}</p>
                <p className="flex items-center gap-1.5 text-[#A3ACBB]">
                  <span className="size-2 rounded-full" style={{ background: color }} />
                  <span className="tabular-nums text-[#E1E7EF]">{hv === null ? "—" : fmt(hv)}</span>
                  {live && hi === last && <span className="text-[#808999]">· în curs</span>}
                </p>
                {hc !== null && compareName && (
                  <p className="mt-0.5 flex items-center gap-1.5 text-[#A3ACBB]">
                    <span className="h-0 w-2 border-t-2 border-dashed" style={{ borderColor: C.compare }} />
                    <span className="tabular-nums">{fmt(hc)}</span>
                  </p>
                )}
              </div>
            </>
          )}
        </div>
        <div className="relative mt-1.5 h-4" aria-hidden>
          {labels.map((l, i) =>
            i % every === 0 || i === n - 1 ? (
              (i === n - 1 && i % every !== 0 && (n - 1) % every < every * 0.6) ? null : (
                <span
                  key={i}
                  className="absolute whitespace-nowrap text-[10.5px] text-[#808999]"
                  style={{
                    left: `${(X(i) / 1000) * 100}%`,
                    transform: i === 0 ? "none" : i === n - 1 ? "translateX(-100%)" : "translateX(-50%)",
                  }}
                >
                  {l}
                </span>
              )
            ) : null
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Coloane (HTML, nu SVG — rămân clare la orice scalare), opțional
 * perechi cu perioada de comparație. Tooltip la hover / focus.
 */
export function Columns({
  values,
  compare,
  labels,
  height = 180,
  color = C.blue,
  fmt,
  name,
  compareName,
  current,
  fmtAxis = axisK,
}: {
  values: (number | null)[];
  compare?: number[];
  labels: string[];
  height?: number;
  color?: string;
  fmt: (v: number) => string;
  name: string;
  compareName?: string;
  /** indexul coloanei „în curs” */
  current?: number;
  fmtAxis?: (v: number) => string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const all = [...(values.filter((v) => v !== null) as number[]), ...(compare ?? [])];
  const max = niceMax(Math.max(1, ...all) * 1.04);
  const n = values.length;
  return (
    <div className="flex w-full select-none">
      <div className="relative w-10 shrink-0" style={{ height }} aria-hidden>
        {[1, 0.5, 0].map((k) => (
          <span key={k} className="absolute right-2 -translate-y-1/2 text-[10.5px] tabular-nums text-[#808999]" style={{ top: height - k * height }}>
            {fmtAxis(max * k)}
          </span>
        ))}
      </div>
      <div className="min-w-0 flex-1">
        <div className="relative" style={{ height }} role="list" aria-label={name} onPointerLeave={() => setHover(null)}>
          {[1, 0.5, 0].map((k) => (
            <span key={k} className="absolute inset-x-0 border-t border-dashed border-[#1C2336]" style={{ top: height - k * height }} aria-hidden />
          ))}
          <div className="absolute inset-0 flex items-end">
            {values.map((v, i) => {
              const c = compare?.[i];
              const on = hover === i;
              return (
                <div
                  key={i}
                  role="listitem"
                  tabIndex={0}
                  aria-label={`${labels[i]}: ${v === null ? "—" : fmt(v)}${c !== undefined && compareName ? `; ${compareName}: ${fmt(c)}` : ""}`}
                  className="relative flex h-full flex-1 items-end justify-center gap-[2px] rounded-md outline-none"
                  style={{ background: on ? "rgba(59,130,246,0.06)" : undefined }}
                  onPointerEnter={() => setHover(i)}
                  onFocus={() => setHover(i)}
                  onBlur={() => setHover(null)}
                >
                  {c !== undefined && (
                    <span
                      className="block w-[34%] max-w-[14px] rounded-t-[3px]"
                      style={{ height: `${(c / max) * 100}%`, background: C.compare, opacity: on ? 1 : 0.8 }}
                    />
                  )}
                  <span
                    className="block rounded-t-[4px]"
                    style={{
                      width: c !== undefined ? "34%" : "62%",
                      maxWidth: c !== undefined ? 14 : 28,
                      height: `${((v ?? 0) / max) * 100}%`,
                      background: color,
                      opacity: current === i ? 0.55 : on || hover === null ? 1 : 0.75,
                      backgroundImage:
                        current === i
                          ? "repeating-linear-gradient(135deg, rgba(255,255,255,.22) 0 3px, transparent 3px 7px)"
                          : undefined,
                    }}
                  />
                  {on && (
                    <div
                      className="pointer-events-none absolute bottom-full z-10 mb-1 min-w-[132px] rounded-lg border border-[#283149] bg-[#0E1629]/95 px-2.5 py-1.5 text-[11px] shadow-xl shadow-black/40"
                      style={{
                        left: "50%",
                        transform: `translateX(${i < n / 4 ? "-20%" : i > (3 * n) / 4 ? "-80%" : "-50%"})`,
                      }}
                    >
                      <p className="font-semibold text-[#E1E7EF]">
                        {labels[i]}
                        {current === i && <span className="font-normal text-[#808999]"> · în curs</span>}
                      </p>
                      <p className="mt-0.5 flex items-center gap-1.5 tabular-nums text-[#E1E7EF]">
                        <span className="size-2 rounded-full" style={{ background: color }} />
                        {v === null ? "—" : fmt(v)}
                      </p>
                      {c !== undefined && (
                        <p className="flex items-center gap-1.5 tabular-nums text-[#A3ACBB]">
                          <span className="size-2 rounded-full" style={{ background: C.compare }} />
                          {fmt(c)}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        <div className="mt-1.5 flex" aria-hidden>
          {labels.map((l, i) => (
            <span key={i} className="flex-1 truncate text-center text-[10.5px] text-[#808999]">
              {n > 14 && i % 2 ? "" : l}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Bară orizontală simplă (0–100%). */
export function Meter({ value, color = C.blue, track = "#131C34", h = 6 }: { value: number; color?: string; track?: string; h?: number }) {
  return (
    <span className="block w-full overflow-hidden rounded-full" style={{ height: h, background: track }} aria-hidden>
      <span
        className="block h-full rounded-full transition-[width] duration-700 ease-out"
        style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color }}
      />
    </span>
  );
}

/** Legendă: punct colorat + etichetă (textul rămâne în culoarea textului). */
export function Legend({ items }: { items: { label: string; color: string; dashed?: boolean }[] }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[#A3ACBB]">
      {items.map((it) => (
        <li key={it.label} className="flex items-center gap-1.5">
          {it.dashed ? (
            <span className="w-3 border-t-2 border-dashed" style={{ borderColor: it.color }} aria-hidden />
          ) : (
            <span className="size-2 rounded-full" style={{ background: it.color }} aria-hidden />
          )}
          {it.label}
        </li>
      ))}
    </ul>
  );
}

/** Trei cifre sub un grafic: vârful, media, estimarea. */
export function StatStrip({ items, small }: { items: { k: string; v: string; sub?: string; color?: string }[]; small?: boolean }) {
  return (
    <dl className="mt-4 grid grid-cols-3 divide-x divide-[#1C2336] border-t border-[#1C2336] pt-3">
      {items.map((it) => (
        <div key={it.k} className={`min-w-0 first:pl-0 last:pr-0 ${small ? "px-2" : "px-3"}`}>
          <dt className="text-[11px] leading-tight text-[#808999]">{it.k}</dt>
          <dd className={`mt-0.5 truncate font-bold tabular-nums ${small ? "text-[13px]" : "text-[15px]"}`} style={{ color: it.color }}>
            {it.v}
          </dd>
          {it.sub && <dd className="truncate text-[10.5px] text-[#808999]">{it.sub}</dd>}
        </div>
      ))}
    </dl>
  );
}

/** Logo-ul aplicației: pătratul albastru cu „Z”. */
export function ZofMark({ size = 32 }: { size?: number }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-lg bg-[#2563EB] font-bold text-white"
      style={{ width: size, height: size, fontSize: size * 0.44 }}
      aria-hidden
    >
      Z
    </span>
  );
}
