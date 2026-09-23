"use client";

import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { X } from "lucide-react";
import { useCountUp } from "../kit";
import css from "./ely.module.css";
import { C, CULORI_TIP, ETICHETA_TIP, GRADIENT, HEATMAP, ORE_HEATMAP, UMBRA, ZILE_SCURTE, pluralSedinte, type Contor } from "./data";
import { useDemo } from "./store";

/* ============================================================
   Piesele vizuale comune, după stilurile reale ale aplicației:
   apps/staff/src/styles/global.css și componentele din apps/client.
   ============================================================ */

export const FONT = 'var(--font-switzer), Inter, "Helvetica Neue", system-ui, sans-serif';
/** Sora, fontul de afișaj al aplicației client → Satoshi, tot geometric. */
export const DISPLAY = 'var(--font-satoshi), var(--font-switzer), system-ui, sans-serif';
export const MONO = 'var(--font-jbmono), ui-monospace, "SF Mono", Menlo, monospace';

export const focus =
  "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4A2B7A]";
export const scrollY = "overflow-y-auto overscroll-contain [scrollbar-width:thin] [scrollbar-color:#D1D5DB_transparent]";

/** Clasa de animație, sau nimic sub reduced motion. */
export function useAnim() {
  const { rm } = useDemo();
  return (k: string) => (rm ? "" : (css[k] ?? ""));
}

/* ---------- marca ---------- */
export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <span
      aria-hidden
      className="relative inline-block shrink-0 rounded-full"
      style={{ width: size, height: size, background: GRADIENT }}
    >
      <span
        className="absolute rounded-full"
        style={{ inset: size * 0.22, border: `${Math.max(1.5, size * 0.07)}px solid rgba(255,255,255,0.85)`, borderRightColor: "transparent", transform: "rotate(-30deg)" }}
      />
    </span>
  );
}

export function Wordmark({ suffix = "WELLNESS", size = 24, mark = true }: { suffix?: string; size?: number; mark?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      {mark && <LogoMark size={Math.round(size * 1.25)} />}
      <span className="flex flex-col leading-none">
        <span style={{ fontSize: size, fontWeight: 700, color: C.mov, letterSpacing: "0.02em" }}>elyssium</span>
        <span style={{ fontSize: Math.max(8, size * 0.42), fontWeight: 600, color: C.auriu, letterSpacing: "0.3em", marginTop: size * 0.14 }}>
          {suffix}
        </span>
      </span>
    </span>
  );
}

/* ---------- chip-uri, avatar ---------- */
export type Ton = "succes" | "eroare" | "avert" | "mov" | "auriu" | "neutru" | "albastru";
const TONURI: Record<Ton, [string, string]> = {
  succes: [C.fSucces, C.succes],
  eroare: [C.fEroare, C.eroare],
  avert: [C.fAvert, "#B45309"],
  mov: [C.fMov, C.mov],
  auriu: [C.fAuriu, "#86650A"],
  neutru: ["#F3F4F6", C.text2],
  albastru: [C.spaBg, C.spaText],
};

export function Chip({ ton = "neutru", children, mic }: { ton?: Ton; children: ReactNode; mic?: boolean }) {
  const [bg, fg] = TONURI[ton];
  return (
    <span
      className="inline-flex items-center gap-1 whitespace-nowrap rounded-full font-bold"
      style={{ background: bg, color: fg, fontSize: mic ? 11 : 12, letterSpacing: "0.03em", padding: mic ? "2px 8px" : "4px 10px" }}
    >
      {children}
    </span>
  );
}

const TINTE: [string, string][] = [
  [C.fMov, C.mov],
  [C.spaBg, C.spaText],
  [C.aerBg, C.aerText],
  [C.fAuriu, "#86650A"],
  [C.fSucces, C.succes],
];

export function Avatar({ prenume, nume, tint = 0, size = 36 }: { prenume: string; nume: string; tint?: number; size?: number }) {
  const [bg, fg] = TINTE[tint % TINTE.length];
  return (
    <span
      aria-hidden
      className="flex shrink-0 items-center justify-center rounded-full font-bold"
      style={{ width: size, height: size, background: bg, color: fg, fontSize: Math.round(size * 0.36) }}
    >
      {prenume.charAt(0)}
      {nume.charAt(0)}
    </span>
  );
}

