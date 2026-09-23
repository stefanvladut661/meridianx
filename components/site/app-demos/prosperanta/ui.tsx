"use client";

import { useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type CSSProperties, type ReactNode } from "react";
import {
  Coffee,
  Croissant,
  Droplets,
  CarFront,
  Ticket,
  Wrench,
  BadgePercent,
  X,
  Lock,
  Smartphone,
  Fuel as FuelIcon,
  Shield,
} from "lucide-react";
import { createPortal } from "react-dom";
import { num } from "../kit";
import { C, FONT, type RewardIcon } from "./data";
import { useDemo } from "./store";

/* ---------- stiluri scoped (fără media queries) ---------- */
export const SCOPED_CSS = `
.prs { font-family: ${FONT}; color: ${C.fg}; background: ${C.bg}; color-scheme: light; -webkit-font-smoothing: antialiased; }
.prs *, .prs *::before, .prs *::after { box-sizing: border-box; }
.prs :focus-visible { outline: 2px solid ${C.red}; outline-offset: 2px; border-radius: revert-layer; }
.prs ::selection { background: ${C.red}; color: #fff; }
.prs .prs-scroll { overflow-y: auto; scrollbar-width: thin; scrollbar-color: rgba(0,0,0,0.18) transparent; overscroll-behavior: contain; }
.prs .prs-hscroll { overflow-x: auto; scrollbar-width: none; }
.prs .prs-hscroll::-webkit-scrollbar { display: none; }
.prs .tnum { font-variant-numeric: tabular-nums; }
.prs input, .prs textarea, .prs select { font: inherit; color: inherit; }
.prs input::placeholder, .prs textarea::placeholder { color: #9A9A9A; }
.prs input:focus-visible, .prs textarea:focus-visible { outline: none; border-color: ${C.red} !important; box-shadow: 0 0 0 3px rgba(224,6,28,0.14); }
@keyframes prs-in { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: none; } }
@keyframes prs-flash { 0% { background: rgba(245,158,36,0.22); } 100% { background: transparent; } }
@keyframes prs-pulse { 0% { box-shadow: 0 0 0 0 rgba(224,6,28,0.45); } 70% { box-shadow: 0 0 0 7px rgba(224,6,28,0); } 100% { box-shadow: 0 0 0 0 rgba(224,6,28,0); } }
@keyframes prs-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes prs-right { from { transform: translateX(100%); } to { transform: none; } }
@keyframes prs-up { from { transform: translateY(100%); } to { transform: none; } }
@keyframes prs-pop { from { opacity: 0; transform: scale(0.96) translateY(8px); } to { opacity: 1; transform: none; } }
@keyframes prs-spin { to { transform: rotate(360deg); } }
.prs .a-in { animation: prs-in 420ms cubic-bezier(.2,.8,.2,1) both; }
.prs .a-flash { animation: prs-flash 1600ms ease-out both; }
.prs .a-pulse { animation: prs-pulse 1.8s ease-out infinite; }
.prs .a-fade { animation: prs-fade 200ms ease-out both; }
.prs .a-right { animation: prs-right 280ms cubic-bezier(.2,.8,.2,1) both; }
.prs .a-up { animation: prs-up 300ms cubic-bezier(.2,.8,.2,1) both; }
.prs .a-pop { animation: prs-pop 260ms cubic-bezier(.2,.8,.2,1) both; }
.prs .a-spin { animation: prs-spin 800ms linear infinite; }
.prs.prs-rm *, .prs.prs-rm *::before, .prs.prs-rm *::after { animation: none !important; transition: none !important; }
`;

/* ---------- logo: triunghiul Prosperanța (flacără + GPL), desenat din forme simple ---------- */
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

export function Logo({ size = 36, sub = "Club de fidelitate", light = false }: { size?: number; sub?: string; light?: boolean }) {
  return (
    <span className="flex items-center gap-2.5" aria-label="Prosperanța">
      <Mark size={size} />
      <span className="flex flex-col leading-none">
        <span className="font-black uppercase" style={{ fontSize: size * 0.43, letterSpacing: "-0.01em", color: light ? "#fff" : C.fg }}>
          Prosperanța
        </span>
        {sub && (
          <span className="mt-[3px] font-bold uppercase" style={{ fontSize: 9.5, letterSpacing: "0.14em", color: light ? "rgba(255,255,255,.8)" : C.mutedFg }}>
            {sub}
          </span>
        )}
      </span>
    </span>
  );
}

