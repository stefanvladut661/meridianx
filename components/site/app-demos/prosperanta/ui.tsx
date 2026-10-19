"use client";

import { useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type CSSProperties, type ReactNode } from "react";
import { Coffee, Croissant, Droplets, CarFront, Ticket, Wrench, BadgePercent, X } from "lucide-react";
import { createPortal } from "react-dom";
import { num } from "../kit";
import { C, FONT, MONO, type RewardIcon } from "./data";

/** Grosimea liniei pentru iconițele Lucide din demo. */
export const SW = 1.75;

/* ---------- stiluri scoped (fără media queries) ----------
   Mișcarea e doar de stare: 150–250 ms, ease-out, fără bucle decorative.
   Sub reduced motion (`.prs-rm`) nu se mișcă nimic. */
export const SCOPED_CSS = `
.prs { font-family: ${FONT}; color: ${C.fg}; background: ${C.bg}; color-scheme: light; -webkit-font-smoothing: antialiased; font-variant-numeric: tabular-nums; }
.prs *, .prs *::before, .prs *::after { box-sizing: border-box; }
.prs :focus-visible { outline: 2px solid ${C.red}; outline-offset: 2px; }
.prs ::selection { background: ${C.red}; color: #fff; }
.prs .prs-scroll { overflow-y: auto; scrollbar-width: thin; scrollbar-color: rgba(0,0,0,0.18) transparent; overscroll-behavior: contain; }
.prs .prs-hscroll { overflow-x: auto; scrollbar-width: none; }
.prs .prs-hscroll::-webkit-scrollbar { display: none; }
.prs .tnum { font-variant-numeric: tabular-nums; }
.prs .mono { font-family: ${MONO}; letter-spacing: 0.02em; }
.prs input, .prs textarea, .prs select { font: inherit; color: inherit; }
.prs input::placeholder, .prs textarea::placeholder { color: #757575; }
.prs input[type="checkbox"], .prs input[type="radio"] { accent-color: ${C.red}; width: 16px; height: 16px; margin: 0; flex-shrink: 0; }
.prs .field { border: 1px solid ${C.soft}; transition: border-color 150ms ease-out, box-shadow 150ms ease-out; }
.prs .field:focus-visible, .prs .field:focus-within { outline: none; border-color: ${C.red}; box-shadow: 0 0 0 3px rgba(224,6,28,0.14); }
.prs .field input:focus-visible { outline: none; }
.prs .field button:focus-visible { outline-offset: -2px; }

.prs .b { display: inline-flex; flex-shrink: 0; align-items: center; justify-content: center; gap: 8px; white-space: nowrap; border-radius: 8px; border: 1px solid transparent; font-weight: 600; transition: background-color 150ms ease-out, border-color 150ms ease-out, color 150ms ease-out; }
.prs .b-primary { background: ${C.red}; border-color: ${C.red}; color: #fff; }
.prs .b-primary:hover:not(:disabled) { background: ${C.redDeep}; border-color: ${C.redDeep}; }
.prs .b-outline { background: #fff; border-color: ${C.red}; color: ${C.red}; }
.prs .b-outline:hover:not(:disabled) { background: #FFF4F5; }
.prs .b-secondary { background: #fff; border-color: ${C.line}; color: ${C.fg}; }
.prs .b-secondary:hover:not(:disabled) { background: ${C.muted}; }
.prs .b-soft { background: ${C.muted}; border-color: ${C.muted}; color: ${C.fg}; }
.prs .b-soft:hover:not(:disabled) { background: #EBEBEB; border-color: #EBEBEB; }
.prs .b:disabled { background: ${C.muted}; border-color: ${C.muted}; color: ${C.soft}; cursor: not-allowed; }

.prs .seg { color: ${C.mutedFg}; transition: color 150ms ease-out, background-color 150ms ease-out; }
.prs .seg:hover { color: ${C.fg}; }
.prs .seg[aria-selected="true"], .prs .seg[aria-checked="true"] { background: #fff; color: ${C.fg}; box-shadow: 0 1px 2px rgba(0,0,0,0.08); }
.prs .tab { color: ${C.mutedFg}; font-weight: 500; transition: color 150ms ease-out; }
.prs .tab:hover { color: ${C.fg}; }
.prs .tab[aria-current="page"] { color: ${C.fg}; font-weight: 600; }
.prs .tab-t { display: inline-flex; flex-direction: column; }
.prs .tab-t::after { content: attr(data-t); height: 0; overflow: hidden; visibility: hidden; font-weight: 600; }
.prs .chip { display: inline-flex; flex-shrink: 0; align-items: center; justify-content: center; white-space: nowrap; border-radius: 8px; border: 1px solid ${C.line}; background: #fff; transition: background-color 150ms ease-out; }
.prs .chip:hover { background: ${C.muted}; }
.prs .row { transition: background-color 150ms ease-out; }
.prs .row:hover { background: ${C.canvas}; }
.prs .link { color: ${C.red}; font-weight: 600; }
.prs .link:hover { text-decoration: underline; text-underline-offset: 3px; }
.prs .ico { color: ${C.mutedFg}; transition: background-color 150ms ease-out, color 150ms ease-out; }
.prs .ico:hover { background: ${C.muted}; color: ${C.fg}; }

@keyframes prs-in { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }
@keyframes prs-flash { from { background-color: rgba(245,158,36,0.2); } to { background-color: transparent; } }
@keyframes prs-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes prs-right { from { transform: translateX(100%); } to { transform: none; } }
@keyframes prs-up { from { transform: translateY(100%); } to { transform: none; } }
@keyframes prs-pop { from { opacity: 0; transform: scale(0.98); } to { opacity: 1; transform: none; } }
@keyframes prs-spin { to { transform: rotate(360deg); } }
.prs .a-in { animation: prs-in 160ms ease-out both; }
.prs .a-flash { animation: prs-flash 900ms ease-out both; }
.prs .a-fade { animation: prs-fade 150ms ease-out both; }
.prs .a-right { animation: prs-right 240ms cubic-bezier(.2,.8,.2,1) both; }
.prs .a-up { animation: prs-up 240ms cubic-bezier(.2,.8,.2,1) both; }
.prs .a-pop { animation: prs-pop 180ms ease-out both; }
.prs .a-spin { animation: prs-spin 800ms linear infinite; }
.prs.prs-rm *, .prs.prs-rm *::before, .prs.prs-rm *::after { animation: none !important; transition: none !important; }
`;