/* ---------- butoane ---------- */
type BtnProps = {
  children: ReactNode;
  onClick?: () => void;
  v?: "primar" | "secundar" | "periculos" | "textPericulos" | "mov" | "avert" | "fantoma";
  mare?: boolean;
  mic?: boolean;
  lat?: boolean;
  disabled?: boolean;
  className?: string;
  style?: CSSProperties;
  label?: string;
  type?: "button" | "submit";
};

export function Btn({ children, onClick, v = "primar", mare, mic, lat, disabled, className = "", style, label, type = "button" }: BtnProps) {
  const base: CSSProperties = {
    borderRadius: 12,
    fontWeight: 600,
    fontSize: mare ? 15 : mic ? 13 : 14,
    padding: mare ? "13px 18px" : mic ? "6px 11px" : "9px 14px",
    whiteSpace: "nowrap",
  };
  const vs: Record<NonNullable<BtnProps["v"]>, CSSProperties> = {
    primar: { background: C.auriu, color: C.text },
    secundar: { background: C.card, color: C.text, boxShadow: `inset 0 0 0 1.5px ${C.contur}` },
    periculos: { background: C.eroare, color: "#fff" },
    textPericulos: { background: "transparent", color: C.eroare, padding: mic ? "6px 4px" : "8px 4px" },
    mov: { background: C.mov, color: "#fff" },
    avert: { background: C.avert, color: "#fff" },
    fantoma: { background: "transparent", color: C.text2 },
  };
  const hover =
    v === "secundar"
      ? "hover:[box-shadow:inset_0_0_0_1.5px_#4A2B7A] hover:text-[#4A2B7A]"
      : v === "fantoma"
        ? "hover:bg-[#F3F4F6] hover:text-[#111827]"
        : v === "textPericulos"
          ? "hover:underline"
          : "hover:brightness-[0.96]";
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={`inline-flex items-center justify-center gap-2 transition-[filter,box-shadow,color,background-color] duration-150 disabled:cursor-default disabled:opacity-50 ${hover} ${lat ? "w-full" : ""} ${focus} ${className}`}
      style={{ ...base, ...vs[v], ...style }}
    >
      {children}
    </button>
  );
}

/* ---------- carduri, titluri ---------- */
export function Card({ children, className = "", style, pad = true }: { children: ReactNode; className?: string; style?: CSSProperties; pad?: boolean }) {
  return (
    <div
      className={`rounded-[16px] ${className}`}
      style={{ background: C.card, border: `1px solid ${C.contur}`, boxShadow: UMBRA, padding: pad ? "18px 20px" : undefined, ...style }}
    >
      {children}
    </div>
  );
}

export function H2({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
      <h2 style={{ fontSize: 16, fontWeight: 600, color: C.text }}>{children}</h2>
      {right && <span className="whitespace-nowrap">{right}</span>}
    </div>
  );
}

export function Eticheta({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: C.text2, ...style }}>
      {children}
    </span>
  );
}

/* ---------- contoare ---------- */

/** Stilul din panoul staff: „Fitness · 7 ședințe”. */
export function ContorStaff({ c }: { c: Contor }) {
  const epuizat = c.ramase === 0;
  return (
    <span
      className="inline-flex items-baseline gap-1.5 rounded-[12px]"
      style={{
        background: epuizat ? C.fEroare : C.fundal,
        border: `1px solid ${epuizat ? "#F6CCCC" : C.contur}`,
        padding: "4px 10px",
        fontSize: 13,
      }}
    >
      <span style={{ color: epuizat ? C.eroare : C.text2, fontWeight: 600, textTransform: "capitalize" }}>{ETICHETA_TIP[c.tip]}</span>
      <span style={{ fontWeight: 700, color: epuizat ? C.eroare : C.text, fontVariantNumeric: "tabular-nums" }}>
        {c.ramase === null ? "nelimitat" : pluralSedinte(c.ramase)}
      </span>
    </span>
  );
}

