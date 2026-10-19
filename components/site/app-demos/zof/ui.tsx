"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { ChevronDown, Info, Minus, Search, TrendingDown, TrendingUp, X } from "lucide-react";
import { num } from "../kit";

/* ============================================================
   Zof Stoc Online — piesele vizuale ale demo-ului.

   Culorile sunt cele din aplicația reală (src/index.css): tema
   luminoasă din :root, cu care se deschide demo-ul, și tema
   întunecată din .dark, pe care o pornește butonul din meniu.
   Stau o singură dată, ca variabile CSS pe .zof-root; restul
   fișierelor le citesc prin `C` sau prin clase `bg-(--z-…)`.

   Abateri mici, făcute pentru contrast AA: textul secundar e cu
   1% mai închis decât muted-foreground (pe fundalul gri al paginii
   ajunge la 4,6:1), iar starea „critic” are două nuanțe: roșul-600
   pentru puncte și bare, roșul-700 pentru text pe fond roz.
   ============================================================ */

export const C = {
  bg: "var(--z-bg)",
  surface: "var(--z-surface)",
  surface2: "var(--z-surface-2)",
  muted: "var(--z-muted)",
  border: "var(--z-border)",
  borderStrong: "var(--z-border-strong)",
  fg: "var(--z-fg)",
  fg2: "var(--z-fg-2)",
  fg3: "var(--z-fg-3)",
  primary: "var(--z-primary)",
  primaryText: "var(--z-primary-text)",
  primarySoft: "var(--z-primary-soft)",
  ok: "var(--z-ok)",
  okDot: "var(--z-ok-dot)",
  warn: "var(--z-warn)",
  warnSoft: "var(--z-warn-soft)",
  warnDot: "var(--z-warn-dot)",
  crit: "var(--z-crit)",
  critText: "var(--z-crit-text)",
  critSoft: "var(--z-crit-soft)",
  compare: "var(--z-compare)",
  compareBar: "var(--z-compare-bar)",
  /* încasări: card / numerar / online — trei nuanțe ale aceluiași albastru */
  card: "var(--z-pay-card)",
  cash: "var(--z-pay-cash)",
  online: "var(--z-pay-online)",
};

export const FONT = "var(--font-zof), ui-sans-serif, system-ui, sans-serif";
/* ca font-mono din aplicație (stiva Tailwind implicită): doar pentru SKU, bonuri, agenți, fișiere */
export const MONO = "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";