/* ---------- logo: triunghiul Prosperanța (flacără + GPL), desenat din forme simple ----------
   Degradeurile de aici sunt ale siglei, nu ale interfeței. */
export function Mark({ size = 36 }: { size?: number }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg width={size * 1.1} height={size} viewBox="0 0 100 90" aria-hidden>
      <defs>
        <linearGradient id={`r${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#E3262B" />
          <stop offset="1" stopColor="#A81D23" />
        </linearGradient>
        <linearGradient id={`g${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1E7D38" />
          <stop offset="1" stopColor="#0B4A1C" />
        </linearGradient>
      </defs>
      <polygon points="50,2 98,88 2,88" fill={`url(#r${id})`} />
      <polygon points="21.5,55 78.5,55 98,88 2,88" fill={`url(#g${id})`} />
      <path d="M20.6 55.5 Q50 49 79.4 55.5 L80.8 58.2 Q50 52.5 19.2 58.2 Z" fill="#fff" />
      <path d="M50 11 C58 23 61 34 50 48 C39 34 42 23 50 11 Z" fill="#fff" />
      <path d="M50 21 C54.5 29 55.5 36 50 44 C44.5 36 45.5 29 50 21 Z" fill="#B7202A" />
      <text x="50" y="81" textAnchor="middle" fontSize="21" fontWeight="700" fill="#fff" fontFamily="Georgia, 'Times New Roman', serif">
        GPL
      </text>
    </svg>
  );
}

/** Sigla cu numele. Singurele majuscule din aplicație sunt ale siglei. */
export function Logo({ size = 36 }: { size?: number }) {
  return (
    <span role="img" aria-label="Prosperanța" className="flex shrink-0 items-center gap-2">
      <Mark size={size} />
      <span className="font-bold uppercase leading-none" style={{ fontSize: size * 0.42, letterSpacing: "0.01em", color: C.fg }}>
        Prosperanța
      </span>
    </span>
  );
}

/* ---------- butoane ---------- */
type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** `outline` doar în aplicația clientului; în panouri, `secondary`. */
  variant?: "primary" | "outline" | "secondary" | "soft";
  size?: "sm" | "md" | "lg";
};
export function Btn({ variant = "primary", size = "md", className = "", children, ...rest }: BtnProps) {
  const s = { sm: "h-9 px-3.5 text-[13px]", md: "h-11 px-4 text-[14px]", lg: "h-12 px-5 text-[15px]" }[size];
  return (
    <button type="button" className={`b b-${variant} ${s} ${className}`} {...rest}>
      {children}
    </button>
  );
}