/** Stilul din aplicația client: pastile colorate „7 fitness · 4 spa”. */
export function Pastile({ contoare, mic }: { contoare: Contor[]; mic?: boolean }) {
  const nelimitat = contoare.every((c) => c.ramase === null);
  if (nelimitat)
    return (
      <span className="rounded-full font-semibold" style={{ background: C.fAuriu, color: C.text, padding: mic ? "4px 10px" : "6px 12px", fontSize: mic ? 13 : 14 }}>
        Nelimitat
      </span>
    );
  return (
    <span className="flex flex-wrap justify-center gap-2">
      {contoare.map((c) => {
        const ep = c.ramase === 0;
        const p = CULORI_TIP[c.tip];
        return (
          <span
            key={c.tip}
            className="rounded-full font-semibold"
            style={{
              background: ep ? C.dezactivat : p.bg,
              color: ep ? C.text2 : p.fg,
              padding: mic ? "4px 10px" : "6px 12px",
              fontSize: mic ? 13 : 14,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {c.ramase === null ? `${ETICHETA_TIP[c.tip]} nelimitat` : `${c.ramase} ${ETICHETA_TIP[c.tip]}`}
          </span>
        );
      })}
    </span>
  );
}

/* ---------- inelul cu zilele rămase ---------- */
export function Inel({
  procent,
  valoare,
  eticheta,
  size = 216,
  grosime = 16,
  gri = false,
}: {
  procent: number;
  valoare: number;
  eticheta: string;
  size?: number;
  grosime?: number;
  gri?: boolean;
}) {
  const { rm } = useDemo();
  const id = useId().replace(/:/g, "");
  const k = useCountUp(1, 1100, !rm);
  const r = (size - grosime) / 2;
  const circ = 2 * Math.PI * r;
  const umplere = Math.max(0, Math.min(1, procent)) * k;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} aria-hidden>
        <defs>
          <linearGradient id={`g${id}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={C.mov} />
            <stop offset="0.55" stopColor={C.albastru} />
            <stop offset="1" stopColor={C.coral} />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={gri ? C.contur : C.fMov} strokeWidth={grosime} />
        {!gri && umplere > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={`url(#g${id})`}
            strokeWidth={grosime}
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={circ * (1 - umplere)}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          style={{
            fontSize: Math.round(size * 0.28),
            fontWeight: 700,
            color: gri ? C.text2 : C.text,
            lineHeight: 1,
            fontVariantNumeric: "tabular-nums",
            letterSpacing: "-0.02em",
          }}
        >
          {Math.round(valoare * k)}
        </span>
        <span style={{ fontSize: Math.max(12, Math.round(size * 0.075)), fontWeight: 500, color: C.text2, marginTop: 4 }}>{eticheta}</span>
      </div>
    </div>
  );
}

/* ---------- bifa verde ---------- */
export function Bifa({ size = 96 }: { size?: number }) {
  const a = useAnim();
  return (
    <span
      className={`flex items-center justify-center rounded-full ${a("pop")} ${a("ringPulse")}`}
      style={{ width: size, height: size, background: C.succes }}
      aria-hidden
    >
      <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 24 24" className={a("check")}>
        <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="#fff" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

export function Spinner({ color = C.mov, size = 18 }: { color?: string; size?: number }) {
  const a = useAnim();
  return (
    <span
      aria-hidden
      className={`inline-block rounded-full ${a("spin")}`}
      style={{ width: size, height: size, border: `2.5px solid ${color}33`, borderTopColor: color }}
    />
  );
}

export function LiveDot({ color = C.succes, size = 8 }: { color?: string; size?: number }) {
  const a = useAnim();
  return (
    <span className="relative inline-flex" style={{ width: size, height: size }} aria-hidden>
      <span className={`absolute inset-0 rounded-full ${a("ping")}`} style={{ background: color }} />
      <span className="relative rounded-full" style={{ width: size, height: size, background: color }} />
    </span>
  );
}

/* ---------- dialog (modal pe desktop, foaie de jos pe telefon) ---------- */
export function Dialog({
  titlu,
  subtitlu,
  onClose,
  children,
  lat,
  footer,
}: {
  titlu: string;
  subtitlu?: string;
  onClose: () => void;
  children: ReactNode;
  lat?: boolean;
  footer?: ReactNode;
}) {
  const { mobile } = useDemo();
  const a = useAnim();
  const box = useRef<HTMLDivElement>(null);
  const idT = useId();
  const inchide = useRef(onClose);
  useEffect(() => {
    inchide.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const el = box.current;
    const first = el?.querySelector<HTMLElement>("button, [href], input, textarea, select");
    first?.focus({ preventScroll: true });
    return () => prev?.focus?.({ preventScroll: true });
  }, []);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      inchide.current();
      return;
    }
    if (e.key !== "Tab" || !box.current) return;
    const f = [...box.current.querySelectorAll<HTMLElement>("button:not(:disabled), [href], input, textarea, select")];
    if (f.length === 0) return;
    const i = f.indexOf(document.activeElement as HTMLElement);
    if (e.shiftKey && i <= 0) {
      e.preventDefault();
      f[f.length - 1].focus();
    } else if (!e.shiftKey && i === f.length - 1) {
      e.preventDefault();
      f[0].focus();
    }
  };

  return (
    <div
      className={`absolute inset-0 z-50 flex ${mobile ? "items-end" : "items-center justify-center p-6"} ${a("fade")}`}
      style={{ background: "rgba(17, 24, 39, 0.45)" }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={box}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idT}
        onKeyDown={onKey}
        className={`flex flex-col ${mobile ? a("sheet") : a("modal")}`}
        style={{
          background: C.card,
          width: mobile ? "100%" : lat ? 760 : 480,
          maxHeight: mobile ? "88%" : "calc(100% - 24px)",
          borderRadius: mobile ? "20px 20px 0 0" : 16,
          boxShadow: "0 20px 50px rgba(17, 24, 39, 0.2)",
        }}
      >
        {mobile && <span aria-hidden className="mx-auto mt-2 block h-1 w-10 shrink-0 rounded-full" style={{ background: C.contur }} />}
        <div className="flex shrink-0 items-start justify-between gap-4" style={{ padding: mobile ? "12px 20px 14px" : "18px 24px", borderBottom: `1px solid ${C.contur}` }}>
          <div className="min-w-0">
            <h3 id={idT} style={{ fontSize: 18, fontWeight: 700, color: C.text }}>
              {titlu}
            </h3>
            {subtitlu && <p style={{ fontSize: 14, color: C.text2, marginTop: 2 }}>{subtitlu}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Închide"
            className={`-mr-1 flex size-8 shrink-0 items-center justify-center rounded-lg hover:bg-[#F3F4F6] ${focus}`}
            style={{ color: C.text2 }}
          >
            <X size={18} />
          </button>
        </div>
        <div className={`min-h-0 flex-1 ${scrollY}`} style={{ padding: mobile ? (footer ? "16px 20px" : "16px 20px 34px") : "20px 24px" }}>
          {children}
        </div>
        {footer && (
          <div className="shrink-0" style={{ padding: mobile ? "12px 20px 30px" : "14px 24px 18px", borderTop: `1px solid ${C.contur}` }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- grafice cu hover ---------- */

/** Coloane verticale, HTML, cu tooltip pe fiecare. */
export function Coloane({
  valori,
  etichete,
  culoare,
  muted,
  evidentiat,
  inaltime = 150,
  format,
  titluri,
  arataEticheta = () => true,
  gol = 0.36,
}: {
  valori: number[];
  etichete: string[];
  culoare: string;
  muted?: string;
  evidentiat?: number;
  inaltime?: number;
  format: (v: number) => string;
  titluri?: string[];
  arataEticheta?: (i: number) => boolean;
  gol?: number;
}) {
  const a = useAnim();
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(...valori) * 1.08;
  const n = valori.length;
  return (
    <div className="relative select-none" onMouseLeave={() => setHover(null)}>
      <div className="relative flex items-end" style={{ height: inaltime, gap: 0 }}>
        {[0.25, 0.5, 0.75, 1].map((g) => (
          <span key={g} aria-hidden className="absolute inset-x-0" style={{ bottom: `${g * 100}%`, borderTop: `1px dashed ${C.contur}` }} />
        ))}
        {valori.map((v, i) => {
          const on = hover === i;
          const ev = evidentiat === undefined || evidentiat === i;
          return (
            <div
              key={i}
              className="relative flex h-full flex-1 items-end justify-center"
              onMouseEnter={() => setHover(i)}
              style={{ padding: `0 ${Math.max(1, (gol * 100) / n / 2)}%` }}
            >
              <span
                className={`block w-full ${a("bar")}`}
                style={{
                  height: `${(v / max) * 100}%`,
                  background: ev ? culoare : (muted ?? culoare),
                  borderRadius: "4px 4px 1px 1px",
                  opacity: hover !== null && !on ? 0.55 : 1,
                  transition: "opacity 150ms",
                  animationDelay: `${i * 18}ms`,
                }}
              />
            </div>
          );
        })}
        {hover !== null && (
          <div
            className="pointer-events-none absolute z-10 -translate-x-1/2 whitespace-nowrap rounded-[10px] px-2.5 py-1.5"
            style={{
              left: `${((hover + 0.5) / n) * 100}%`,
              bottom: `${Math.min(88, (valori[hover] / max) * 100 + 4)}%`,
              background: C.text,
              color: "#fff",
              fontSize: 12,
              boxShadow: "0 8px 20px rgba(17,24,39,0.18)",
            }}
          >
            <span style={{ color: "#D1D5DB" }}>{titluri?.[hover] ?? etichete[hover]}</span>{" "}
            <b style={{ fontVariantNumeric: "tabular-nums" }}>{format(valori[hover])}</b>
          </div>
        )}
      </div>
      <div className="mt-1.5 flex" aria-hidden>
        {etichete.map((l, i) => (
          <span key={i} className="flex flex-1 justify-center whitespace-nowrap" style={{ fontSize: 11, color: evidentiat === i ? C.text : C.text2, fontWeight: evidentiat === i ? 700 : 500, width: 0 }}>
            {arataEticheta(i) ? l : ""}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Ore aglomerate — mov cu trepte de opacitate, ca în aplicația client. Coloanele se întind pe toată lățimea. */
export function Heatmap({ celula = 22, gap = 3, ziCurenta = 2, oraCurenta = 9, compact }: { celula?: number; gap?: number; ziCurenta?: number; oraCurenta?: number; compact?: boolean }) {
  const [hover, setHover] = useState<{ d: number; h: number } | null>(null);
  const trepte = [0.14, 0.3, 0.5, 0.74, 1];
  const culoare = (v: number | null) => {
    if (v === null) return "transparent";
    const t = trepte.find((x) => v <= x) ?? 1;
    return `rgba(74, 43, 122, ${t})`;
  };
  const eticheta = ["scăzut", "scăzut", "moderat", "aglomerat", "foarte aglomerat"];
  const n = ORE_HEATMAP.length;
  return (
    <div className="relative select-none" onMouseLeave={() => setHover(null)}>
      <div className="grid" style={{ gridTemplateColumns: `20px repeat(${n}, minmax(0, 1fr))`, gridTemplateRows: `14px repeat(7, ${celula}px)`, gap }}>
        <span />
        {ORE_HEATMAP.map((h) => (
          <span key={h} className="text-center" style={{ fontSize: 10, lineHeight: "14px", color: C.text2, fontVariantNumeric: "tabular-nums" }}>
            {compact ? (h % 3 === 0 ? h : "") : h % 2 === 1 ? h : ""}
          </span>
        ))}
        {HEATMAP.map((row, d) => [
          <span key={`z${d}`} className="flex items-center" style={{ fontSize: 11, color: C.text2 }}>
            {ZILE_SCURTE[d]}
          </span>,
          ...row.map((v, k) => {
            const acum = d === ziCurenta && ORE_HEATMAP[k] === oraCurenta;
            return (
              <span
                key={`${d}-${k}`}
                onMouseEnter={() => setHover({ d, h: k })}
                className="block rounded-[5px]"
                style={{
                  background: v === null ? "transparent" : v < 0.1 ? C.dezactivat : culoare(v),
                  border: v === null ? `1px dashed ${C.contur}` : undefined,
                  boxShadow: acum ? `0 0 0 2px ${C.card}, 0 0 0 4px ${C.auriu}` : undefined,
                }}
              />
            );
          }),
        ])}
      </div>
      {hover && (
        <div
          className="pointer-events-none absolute z-10 whitespace-nowrap rounded-[10px] px-2.5 py-1.5"
          style={{
            left: `calc(20px + ${gap}px + (100% - 20px - ${gap}px) * ${(hover.h + 0.5) / n})`,
            top: 14 + gap + hover.d * (celula + gap) - 34,
            transform: `translateX(${hover.h < 3 ? "-20%" : hover.h > n - 4 ? "-80%" : "-50%"})`,
            background: C.text,
            color: "#fff",
            fontSize: 12,
          }}
        >
          {["Luni", "Marți", "Miercuri", "Joi", "Vineri", "Sâmbătă", "Duminică"][hover.d]}, {ORE_HEATMAP[hover.h]}:00 ·{" "}
          <b>
            {HEATMAP[hover.d][hover.h] === null
              ? "închis"
              : eticheta[Math.min(4, Math.floor((HEATMAP[hover.d][hover.h] ?? 0) * 4.99))]}
          </b>
        </div>
      )}
    </div>
  );
}

export function LegendaHeatmap() {
  return (
    <span className="flex items-center gap-1.5" style={{ fontSize: 11, color: C.text2 }}>
      liniștit
      {[0.14, 0.3, 0.5, 0.74, 1].map((t) => (
        <span key={t} className="inline-block size-2.5 rounded-[3px]" style={{ background: `rgba(74, 43, 122, ${t})` }} />
      ))}
      aglomerat
      <span className="ml-2 inline-block size-2.5 rounded-[3px]" style={{ boxShadow: `0 0 0 2px ${C.auriu}` }} />
      acum
    </span>
  );
}