/* ---------- butoane (pill, font-black, uppercase — ca în aplicația reală) ---------- */
type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "outline" | "dark" | "soft" | "white";
  size?: "sm" | "md" | "lg";
};
export function Btn({ variant = "primary", size = "md", className = "", style, children, ...rest }: BtnProps) {
  const v: Record<string, CSSProperties> = {
    primary: { background: C.red, color: "#fff", border: `2px solid ${C.red}` },
    outline: { background: "#fff", color: C.red, border: `2px solid ${C.red}` },
    dark: { background: C.fg, color: "#fff", border: `2px solid ${C.fg}` },
    soft: { background: C.muted, color: C.fg, border: `2px solid ${C.muted}` },
    white: { background: "#fff", color: C.red, border: "2px solid #fff" },
  };
  const s = { sm: "h-9 px-4 text-[11.5px]", md: "h-11 px-5 text-[13px]", lg: "h-[54px] px-7 text-[15px]" }[size];
  return (
    <button
      type="button"
      className={`inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full font-black uppercase tracking-[0.01em] transition-[filter,transform,opacity] duration-150 hover:brightness-[0.94] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:brightness-100 ${s} ${className}`}
      style={{ ...v[variant], ...style }}
      {...rest}
    >
      {children}
    </button>
  );
}

/* ---------- card cu bordură de 2px (stilul panoului real) ---------- */
export function Card({ children, className = "", style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <div className={`rounded-[18px] bg-white ${className}`} style={{ border: `2px solid ${C.border}`, ...style }}>
      {children}
    </div>
  );
}

export function CardHead({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex min-h-[48px] items-center justify-between gap-3 px-5 py-2.5" style={{ borderBottom: `2px solid ${C.border}` }}>
      <h3 className="flex items-center gap-2 text-[13px] font-black uppercase tracking-[0.01em]">{children}</h3>
      {right}
    </div>
  );
}

export function Label({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.08em]" style={{ color: C.mutedFg }}>
      {children}
    </label>
  );
}

export const inputCls = "h-11 w-full rounded-[12px] bg-white px-3.5 text-[14.5px] outline-none transition-colors";
export const inputStyle: CSSProperties = { border: `2px solid ${C.border}` };