/* ---------- card: chenar de 1px, colțuri de 12px ---------- */
export function Card({ children, className = "", style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <div className={`rounded-[12px] bg-white ${className}`} style={{ border: `1px solid ${C.border}`, ...style }}>
      {children}
    </div>
  );
}

export function CardHead({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex min-h-[44px] items-center justify-between gap-3 px-4 py-1.5" style={{ borderBottom: `1px solid ${C.border}` }}>
      <h3 className="flex min-w-0 items-center gap-2 text-[14px] font-semibold">{children}</h3>
      {right}
    </div>
  );
}

/** Text secundar din dreapta antetului unui card: un număr, o unitate, un interval. */
export function Meta({ children }: { children: ReactNode }) {
  return (
    <span className="shrink-0 text-[12.5px]" style={{ color: C.mutedFg }}>
      {children}
    </span>
  );
}

export function Label({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-[13px] font-medium">
      {children}
    </label>
  );
}

/** Câmp de text: contur de 1px (#8A8A8A, 3,45:1), colțuri de 8px. */
export const inputCls = "field h-11 w-full rounded-[8px] bg-white px-3 text-[14px]";

/* ---------- control segmentat (file și filtre) ---------- */
export function Pills<T extends string>({
  items,
  value,
  onChange,
  label,
  className = "",
  size = "md",
  stretch = false,
  kind = "tabs",
}: {
  items: { id: T; label: ReactNode; count?: number }[];
  value: T;
  onChange: (id: T) => void;
  label: string;
  className?: string;
  size?: "sm" | "md";
  /** Toată lățimea: `true` = segmente egale, `"auto"` = după text. */
  stretch?: boolean | "auto";
  /** `radio` pentru o alegere într-un formular. */
  kind?: "tabs" | "radio";
}) {
  const tabs = kind === "tabs";
  return (
    <div
      role={tabs ? "tablist" : "radiogroup"}
      aria-label={label}
      className={`${stretch ? "flex w-full" : "inline-flex"} shrink-0 gap-0.5 rounded-[8px] p-[3px] ${className}`}
      style={{ background: C.muted }}
    >
      {items.map((it) => {
        const on = it.id === value;
        return (
          <button
            key={it.id}
            type="button"
            role={tabs ? "tab" : "radio"}
            aria-selected={tabs ? on : undefined}
            aria-checked={tabs ? undefined : on}
            onClick={() => onChange(it.id)}
            className={`seg flex items-center justify-center gap-1.5 whitespace-nowrap rounded-[6px] text-[13px] font-medium ${size === "sm" ? "h-8" : "h-9"} ${
              stretch === "auto" ? "flex-auto px-2" : stretch ? "min-w-0 flex-1 px-2" : "px-3"
            }`}
          >
            {it.label}
            {it.count !== undefined && <span style={{ color: C.mutedFg }}>{it.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

/* ---------- navigația principală: file text cu linie roșie sub cea activă ---------- */
export function NavTabs({
  items,
  label,
  className = "",
}: {
  items: { id: string; label: string; on: boolean; onClick: () => void }[];
  label: string;
  className?: string;
}) {
  return (
    <nav aria-label={label} className={`flex items-stretch gap-6 ${className}`}>
      {items.map((it) => (
        <button
          key={it.id}
          type="button"
          onClick={it.onClick}
          aria-current={it.on ? "page" : undefined}
          className="tab relative flex shrink-0 items-center whitespace-nowrap text-[14px]"
        >
          <span className="tab-t" data-t={it.label}>
            {it.label}
          </span>
          {it.on && <span className="absolute inset-x-0 bottom-0 h-0.5" style={{ background: C.red }} aria-hidden />}
        </button>
      ))}
    </nav>
  );
}

/* ---------- comutator pornit/oprit ---------- */
export function Switch({ on, onChange, label, children }: { on: boolean; onChange: () => void; label: string; children?: ReactNode }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={onChange} className="inline-flex shrink-0 items-center gap-2 rounded-[6px]">
      <span className="relative inline-block h-5 w-9 shrink-0 rounded-full transition-colors duration-150 ease-out" style={{ background: on ? C.red : C.line }}>
        <span
          className="absolute left-0.5 top-0.5 size-4 rounded-full bg-white transition-transform duration-150 ease-out"
          style={{ transform: on ? "translateX(16px)" : undefined, boxShadow: "0 1px 2px rgba(0,0,0,0.2)" }}
        />
      </span>
      {children}
    </button>
  );
}

/* ---------- etichetă de stare ---------- */
const BADGE: Record<"neutral" | "green" | "outline", CSSProperties> = {
  neutral: { background: C.muted, color: C.fg },
  green: { background: C.greenBg, color: C.greenInk },
  /* pe rânduri care au deja fundal gri */
  outline: { background: "#fff", color: C.fg, boxShadow: `inset 0 0 0 1px ${C.border}` },
};
export function Badge({ tone = "neutral", children }: { tone?: keyof typeof BADGE; children: ReactNode }) {
  return (
    <span className="inline-flex h-5 shrink-0 items-center whitespace-nowrap rounded-full px-2 text-[12px] font-medium leading-none" style={BADGE[tone]}>
      {children}
    </span>
  );
}

/* ---------- suprapuneri: sertar, foaie de jos, dialog ---------- */
export function Overlay({
  open,
  onClose,
  label,
  kind,
  children,
  width = 440,
}: {
  open: boolean;
  onClose: () => void;
  label: string;
  kind: "right" | "bottom" | "center";
  children: ReactNode;
  width?: number;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const anchor = useRef<HTMLSpanElement>(null);
  /* Suprapunerea acoperă tot ecranul demo-ului (inclusiv antetul), deci se
     randează în rădăcina `.prs`, nu în containerul în care e declarată. */
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setHost(anchor.current?.closest<HTMLElement>(".prs") ?? null);
  }, []);
  useEffect(() => {
    if (!open || !host) return;
    const prev = document.activeElement as HTMLElement | null;
    panel.current?.focus();
    return () => prev?.focus?.();
  }, [open, host]);
  if (!open || !host) return <span ref={anchor} hidden />;
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose();
    }
    if (e.key === "Tab" && panel.current) {
      const f = panel.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select, a[href], [tabindex="0"]'
      );
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
    }
  };
  const pos =
    kind === "right"
      ? "right-0 top-0 h-full a-right"
      : kind === "bottom"
        ? "bottom-0 left-0 w-full overflow-hidden rounded-t-[16px] a-up"
        : "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[12px]";
  return (
    <>
      <span ref={anchor} hidden />
      {createPortal(
        <div className="absolute inset-0 z-40" onKeyDown={onKey}>
          <div className="a-fade absolute inset-0" style={{ background: "rgba(17,17,17,0.4)" }} onClick={onClose} aria-hidden />
          <div
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-label={label}
            tabIndex={-1}
            className={`absolute flex max-h-full flex-col bg-white outline-none ${pos}`}
            style={{
              width: kind === "bottom" ? "100%" : kind === "right" ? Math.min(width, 330) : width,
              boxShadow: "0 24px 64px -16px rgba(0,0,0,0.3)",
            }}
          >
            {kind === "center" ? <div className="a-pop flex max-h-full flex-col">{children}</div> : children}
          </div>
        </div>,
        host
      )}
    </>
  );
}

export function CloseBtn({ onClick, label = "Închide" }: { onClick: () => void; label?: string }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} className="ico flex size-10 shrink-0 items-center justify-center rounded-full">
      <X size={20} strokeWidth={SW} />
    </button>
  );
}

/* ---------- punct de stare (static) ---------- */
export function LiveDot({ color = C.green }: { color?: string }) {
  return <span className="inline-block size-1.5 shrink-0 rounded-full" style={{ background: color }} aria-hidden />;
}

/* ---------- iconița unei recompense ---------- */
export function RewardGlyph({ icon, size = 20 }: { icon: RewardIcon; size?: number }) {
  const p = { size, strokeWidth: SW, "aria-hidden": true };
  switch (icon) {
    case "coffee":
      return <Coffee {...p} />;
    case "croissant":
      return <Croissant {...p} />;
    case "wash":
      return <CarFront {...p} />;
    case "drop":
      return <Droplets {...p} />;
    case "ticket":
      return <Ticket {...p} />;
    case "wrench":
      return <Wrench {...p} />;
    case "ticket50":
      return <BadgePercent {...p} />;
  }
}

/* ---------- avatar cu inițiale ---------- */
export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const letters = name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("");
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full font-semibold"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36), background: C.muted, color: C.mutedFg }}
      aria-hidden
    >
      {letters}
    </span>
  );
}