/** Tokenurile celor două teme + ce nu se poate scrie ca utilitar. */
export const ZOF_CSS = `
.zof-root {
  --z-bg: #F3F4F6; --z-surface: #FFFFFF; --z-surface-2: #F9FAFB; --z-muted: #E8EAED; --z-hover: #F3F4F6;
  --z-border: #E5E7EB; --z-border-strong: #D1D5DB;
  --z-fg: #0F172A; --z-fg-2: #4B5563; --z-fg-3: #686F7D;
  --z-primary: #2563EB; --z-primary-hover: #1D4ED8; --z-primary-text: #2563EB; --z-primary-soft: #EFF6FF;
  --z-ok: #047857; --z-ok-dot: #10B981;
  --z-warn: #B45309; --z-warn-soft: #FFFBEB; --z-warn-dot: #F59E0B;
  --z-crit: #DC2626; --z-crit-text: #B91C1C; --z-crit-soft: #FEF2F2;
  --z-count: #DC2626;
  --z-compare: #8A8F98; --z-compare-bar: #CDD1D8;
  --z-pay-card: #2563EB; --z-pay-cash: #60A5FA; --z-pay-online: #BFDBFE;
  --z-ring: #2563EB; --z-selection: rgba(37,99,235,.18);
  --z-scrim: rgba(15,23,42,.32);
  --z-pop: 0 12px 32px -12px rgba(15,23,42,.25);
  --z-tip: 0 6px 16px -6px rgba(15,23,42,.18);
  --z-seg: 0 1px 2px rgba(15,23,42,.08);
  color-scheme: light;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
.zof-root[data-theme="dark"] {
  --z-bg: #030711; --z-surface: #0A101F; --z-surface-2: #0E1629; --z-muted: #131C34; --z-hover: #131C34;
  --z-border: #1C2336; --z-border-strong: #283149;
  --z-fg: #E1E7EF; --z-fg-2: #A3ACBB; --z-fg-3: #808999;
  --z-primary: #2563EB; --z-primary-hover: #1D4ED8; --z-primary-text: #60A5FA; --z-primary-soft: rgba(37,99,235,.16);
  --z-ok: #34D399; --z-ok-dot: #10B981;
  --z-warn: #FBBF24; --z-warn-soft: rgba(245,158,11,.12); --z-warn-dot: #F59E0B;
  --z-crit: #F87171; --z-crit-text: #F87171; --z-crit-soft: rgba(239,68,68,.12);
  --z-compare: #4B5670; --z-compare-bar: #2A3450;
  --z-pay-card: #3B82F6; --z-pay-cash: #93C5FD; --z-pay-online: #1E40AF;
  --z-ring: #60A5FA; --z-selection: rgba(37,99,235,.45);
  --z-scrim: rgba(0,0,0,.55);
  --z-pop: 0 12px 32px -12px rgba(0,0,0,.6);
  --z-tip: 0 6px 16px -6px rgba(0,0,0,.5);
  --z-seg: none;
  color-scheme: dark;
}
.zof-root :focus-visible { outline: 2px solid var(--z-ring); outline-offset: 2px; }
.zof-root input:focus-visible, .zof-root select:focus-visible { outline-offset: 0; }
.zof-root ::selection { background: var(--z-selection); }
.zof-scroll { scrollbar-width: thin; scrollbar-color: var(--z-border-strong) transparent; }
.zof-scroll::-webkit-scrollbar { width: 8px; height: 8px; }
.zof-scroll::-webkit-scrollbar-track { background: transparent; }
.zof-scroll::-webkit-scrollbar-thumb { background: var(--z-border-strong); border-radius: 99px; border: 2px solid transparent; background-clip: content-box; }
.zof-root input[type=search]::-webkit-search-cancel-button { -webkit-appearance: none; display: none; }
.zof-root select option { background: var(--z-surface); color: var(--z-fg); }
.zof-noscroll { scrollbar-width: none; }
.zof-noscroll::-webkit-scrollbar { display: none; }
@keyframes zofSpin { to { transform: rotate(360deg) } }
.zof-spin { animation: zofSpin .9s linear infinite; }
@keyframes zofSlide { from { transform: translateX(24px); opacity: 0 } to { transform: none; opacity: 1 } }
.zof-slide { animation: zofSlide .24s ease-out both; }
@keyframes zofUp { from { transform: translateY(24px); opacity: 0 } to { transform: none; opacity: 1 } }
.zof-up { animation: zofUp .24s ease-out both; }
@keyframes zofFade { from { opacity: 0 } to { opacity: 1 } }
.zof-fade { animation: zofFade .2s ease-out both; }
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
/** „+8,2%”, „−1,1%” (minus tipografic, nu cratimă) */
export const pctSigned = (v: number) =>
  `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toLocaleString("ro-RO", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
export const pct1 = (v: number) => `${v.toLocaleString("ro-RO", { maximumFractionDigits: 1 })}%`;
/** Ora, fără secunde: „18:24”. */
export const clock = (t: number) => new Date(t).toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" });
/** Minute întregi scurse (minim 1), pentru „fără semnal de 3 min”. */
export const minsSince = (ms: number) => Math.max(1, Math.floor(ms / 60_000));

/**
 * Acordul numeralului: „1 bon”, „3 bonuri”, „147 de bonuri”, „101 bonuri”.
 * `one` și `many` pot purta și participiul: plural(n, "bon importat", "bonuri importate").
 */
export function plural(n: number, one: string, many: string) {
  if (n === 1) return `1 ${one}`;
  const r = Math.round(n) % 100;
  const de = n >= 20 && (r === 0 || r >= 20);
  return `${num(n)} ${de ? "de " : ""}${many}`;
}

/* ---------- piese mici ---------- */

export const CARD = "rounded-xl border border-(--z-border) bg-(--z-surface)";

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

/** Punct de stare, static (8px). Însoțește mereu un cuvânt. */
export function Dot({ tone = "ok", size = 8 }: { tone?: "ok" | "warn" | "crit" | "off"; size?: number }) {
  const bg = tone === "ok" ? C.okDot : tone === "warn" ? C.warnDot : tone === "crit" ? C.crit : C.fg3;
  return <span className="inline-block shrink-0 rounded-full" style={{ width: size, height: size, background: bg }} aria-hidden />;
}

export function Trend({ value, className = "", size = 14 }: { value: number | null; className?: string; size?: number }) {
  if (value === null) return <span className="text-(--z-fg-3)">—</span>;
  const up = value > 0.05;
  const down = value < -0.05;
  const Icon = up ? TrendingUp : down ? TrendingDown : Minus;
  return (
    <span
      className={`inline-flex items-center gap-0.5 tabular-nums ${up ? "text-(--z-ok)" : down ? "text-(--z-crit)" : "text-(--z-fg-3)"} ${className}`}
    >
      <Icon size={size} strokeWidth={2} aria-hidden />
      {pctSigned(value)}
    </span>
  );
}

/** Doar săgeata (în tabele, lângă o valoare). Stabil = nimic. */
export function TrendArrow({ trend, size = 13 }: { trend: "up" | "down" | "stable"; size?: number }) {
  if (trend === "stable") return null;
  const Icon = trend === "up" ? TrendingUp : TrendingDown;
  return (
    <span role="img" aria-label={trend === "up" ? "Creștere" : "Scădere"} className={`inline-flex ${trend === "up" ? "text-(--z-ok)" : "text-(--z-crit)"}`}>
      <Icon size={size} strokeWidth={2} aria-hidden />
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
    <div role="group" aria-label={label} className={`${full ? "flex w-full" : "inline-flex"} shrink-0 rounded-lg bg-(--z-muted) p-0.5`}>
      {options.map((o) => {
        const on = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(o.id)}
            className={`${full ? "flex-1" : ""} whitespace-nowrap rounded-md font-medium transition-colors duration-150 ${
              small ? "h-7 px-2.5 text-[12px]" : "h-8 px-3 text-[13px]"
            } ${on ? "bg-(--z-surface) text-(--z-fg)" : "text-(--z-fg-2) hover:text-(--z-fg)"}`}
            style={on ? { boxShadow: "var(--z-seg)" } : undefined}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

const BADGE = {
  warn: "bg-(--z-warn-soft) text-(--z-warn)",
  crit: "bg-(--z-crit-soft) text-(--z-crit-text)",
  info: "bg-(--z-primary-soft) text-(--z-primary-text)",
  neutral: "bg-(--z-muted) text-(--z-fg-2)",
} as const;

/** Etichetă de stare, doar pentru excepții. */
export function Badge({ tone, children, className = "" }: { tone: keyof typeof BADGE; children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex h-5 shrink-0 items-center gap-1 whitespace-nowrap rounded-md px-1.5 text-[11.5px] font-medium ${BADGE[tone]} ${className}`}>
      {children}
    </span>
  );
}

/** ⓘ cu definiția unei cifre: la hover și la focus (tastatură, atingere). */
export function Hint({ text }: { text: string }) {
  return (
    <span className="group/hint relative inline-flex align-middle">
      <button
        type="button"
        aria-label={`Explicație: ${text}`}
        className="flex size-4 items-center justify-center rounded text-(--z-fg-3) transition-colors duration-150 hover:text-(--z-fg-2)"
      >
        <Info size={12} aria-hidden />
      </button>
      <span
        className="pointer-events-none invisible absolute bottom-full left-[-8px] z-30 mb-1.5 w-60 rounded-lg border border-(--z-border) bg-(--z-surface) px-2.5 py-2 text-left text-[12px] font-normal leading-snug text-(--z-fg-2) opacity-0 transition-opacity duration-150 group-focus-within/hint:visible group-focus-within/hint:opacity-100 group-hover/hint:visible group-hover/hint:opacity-100"
        style={{ boxShadow: "var(--z-tip)" }}
        aria-hidden
      >
        {text}
      </span>
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
  /** opțional: doar date (perioadă, număr), maximum 60 de caractere */
  subtitle?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  mobile?: boolean;
}) {
  return (
    <div className={`mb-5 flex ${mobile ? "flex-col gap-3" : "items-center justify-between gap-4"}`}>
      <div className="min-w-0">
        <h1 className={`${mobile ? "text-[20px]" : "text-[24px]"} font-bold leading-tight tracking-[-0.015em]`}>{title}</h1>
        {subtitle && <p className="mt-0.5 text-[14px] tabular-nums text-(--z-fg-2)">{subtitle}</p>}
        {meta && <div className="mt-1.5">{meta}</div>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Btn({
  children,
  onClick,
  variant = "outline",
  size = "sm",
  label,
  title,
  disabled,
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "outline" | "ghost";
  size?: "sm" | "xs" | "md";
  label?: string;
  title?: string;
  disabled?: boolean;
  className?: string;
}) {
  const v =
    variant === "primary"
      ? "bg-(--z-primary) text-white hover:bg-(--z-primary-hover)"
      : variant === "outline"
        ? "border border-(--z-border-strong) bg-(--z-surface) text-(--z-fg) hover:bg-(--z-hover)"
        : "text-(--z-fg-2) hover:bg-(--z-muted) hover:text-(--z-fg)";
  const s =
    size === "xs"
      ? "h-7 px-2.5 text-[12px] gap-1.5"
      : size === "md"
        ? "h-10 px-4 text-[14px] gap-2"
        : "h-8 px-3 text-[13px] gap-1.5";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={title}
      disabled={disabled}
      className={`inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-lg font-medium transition-colors duration-150 disabled:cursor-default disabled:opacity-50 ${v} ${s} ${className}`}
    >
      {children}
    </button>
  );
}

/** Câmpul de căutare (Produse, Jurnal vânzări): cu buton de golire. */
export function SearchField({
  value,
  onChange,
  placeholder,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  label: string;
}) {
  return (
    <div className="relative min-w-0 flex-1">
      <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-(--z-fg-3)" aria-hidden />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
        className="h-9 w-full rounded-lg border border-(--z-border-strong) bg-(--z-surface) pl-9 pr-8 text-[13px] text-(--z-fg) transition-colors duration-150 placeholder:text-(--z-fg-3) focus:border-(--z-primary)"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Șterge căutarea"
          className="absolute right-1.5 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-(--z-fg-3) hover:bg-(--z-muted) hover:text-(--z-fg)"
        >
          <X size={13} aria-hidden />
        </button>
      )}
    </div>
  );
}

/** Select nativ, cu săgeata aplicației. */
export function SelectField({
  value,
  onChange,
  label,
  children,
  className = "",
  small,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  children: ReactNode;
  className?: string;
  small?: boolean;
}) {
  return (
    <span className={`relative inline-flex min-w-0 ${className}`}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        className={`${small ? "h-8" : "h-9"} w-full min-w-0 cursor-pointer appearance-none truncate rounded-lg border border-(--z-border-strong) bg-(--z-surface) pl-3 pr-8 text-[13px] text-(--z-fg) transition-colors duration-150 hover:bg-(--z-hover)`}
      >
        {children}
      </select>
      <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-(--z-fg-3)" aria-hidden />
    </span>
  );
}

/* ---------- fereastră peste ecran: panou lateral sau foaie de jos ---------- */

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Dialog modal: fundal estompat, Escape, focus prins înăuntru și
 * întors pe butonul care l-a deschis. `data-autofocus` primește focusul.
 */
export function Overlay({
  onClose,
  labelledBy,
  closeLabel,
  placement,
  children,
}: {
  onClose: () => void;
  labelledBy: string;
  closeLabel: string;
  /** right = panou de 400px (desktop) · bottom = foaie de jos · menu = panou de 288px sub bara de stare */
  placement: "right" | "bottom" | "menu";
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const box = ref.current;
    (box?.querySelector<HTMLElement>("[data-autofocus]") ?? box?.querySelector<HTMLElement>(FOCUSABLE))?.focus();
    return () => prev?.focus?.();
  }, []);

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== "Tab" || !ref.current) return;
    const f = ref.current.querySelectorAll<HTMLElement>(FOCUSABLE);
    if (!f.length) return;
    const first = f[0];
    const last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const pos =
    placement === "bottom"
      ? "zof-up inset-x-0 bottom-0 max-h-[78%] rounded-t-2xl border-t pb-6"
      : placement === "menu"
        ? "zof-slide bottom-0 right-0 top-11 w-72 border-l"
        : "zof-slide bottom-0 right-0 top-0 w-[400px] border-l";

  return (
    <div className="absolute inset-0 z-40" onKeyDown={onKey}>
      <button type="button" aria-label={closeLabel} tabIndex={-1} onClick={onClose} className="zof-fade absolute inset-0 bg-(--z-scrim)" />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className={`absolute flex flex-col border-(--z-border) bg-(--z-surface) ${pos}`}
        style={{ boxShadow: "var(--z-pop)" }}
      >
        {children}
      </div>
    </div>
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

const TIP = "pointer-events-none absolute z-10 rounded-lg border border-(--z-border) bg-(--z-surface) text-[12px]";

/**
 * Graficul de evoluție: o linie (perioada curentă) + comparația
 * (linie punctată gri), axă Y în HTML (textul nu se deformează la
 * scalare), cruce + tooltip la hover și la săgeți.
 */
export function TrendChart({
  values,
  compare,
  labels,
  height = 220,
  fmt,
  fmtAxis = axisK,
  name,
  compareName,
  maxLabels = 7,
  live,
  tipLabel,
  lastX,
  partialLast,
}: {
  values: (number | null)[];
  compare?: number[];
  labels: string[];
  height?: number;
  fmt: (v: number) => string;
  fmtAxis?: (v: number) => string;
  name: string;
  compareName?: string;
  maxLabels?: number;
  /** ultimul punct e „în curs” (azi): punct marcat, fără animație */
  live?: boolean;
  tipLabel?: (i: number) => string;
  /** poziția fracționară a ultimului punct (ex. 9,4 = 18:24 pe axa orelor) */
  lastX?: number;
  /** ultimul punct e o perioadă neîncheiată: segment punctat */
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
  const X = (i: number) => (n > 1 ? ((i === last && lastX !== undefined ? lastX : i) / (n - 1)) * 1000 : 500);
  const Y = (v: number) => H - (v / max) * (H - 8);
  const solidTo = partialLast && last >= 1 ? last - 1 : last;
  const pts: [number, number][] = [];
  for (let i = 0; i <= solidTo; i++) pts.push([X(i), Y(values[i] ?? 0)]);
  const line = smooth(pts, H);
  const tail =
    partialLast && last >= 1 ? `M${X(last - 1)},${Y(values[last - 1] ?? 0)} L${X(last)},${Y(values[last] ?? 0)}` : "";
  const cmp = compare ? smooth(compare.map((v, i) => [X(i), Y(v)] as [number, number]), H) : "";
  const every = Math.max(1, Math.ceil(n / maxLabels));

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
            className="absolute right-2 -translate-y-1/2 text-[11px] tabular-nums text-(--z-fg-3)"
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
          className="relative rounded-sm"
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
            {[1, 0.5, 0].map((k) => (
              <line
                key={k}
                x1="0"
                x2="1000"
                y1={Y(max * k)}
                y2={Y(max * k)}
                strokeDasharray={k === 0 ? undefined : "3 3"}
                vectorEffect="non-scaling-stroke"
                style={{ stroke: C.border }}
              />
            ))}
            {cmp && (
              <path d={cmp} fill="none" strokeWidth="1.5" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" style={{ stroke: C.compare }} />
            )}
            {line && (
              <path d={line} fill="none" strokeWidth="2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" style={{ stroke: C.primary }} />
            )}
            {tail && (
              <path
                d={tail}
                fill="none"
                strokeWidth="2"
                strokeDasharray="3 4"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
                style={{ stroke: C.primary }}
              />
            )}
          </svg>
          {/* ultimul punct al zilei de azi: static, cu inel în culoarea cardului */}
          {live && last >= 0 && hi === null && (
            <span
              className="pointer-events-none absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{ left: `${(X(last) / 1000) * 100}%`, top: Y(values[last] ?? 0), background: C.primary, boxShadow: `0 0 0 2px ${C.surface}` }}
            />
          )}
          {hi !== null && (
            <>
              <span className="pointer-events-none absolute top-0 w-px bg-(--z-border-strong)" style={{ left: `${left}%`, height: H }} />
              {hc !== null && (
                <span
                  className="pointer-events-none absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full"
                  style={{ left: `${left}%`, top: Y(hc), background: C.compare, boxShadow: `0 0 0 2px ${C.surface}` }}
                />
              )}
              {hv !== null && (
                <span
                  className="pointer-events-none absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
                  style={{ left: `${left}%`, top: Y(hv), background: C.primary, boxShadow: `0 0 0 2px ${C.surface}` }}
                />
              )}
              <div
                className={`${TIP} top-1 min-w-[150px] px-3 py-2`}
                style={{
                  left: `${left}%`,
                  transform: `translateX(${left > 60 ? "calc(-100% - 10px)" : "10px"})`,
                  boxShadow: "var(--z-tip)",
                }}
              >
                <p className="mb-1 font-semibold text-(--z-fg)">{tipLabel ? tipLabel(hi) : labels[hi]}</p>
                <p className="flex items-center gap-1.5 text-(--z-fg-2)">
                  <span className="size-2 rounded-full" style={{ background: C.primary }} />
                  <span className="tabular-nums text-(--z-fg)">{hv === null ? "—" : fmt(hv)}</span>
                  {live && hi === last && <span className="text-(--z-fg-3)">· în curs</span>}
                </p>
                {hc !== null && compareName && (
                  <p className="mt-0.5 flex items-center gap-1.5 text-(--z-fg-2)">
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
              i === n - 1 && i % every !== 0 && (n - 1) % every < every * 0.6 ? null : (
                <span
                  key={i}
                  className="absolute whitespace-nowrap text-[11px] tabular-nums text-(--z-fg-3)"
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
 * Coloane (HTML, nu SVG: rămân clare la orice scalare), opțional
 * perechi cu perioada de comparație. Tooltip la hover / focus.
 * Coloana „în curs” e hașurată.
 */
export function Columns({
  values,
  compare,
  labels,
  height = 180,
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
          <span key={k} className="absolute right-2 -translate-y-1/2 text-[11px] tabular-nums text-(--z-fg-3)" style={{ top: height - k * height }}>
            {fmtAxis(max * k)}
          </span>
        ))}
      </div>
      <div className="min-w-0 flex-1">
        <div className="relative" style={{ height }} role="list" aria-label={name} onPointerLeave={() => setHover(null)}>
          {[1, 0.5, 0].map((k) => (
            <span
              key={k}
              className={`absolute inset-x-0 border-t border-(--z-border) ${k === 0 ? "" : "border-dashed"}`}
              style={{ top: height - k * height }}
              aria-hidden
            />
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
                  aria-label={`${labels[i]}: ${v === null ? "—" : fmt(v)}${current === i ? " (în curs)" : ""}${
                    c !== undefined && compareName ? `; ${compareName}: ${fmt(c)}` : ""
                  }`}
                  className="relative flex h-full flex-1 items-end justify-center gap-[2px] rounded-md"
                  style={{ background: on ? "var(--z-hover)" : undefined }}
                  onPointerEnter={() => setHover(i)}
                  onFocus={() => setHover(i)}
                  onBlur={() => setHover(null)}
                >
                  {c !== undefined && (
                    <span className="block w-[34%] max-w-[14px] rounded-t-[3px]" style={{ height: `${(c / max) * 100}%`, background: C.compareBar }} />
                  )}
                  <span
                    className="block rounded-t-[3px]"
                    style={{
                      width: c !== undefined ? "34%" : "62%",
                      maxWidth: c !== undefined ? 14 : 28,
                      height: `${((v ?? 0) / max) * 100}%`,
                      background: C.primary,
                      opacity: current === i ? 0.5 : 1,
                      backgroundImage:
                        current === i ? "repeating-linear-gradient(135deg, rgba(255,255,255,.45) 0 3px, transparent 3px 7px)" : undefined,
                    }}
                  />
                  {on && (
                    <div
                      className={`${TIP} bottom-full mb-1 min-w-[132px] px-2.5 py-1.5`}
                      style={{
                        left: "50%",
                        transform: `translateX(${i < n / 4 ? "-20%" : i > (3 * n) / 4 ? "-80%" : "-50%"})`,
                        boxShadow: "var(--z-tip)",
                      }}
                    >
                      <p className="font-semibold text-(--z-fg)">
                        {labels[i]}
                        {current === i && <span className="font-normal text-(--z-fg-3)"> · în curs</span>}
                      </p>
                      <p className="mt-0.5 flex items-center gap-1.5 tabular-nums text-(--z-fg)">
                        <span className="size-2 rounded-full" style={{ background: C.primary }} />
                        {v === null ? "—" : fmt(v)}
                      </p>
                      {c !== undefined && (
                        <p className="flex items-center gap-1.5 tabular-nums text-(--z-fg-2)">
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
            <span key={i} className="flex-1 truncate text-center text-[11px] tabular-nums text-(--z-fg-3)">
              {n > 14 && i % 2 ? "" : l}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Bară orizontală simplă (0–100%), fără animație. */
export function Meter({ value, color = C.primary, h = 6 }: { value: number; color?: string; h?: number }) {
  return (
    <span className="block w-full overflow-hidden rounded-full bg-(--z-muted)" style={{ height: h }} aria-hidden>
      <span className="block h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color }} />
    </span>
  );
}

/** Legendă: punct sau linie punctată + etichetă. */
export function Legend({ items }: { items: { label: string; color: string; dashed?: boolean }[] }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-(--z-fg-2)">
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

/** Trei cifre sub un grafic. `sub` doar unde schimbă citirea (ex. data celei mai bune zile). */
export function StatStrip({ items, small }: { items: { k: string; v: ReactNode; sub?: string }[]; small?: boolean }) {
  return (
    <dl className="mt-4 grid grid-cols-3 divide-x divide-(--z-border) border-t border-(--z-border) pt-3">
      {items.map((it) => (
        <div key={it.k} className={`min-w-0 first:pl-0 last:pr-0 ${small ? "px-2" : "px-3"}`}>
          <dt className="text-[12px] leading-tight text-(--z-fg-3)">{it.k}</dt>
          <dd className={`mt-1 truncate font-semibold tabular-nums ${small ? "text-[13px]" : "text-[15px]"}`}>{it.v}</dd>
          {it.sub && <dd className="truncate text-[12px] tabular-nums text-(--z-fg-3)">{it.sub}</dd>}
        </div>
      ))}
    </dl>
  );
}

/** Logo-ul aplicației: pătratul albastru cu „Z”. */
export function ZofMark({ size = 32 }: { size?: number }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-lg bg-(--z-primary) font-bold text-white"
      style={{ width: size, height: size, fontSize: size * 0.44 }}
      aria-hidden
    >
      Z
    </span>
  );
}