/* ---------- pastile de tip tab ---------- */
export function Pills<T extends string>({
  items,
  value,
  onChange,
  label,
  className = "",
  size = "md",
}: {
  items: { id: T; label: ReactNode; locked?: boolean }[];
  value: T;
  onChange: (id: T) => void;
  label: string;
  className?: string;
  size?: "sm" | "md";
}) {
  return (
    <div role="tablist" aria-label={label} className={`flex gap-1.5 ${className}`}>
      {items.map((it) => {
        const on = it.id === value;
        return (
          <button
            key={it.id}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(it.id)}
            className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full font-black uppercase transition-colors duration-150 ${
              size === "sm" ? "h-8 px-3.5 text-[11px]" : "h-9 px-4 text-[12px]"
            }`}
            style={on ? { background: C.red, color: "#fff" } : { background: C.muted, color: it.locked ? "#8C8C8C" : C.fg }}
          >
            {it.label}
            {it.locked && <Lock size={11} strokeWidth={2.6} aria-label="închis în demo" />}
          </button>
        );
      })}
    </div>
  );
}

/* ---------- comutatorul de rol (client / angajat / admin) ---------- */
export type Face = "client" | "angajat" | "admin";
const FACE_HOME: Record<Face, string> = { client: "home", angajat: "statie", admin: "dashboard" };
export function RoleSwitch({ face, compact = false }: { face: Face; compact?: boolean }) {
  const { go } = useDemo();
  const items: { id: Face; label: string; icon: ReactNode }[] = [
    { id: "client", label: "Client", icon: <Smartphone size={14} strokeWidth={2.4} /> },
    { id: "angajat", label: "Angajat", icon: <FuelIcon size={14} strokeWidth={2.4} /> },
    { id: "admin", label: "Admin", icon: <Shield size={14} strokeWidth={2.4} /> },
  ];
  return (
    <div role="group" aria-label="Vezi aplicația ca" className="flex items-center gap-0.5 rounded-full p-1" style={{ background: C.muted }}>
      {items.map((it) => {
        const on = it.id === face;
        return (
          <button
            key={it.id}
            type="button"
            aria-pressed={on}
            onClick={() => go(FACE_HOME[it.id])}
            className={`flex h-8 items-center gap-1.5 rounded-full font-bold transition-colors duration-150 ${compact ? "px-2.5 text-[12px]" : "px-3.5 text-[12.5px]"}`}
            style={on ? { background: "#fff", color: C.red, boxShadow: "0 1px 3px rgba(0,0,0,.12)" } : { color: "#555" }}
          >
            {it.icon}
            {it.label}
          </button>
        );
      })}
    </div>
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
      const f = panel.current.querySelectorAll<HTMLElement>('button:not([disabled]), input, textarea, [tabindex="0"]');
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
        ? "bottom-0 left-0 w-full overflow-hidden rounded-t-[28px] a-up"
        : "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[24px]";
  return (
    <>
      <span ref={anchor} hidden />
      {createPortal(
        <div className="absolute inset-0 z-40" onKeyDown={onKey}>
          <div className="a-fade absolute inset-0" style={{ background: "rgba(17,17,17,0.45)" }} onClick={onClose} aria-hidden />
          <div
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-label={label}
            tabIndex={-1}
            className={`absolute flex max-h-full flex-col bg-white outline-none ${pos}`}
            style={{
              width: kind === "bottom" ? "100%" : kind === "right" ? Math.min(width, 330) : width,
              boxShadow: "0 30px 80px -20px rgba(0,0,0,.35)",
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
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex size-10 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-[#F0F0F0]"
    >
      <X size={22} strokeWidth={2.4} />
    </button>
  );
}

/* ---------- număr animat (se rostogolește când se schimbă) ---------- */
export function Roll({ value, format = num, ms = 650 }: { value: number; format?: (n: number) => string; ms?: number }) {
  const { rm } = useDemo();
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    if (rm) {
      from.current = value;
      setShown(value);
      return;
    }
    const a = from.current;
    const b = value;
    if (a === b) return;
    let raf = 0;
    const t0 = performance.now();
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / ms);
      const v = a + (b - a) * (1 - Math.pow(1 - k, 3));
      from.current = v;
      setShown(v);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, ms, rm]);
  return <span className="tnum">{format(shown)}</span>;
}

/* ---------- punct „live” ---------- */
export function LiveDot({ color = C.red }: { color?: string }) {
  return <span className="a-pulse inline-block size-2 shrink-0 rounded-full" style={{ background: color }} aria-hidden />;
}

/* ---------- iconița unei recompense ---------- */
export function RewardGlyph({ icon, size = 20 }: { icon: RewardIcon; size?: number }) {
  const p = { size, strokeWidth: 2.2 };
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
export function Avatar({ name, size = 36, tone = "soft" }: { name: string; size?: number; tone?: "soft" | "red" }) {
  const letters = name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("");
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full font-black"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.36,
        background: tone === "red" ? C.red : "#FDECEE",
        color: tone === "red" ? "#fff" : C.red,
      }}
      aria-hidden
    >
      {letters}
    </span>
  );
}

/** Formatare litri: 41,2 L */
export const litri = (n: number, d = 1) =>
  `${n.toLocaleString("ro-RO", { minimumFractionDigits: d, maximumFractionDigits: d })} L`;

/* ---------- bare HTML (etichete clare, fără SVG întins) ---------- */
export function Bars({
  values,
  labels,
  highlight,
  height = 140,
  color = C.red,
  muted = "#F6C2C8",
  format,
  every = 1,
}: {
  values: number[];
  labels: string[];
  highlight?: number;
  height?: number;
  color?: string;
  muted?: string;
  format?: (n: number) => string;
  every?: number;
}) {
  const max = Math.max(...values) || 1;
  return (
    <div>
      <div className="flex items-end gap-[3px]" style={{ height }}>
        {values.map((v, i) => (
          <div key={i} className="group relative flex h-full flex-1 items-end" title={format ? `${labels[i]}: ${format(v)}` : undefined}>
            <div
              className="w-full rounded-t-[5px] transition-[height] duration-500"
              style={{ height: `${Math.max(3, (v / max) * 100)}%`, background: highlight === undefined || highlight === i ? color : muted }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-[3px]">
        {labels.map((l, i) => (
          <span key={i} className="flex-1 truncate text-center text-[10.5px] font-bold" style={{ color: "#8A8A8A" }}>
            {i % every === 0 ? l : ""}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Etichete sub un grafic de suprafață (primul, ultimul și câteva între). */
export function AxisLabels({ labels, count = 6 }: { labels: string[]; count?: number }) {
  const n = labels.length;
  const idx = Array.from({ length: count }, (_, i) => Math.round((i * (n - 1)) / (count - 1)));
  return (
    <div className="mt-1 flex justify-between text-[11px] font-bold" style={{ color: "#8A8A8A" }}>
      {idx.map((i) => (
        <span key={i}>{labels[i]}</span>
      ))}
    </div>
  );
}

/** Acordul numeralului în română: „24 de puncte”, „3 puncte”, „101 puncte”. */
export const de = (n: number) => {
  const r = Math.round(Math.abs(n)) % 100;
  return (r === 0 && n !== 0) || r >= 20 ? "de " : "";
};
/** „1 punct” / „5 puncte” / „24 de puncte” */
export const nr = (n: number, one: string, many: string) => (Math.round(n) === 1 ? `1 ${one}` : `${n.toLocaleString("ro-RO")} ${de(n)}${many}`);