/** Formatare litri: 41,2 L */
export const litri = (n: number, d = 1) =>
  `${n.toLocaleString("ro-RO", { minimumFractionDigits: d, maximumFractionDigits: d })} L`;

/** Semn real de minus pentru valorile negative: „−20”, „+42”. */
export const signed = (n: number) => (n < 0 ? `−${num(-n)}` : `+${num(n)}`);

/** Etichetă de axă: „0”, „800”, „1.600”, „16 mii”, „270 mii”. */
export const axisNum = (n: number) =>
  n >= 10_000 ? `${(n / 1000).toLocaleString("ro-RO", { maximumFractionDigits: 1 })} mii` : num(n);

/** Pasul „rotund” cel mai mic ≥ x (1, 1,5, 2, 2,5, 3, 4, 5, 6, 8 × 10ⁿ). */
export function niceStep(x: number) {
  if (x <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(x));
  const k = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find((m) => m * p >= x) ?? 10;
  return k * p;
}

/** Gutter-ul din stânga graficelor, pentru etichetele axei Y. */
const GUTTER = 36;

/* ---------- bare HTML (etichete clare, fără SVG întins) ---------- */
export function Bars({
  values,
  labels,
  highlight,
  height = 140,
  format,
  every = 1,
  ticks = false,
}: {
  values: number[];
  labels: string[];
  highlight?: number;
  height?: number;
  format?: (n: number) => string;
  every?: number;
  /** Trei linii de grilă (0, mijloc, vârf) cu valori în stânga. */
  ticks?: boolean;
}) {
  const peak = Math.max(...values) || 1;
  const top = ticks ? niceStep(peak / 2) * 2 : peak;
  const pad = ticks ? GUTTER : 0;
  return (
    <div className={ticks ? "pt-1.5" : ""}>
      <div className="relative" style={{ height, paddingLeft: pad }}>
        {ticks &&
          [0, 0.5, 1].map((k) => (
            <div key={k} className="pointer-events-none absolute inset-x-0 flex items-center" style={{ bottom: `${k * 100}%`, transform: "translateY(50%)" }}>
              <span className="shrink-0 pr-2 text-right text-[11px] leading-none" style={{ width: GUTTER, color: C.mutedFg }}>
                {axisNum(top * k)}
              </span>
              <span className="h-px flex-1" style={{ background: C.border }} />
            </div>
          ))}
        <div className="relative flex h-full items-end gap-[3px]">
          {values.map((v, i) => (
            <div key={i} className="flex h-full flex-1 items-end" title={format ? `${labels[i]}: ${format(v)}` : undefined}>
              <div
                className="w-full rounded-t-[2px]"
                style={{ height: `${Math.max(2, (v / top) * 100)}%`, background: highlight === undefined || highlight === i ? C.red : C.bar }}
              />
            </div>
          ))}
        </div>
      </div>
      <div className="mt-1.5 flex gap-[3px]" style={{ paddingLeft: pad }}>
        {labels.map((l, i) => (
          <span key={i} className="flex-1 truncate text-center text-[11px]" style={{ color: C.mutedFg }}>
            {i % every === 0 ? l : ""}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ---------- grafic cu linii, fără umplere, cu axa Y de la zero ----------
   Etichetele axei sunt HTML: textul din SVG s-ar întinde odată cu
   preserveAspectRatio="none". */
export function LineChart({
  series,
  height,
  top,
  ticks,
}: {
  series: { values: number[]; color: string }[];
  height: number;
  top: number;
  ticks: number[];
}) {
  const W = 600;
  const H = height;
  const y = (v: number) => 6 + (H - 12) * (1 - v / top);
  const n = series[0]?.values.length ?? 0;
  const x = (i: number) => (n > 1 ? (i * W) / (n - 1) : 0);
  return (
    <div className="relative" style={{ height: H, paddingLeft: GUTTER }}>
      {ticks.map((t) => (
        <div key={t} className="pointer-events-none absolute inset-x-0 flex items-center" style={{ top: y(t), transform: "translateY(-50%)" }}>
          <span className="shrink-0 pr-2 text-right text-[11px] leading-none" style={{ width: GUTTER, color: C.mutedFg }}>
            {axisNum(t)}
          </span>
          <span className="h-px flex-1" style={{ background: C.border }} />
        </div>
      ))}
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" className="relative block" aria-hidden>
        {series.map((s, si) => (
          <path
            key={si}
            d={s.values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ")}
            fill="none"
            stroke={s.color}
            strokeWidth="1.75"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
    </div>
  );
}

/** Etichete sub un grafic (primul, ultimul și câteva între). */
export function AxisLabels({ labels, count = 6, gutter = false }: { labels: string[]; count?: number; gutter?: boolean }) {
  const n = labels.length;
  const idx = Array.from({ length: count }, (_, i) => Math.round((i * (n - 1)) / (count - 1)));
  return (
    <div className="mt-1.5 flex justify-between text-[11px]" style={{ color: C.mutedFg, paddingLeft: gutter ? GUTTER : 0 }}>
      {idx.map((i) => (
        <span key={i}>{labels[i]}</span>
      ))}
    </div>
  );
}

/* ---------- șir de cifre: o singură suprafață, celule despărțite de 1px ---------- */
export type Metric = { label: string; value: ReactNode; sub?: ReactNode; title?: string; span?: number };
export function MetricStrip({
  items,
  cols,
  title,
  size = "lg",
  className = "",
}: {
  items: Metric[];
  cols: number;
  title?: ReactNode;
  size?: "lg" | "md";
  className?: string;
}) {
  return (
    <section className={`overflow-hidden rounded-[12px] bg-white ${className}`} style={{ border: `1px solid ${C.border}` }}>
      {title && (
        <h3 className="flex min-h-[44px] items-center px-4 text-[14px] font-semibold" style={{ borderBottom: `1px solid ${C.border}` }}>
          {title}
        </h3>
      )}
      <dl className="grid gap-px" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, background: C.border }}>
        {items.map((m) => (
          <div
            key={m.label}
            className={`min-w-0 bg-white ${size === "lg" ? "px-4 py-3" : "px-3 py-2.5"}`}
            style={m.span ? { gridColumn: `span ${m.span} / span ${m.span}` } : undefined}
            title={m.title}
          >
            <dt className="truncate text-[12.5px]" style={{ color: C.mutedFg }}>
              {m.label}
            </dt>
            <dd className={`mt-0.5 truncate font-semibold leading-tight ${size === "lg" ? "text-[24px]" : "text-[20px]"}`}>{m.value}</dd>
            {m.sub && (
              <dd className="mt-1 truncate text-[12.5px]" style={{ color: C.mutedFg }}>
                {m.sub}
              </dd>
            )}
          </div>
        ))}
      </dl>
    </section>
  );
}

/** Acordul numeralului în română: „24 de puncte”, „3 puncte”, „101 puncte”. */
export const de = (n: number) => {
  const r = Math.round(Math.abs(n)) % 100;
  return (r === 0 && n !== 0) || r >= 20 ? "de " : "";
};
/** „1 punct” / „5 puncte” / „24 de puncte” */
export const nr = (n: number, one: string, many: string) => (Math.round(n) === 1 ? `1 ${one}` : `${n.toLocaleString("ro-RO")} ${de(n)}${many}`);
/** Doar cuvântul, acordat: „participant” / „participanți” / „de participanți” */
export const unit = (n: number, one: string, many: string) => (Math.round(n) === 1 ? one : `${de(n)}${many}`);
