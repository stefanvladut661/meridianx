"use client";

import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Pause, Play, X } from "lucide-react";
import css from "./ely.module.css";
import { C, CULORI_TIP, ETICHETA_TIP, GRADIENT, HEATMAP, ORE_HEATMAP, ZILE_SCURTE, pluralSedinte, type Contor } from "./data";
import { useDemo } from "./store";

/* ============================================================
   Piesele vizuale comune, după stilurile reale ale aplicației:
   apps/staff/src/styles/global.css și componentele din apps/client.
   Tokenurile de culoare vin din packages/shared/src/tokens.ts (data.ts).
   ============================================================ */

/** Textul de lucru, în ambele aplicații (fonts.ts). */
export const FONT = 'var(--font-ely-ui), Inter, "Helvetica Neue", Arial, system-ui, sans-serif';
/** Sora, fața de afișaj a aplicației client. */
export const DISPLAY = 'var(--font-ely-sora), var(--font-ely-ui), system-ui, sans-serif';
/** Cifre de aceeași lățime: ore, coduri, sume, coloane. */
export const CIFRE: CSSProperties = { fontVariantNumeric: "tabular-nums" };

export const focus =
  "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4A2B7A]";
/** Pentru rândurile lipite unul de altul: inelul de focus intră în rând. */
export const focusInterior =
  "outline-none focus-visible:outline-2 focus-visible:[outline-offset:-2px] focus-visible:outline-[#4A2B7A]";
export const scrollY = "overflow-y-auto overscroll-contain [scrollbar-width:thin] [scrollbar-color:#D1D5DB_transparent]";

/** Câmpurile de text: chenar gri, chenar mov de 2px la focus. */
export const campCls =
  "w-full rounded-[8px] outline-none placeholder:text-[#9CA3AF] focus:[border-color:#4A2B7A] focus:[box-shadow:inset_0_0_0_1px_#4A2B7A]";
export const campStil: CSSProperties = { border: `1px solid ${C.conturCamp}`, background: C.card, color: C.text, fontSize: 14 };

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
      <span className="flex flex-col leading-none" style={{ fontFamily: DISPLAY }}>
        <span style={{ fontSize: size, fontWeight: 600, color: C.mov, letterSpacing: "-0.01em" }}>elyssium</span>
        <span style={{ fontSize: Math.max(8, size * 0.4), fontWeight: 600, color: C.auriu, letterSpacing: "0.3em", marginTop: size * 0.16 }}>
          {suffix}
        </span>
      </span>
    </span>
  );
}

/* ---------- etichete de stare, avatar ---------- */
export type Ton = "succes" | "eroare" | "avert" | "mov" | "auriu" | "neutru" | "albastru";
const TONURI: Record<Ton, [string, string]> = {
  succes: [C.fSucces, C.succes],
  eroare: [C.fEroare, C.eroareText],
  avert: [C.fAvert, C.avertCerneala],
  mov: [C.fMov, C.mov],
  auriu: [C.fAuriu, C.auriuText],
  neutru: [C.dezactivat, C.text2Tare],
  albastru: [C.spaBg, C.spaText],
};

/** O stare care schimbă ce face recepția. Stările normale rămân text simplu. */
export function Chip({ ton = "neutru", children }: { ton?: Ton; children: ReactNode }) {
  const [bg, fg] = TONURI[ton];
  return (
    <span
      className="inline-flex items-center gap-1 whitespace-nowrap rounded-[6px]"
      style={{ background: bg, color: fg, fontSize: 12, fontWeight: 600, lineHeight: "16px", padding: "2px 8px" }}
    >
      {children}
    </span>
  );
}

const TINTE: [string, string][] = [
  [C.fMov, C.mov],
  [C.spaBg, C.spaText],
  [C.aerBg, C.aerText],
  [C.fAuriu, C.auriuText],
  [C.fSucces, C.succes],
];

export function Avatar({ prenume, nume, tint = 0, size = 36 }: { prenume: string; nume: string; tint?: number; size?: number }) {
  const [bg, fg] = TINTE[tint % TINTE.length];
  return (
    <span
      aria-hidden
      className="flex shrink-0 items-center justify-center rounded-full"
      style={{ width: size, height: size, background: bg, color: fg, fontSize: Math.round(size * 0.36), fontWeight: 600 }}
    >
      {prenume.charAt(0)}
      {nume.charAt(0)}
    </span>
  );
}

/** Punctul static din „58 în sală”. */
export function Punct({ color = C.succes, size = 6 }: { color?: string; size?: number }) {
  return <span aria-hidden className="inline-block shrink-0 rounded-full" style={{ width: size, height: size, background: color }} />;
}

/* ---------- butoane ---------- */
type BtnProps = {
  children: ReactNode;
  onClick?: () => void;
  v?: "primar" | "secundar" | "periculos" | "textPericulos" | "mov" | "fantoma";
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
    borderRadius: 8,
    fontWeight: 600,
    fontSize: mare ? 15 : mic ? 13 : 14,
    lineHeight: "20px",
    padding: mare ? "12px 18px" : mic ? "5px 10px" : "8px 14px",
    whiteSpace: "nowrap",
  };
  const vs: Record<NonNullable<BtnProps["v"]>, CSSProperties> = {
    primar: { background: C.auriu, color: C.text },
    secundar: { background: C.card, color: C.text, boxShadow: `inset 0 0 0 1px ${C.conturCamp}` },
    periculos: { background: C.eroare, color: "#fff" },
    textPericulos: { background: "transparent", color: C.eroareText, padding: mic ? "5px 6px" : "8px 8px" },
    mov: { background: C.mov, color: "#fff" },
    fantoma: { background: "transparent", color: C.text2Tare },
  };
  const hover =
    v === "secundar"
      ? "hover:bg-[#F9FAFB]"
      : v === "fantoma"
        ? "hover:bg-[#F3F4F6] hover:text-[#111827]"
        : v === "textPericulos"
          ? "hover:bg-[#FEF2F2]"
          : "hover:brightness-[0.96]";
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={`inline-flex items-center justify-center gap-1.5 transition-[filter,background-color,color] duration-150 disabled:cursor-default disabled:opacity-50 ${disabled ? "" : hover} ${lat ? "w-full" : ""} ${focus} ${className}`}
      style={{ ...base, ...vs[v], ...style }}
    >
      {children}
    </button>
  );
}

/** Oprește sau pornește lista care se actualizează singură (WCAG 2.2.2). */
export function ButonPauza({ mic }: { mic?: boolean }) {
  const { pauza, setPauza } = useDemo();
  return (
    <Btn v="secundar" mic={mic} onClick={() => setPauza(!pauza)}>
      {pauza ? <Play size={14} /> : <Pause size={14} />}
      {pauza ? "Continuă" : "Pauză"}
    </Btn>
  );
}

/** Comutatorul pornit/oprit. Starea scrisă stă lângă el, în text („Pornit · …”). */
export function Comutator({ on, onChange, eticheta }: { on: boolean; onChange: (v: boolean) => void; eticheta: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={eticheta}
      onClick={() => onChange(!on)}
      className={`relative h-6 w-10 shrink-0 rounded-full transition-colors duration-150 ease-out ${focus}`}
      style={{ background: on ? C.succes : C.conturCamp }}
    >
      <span
        aria-hidden
        className="absolute top-0.5 size-5 rounded-full bg-white transition-[left] duration-150 ease-out"
        style={{ left: on ? 18 : 2, boxShadow: "0 1px 2px rgba(17,24,39,0.2)" }}
      />
    </button>
  );
}

/* ---------- carduri, titluri ---------- */
export function Card({ children, className = "", style, pad = true }: { children: ReactNode; className?: string; style?: CSSProperties; pad?: boolean }) {
  const { mobile } = useDemo();
  return (
    <div
      className={`rounded-[12px] ${className}`}
      style={{ background: C.card, border: `1px solid ${C.contur}`, padding: pad ? (mobile ? 16 : "16px 20px") : undefined, ...style }}
    >
      {children}
    </div>
  );
}

export function H2({ children, right, id }: { children: ReactNode; right?: ReactNode; id?: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
      <h2 id={id} style={{ fontSize: 15, fontWeight: 600, color: C.text, lineHeight: 1.35 }}>
        {children}
      </h2>
      {right && (
        <span className="whitespace-nowrap" style={{ fontSize: 13, color: C.text2 }}>
          {right}
        </span>
      )}
    </div>
  );
}

export function Eticheta({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <span style={{ fontSize: 13, fontWeight: 500, color: C.text2, ...style }}>{children}</span>;
}

/** Banda de indicatori: o singură casetă, celule despărțite de linii de 1px. */
export function Indicatori({ items }: { items: { eticheta: string; valoare: string; detaliu?: ReactNode }[] }) {
  const { mobile } = useDemo();
  return (
    <dl
      className={`grid overflow-hidden rounded-[12px] ${mobile ? "grid-cols-2" : "grid-cols-4"}`}
      style={{ gap: 1, background: C.contur, border: `1px solid ${C.contur}` }}
    >
      {items.map((it) => (
        <div key={it.eticheta} className="flex min-w-0 flex-col gap-0.5" style={{ background: C.card, padding: mobile ? "12px 14px" : "14px 16px" }}>
          <dt style={{ fontSize: 13, fontWeight: 500, color: C.text2 }}>{it.eticheta}</dt>
          <dd style={{ fontSize: mobile ? 20 : 24, fontWeight: 600, lineHeight: 1.3, letterSpacing: "-0.01em", color: C.text, whiteSpace: "nowrap", ...CIFRE }}>
            {it.valoare}
          </dd>
          {it.detaliu && <dd style={{ fontSize: 12.5, color: C.text2, ...CIFRE }}>{it.detaliu}</dd>}
        </div>
      ))}
    </dl>
  );
}

/** Comutator cu opțiuni care se exclud: luna, filtrul de stare, cine scanează. */
export function Segmentat<T extends string>({
  optiuni,
  valoare,
  onChange,
  eticheta,
  className = "",
}: {
  optiuni: { v: T; eticheta: ReactNode }[];
  valoare: T;
  onChange: (v: T) => void;
  eticheta: string;
  className?: string;
}) {
  return (
    <div role="group" aria-label={eticheta} className={`flex shrink-0 rounded-[10px] ${className}`} style={{ background: C.dezactivat, padding: 3, gap: 2 }}>
      {optiuni.map((o) => {
        const on = o.v === valoare;
        return (
          <button
            key={o.v || "_"}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(o.v)}
            className={`whitespace-nowrap rounded-[7px] text-left transition-colors duration-150 ${on ? "" : "hover:text-[#111827]"} ${focus}`}
            style={{
              padding: "5px 12px",
              fontSize: 13.5,
              lineHeight: "20px",
              fontWeight: on ? 600 : 500,
              color: on ? C.text : C.text2Tare,
              background: on ? C.card : "transparent",
              boxShadow: on ? `inset 0 0 0 1px ${C.contur}` : undefined,
            }}
          >
            {o.eticheta}
          </button>
        );
      })}
    </div>
  );
}

/* ---------- contoare ---------- */

/** Stilul din panoul staff: „Fitness 7 ședințe”. */
export function ContorStaff({ c }: { c: Contor }) {
  const epuizat = c.ramase === 0;
  return (
    <span
      className="inline-flex items-baseline gap-1.5 rounded-[6px]"
      style={{
        background: epuizat ? "#FEF2F2" : C.card,
        border: `1px solid ${epuizat ? "#FECACA" : C.contur}`,
        padding: "3px 8px",
        fontSize: 13,
        lineHeight: "18px",
      }}
    >
      <span style={{ color: epuizat ? C.eroareText : C.text2Tare, fontWeight: 500, textTransform: "capitalize" }}>{ETICHETA_TIP[c.tip]}</span>
      <span style={{ fontWeight: 600, color: epuizat ? C.eroareText : C.text, ...CIFRE }}>
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
      <span className="rounded-full" style={{ background: C.fAuriu, color: C.auriuText, fontWeight: 600, padding: mic ? "4px 10px" : "6px 12px", fontSize: mic ? 13 : 14 }}>
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
            className="rounded-full"
            style={{
              background: ep ? C.dezactivat : p.bg,
              color: ep ? C.text2Tare : p.fg,
              fontWeight: 600,
              padding: mic ? "4px 10px" : "6px 12px",
              fontSize: mic ? 13 : 14,
              ...CIFRE,
            }}
          >
            {c.ramase === null ? `${ETICHETA_TIP[c.tip]} nelimitat` : `${c.ramase} ${ETICHETA_TIP[c.tip]}`}
          </span>
        );
      })}
    </span>
  );
}

/* ---------- cercul cu zilele rămase ---------- */
export function Inel({
  procent,
  valoare,
  eticheta,
  size = 184,
  grosime = 12,
  gri = false,
}: {
  procent: number;
  valoare: number;
  eticheta: string;
  size?: number;
  grosime?: number;
  gri?: boolean;
}) {
  const r = (size - grosime) / 2;
  const circ = 2 * Math.PI * r;
  const umplere = Math.max(0, Math.min(1, procent));
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={gri ? C.contur : C.fMov} strokeWidth={grosime} />
        {!gri && umplere > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={C.mov}
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
            fontFamily: DISPLAY,
            fontSize: Math.round(size * 0.24),
            fontWeight: 600,
            color: gri ? C.text2 : C.text,
            lineHeight: 1,
            letterSpacing: "-0.02em",
            ...CIFRE,
          }}
        >
          {valoare}
        </span>
        <span style={{ fontSize: 13, fontWeight: 500, color: C.text2, marginTop: 6 }}>{eticheta}</span>
      </div>
    </div>
  );
}

/* ---------- bifa de la intrarea reușită ---------- */
export function Bifa({ size = 88 }: { size?: number }) {
  const a = useAnim();
  return (
    <span className="flex items-center justify-center rounded-full" style={{ width: size, height: size, background: C.succes }} aria-hidden>
      <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 24 24" className={a("check")}>
        <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

export function Spinner({ color = C.mov, size = 18 }: { color?: string; size?: number }) {
  const a = useAnim();
  return (
    <span
      aria-hidden
      className={`inline-block shrink-0 rounded-full ${a("spin")}`}
      style={{ width: size, height: size, border: `2px solid ${color}33`, borderTopColor: color }}
    />
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
    // câmpul marcat (ex. căutarea din check-in manual), altfel primul element
    const first =
      el?.querySelector<HTMLElement>("[data-autofocus]") ?? el?.querySelector<HTMLElement>("button, [href], input, textarea, select");
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
          borderRadius: mobile ? "16px 16px 0 0" : 16,
          boxShadow: "0 16px 40px rgba(17, 24, 39, 0.18)",
        }}
      >
        {mobile && <span aria-hidden className="mx-auto mt-2 block h-1 w-9 shrink-0 rounded-full" style={{ background: C.conturCamp }} />}
        <div className="flex shrink-0 items-start justify-between gap-4" style={{ padding: mobile ? "10px 20px 12px" : "16px 24px", borderBottom: `1px solid ${C.contur}` }}>
          <div className="min-w-0">
            <h3 id={idT} style={{ fontSize: mobile ? 17 : 18, fontWeight: 600, color: C.text, lineHeight: 1.35 }}>
              {titlu}
            </h3>
            {subtitlu && <p style={{ fontSize: 13.5, color: C.text2, marginTop: 1, ...CIFRE }}>{subtitlu}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Închide"
            className={`-mr-1.5 flex size-8 shrink-0 items-center justify-center rounded-[8px] hover:bg-[#F3F4F6] ${focus}`}
            style={{ color: C.text2Tare }}
          >
            <X size={18} />
          </button>
        </div>
        <div className={`min-h-0 flex-1 ${scrollY}`} style={{ padding: mobile ? (footer ? "16px 20px" : "16px 20px 34px") : "20px 24px" }}>
          {children}
        </div>
        {footer && (
          <div className="shrink-0" style={{ padding: mobile ? "12px 20px 30px" : "14px 24px 16px", borderTop: `1px solid ${C.contur}` }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- grafice cu hover ---------- */

/** Pasul rotund al axei: 171.090 → 200.000, 333 → 400. */
function pasRotund(x: number) {
  if (x <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(x)));
  const f = x / p;
  return ([1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find((n) => f <= n) ?? 10) * p;
}

const AX = 48;

/** Coloane verticale, o singură culoare, cu axa Y la 0 · jumătate · maxim și tooltip. */
export function Coloane({
  valori,
  etichete,
  evidentiat,
  inaltime = 150,
  format,
  formatAx,
  titluri,
  arataEticheta = () => true,
  gol = 0.36,
  descriere,
}: {
  valori: number[];
  etichete: string[];
  evidentiat?: number;
  inaltime?: number;
  format: (v: number) => string;
  formatAx: (v: number) => string;
  titluri?: string[];
  arataEticheta?: (i: number) => boolean;
  gol?: number;
  descriere: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const max = pasRotund(Math.max(...valori) / 2) * 2;
  const n = valori.length;
  return (
    <div className="relative select-none" role="img" aria-label={descriere} onMouseLeave={() => setHover(null)}>
      <div className="relative" style={{ height: inaltime, marginLeft: AX }}>
        {[0, 0.5, 1].map((g) => (
          <span key={g} aria-hidden className="absolute inset-x-0" style={{ bottom: `${g * 100}%`, borderTop: `1px solid ${g === 0 ? C.conturCamp : C.grila}` }} />
        ))}
        {[0, 0.5, 1].map((g) => (
          <span
            key={`ax${g}`}
            aria-hidden
            className="absolute whitespace-nowrap text-right"
            style={{ right: "calc(100% + 8px)", bottom: `${g * 100}%`, transform: "translateY(50%)", fontSize: 11, lineHeight: "14px", color: C.text2, ...CIFRE }}
          >
            {formatAx(max * g)}
          </span>
        ))}
        <div className="absolute inset-0 flex items-end">
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
                  className="block w-full"
                  style={{
                    height: `${(v / max) * 100}%`,
                    background: ev ? C.mov : C.movStins,
                    borderRadius: "3px 3px 0 0",
                    opacity: hover !== null && !on ? 0.6 : 1,
                    transition: "opacity 150ms ease-out",
                  }}
                />
              </div>
            );
          })}
        </div>
        {hover !== null && (
          <div
            className="pointer-events-none absolute z-10 -translate-x-1/2 whitespace-nowrap rounded-[8px] px-2.5 py-1.5"
            style={{
              left: `${((hover + 0.5) / n) * 100}%`,
              bottom: `${Math.min(88, (valori[hover] / max) * 100 + 4)}%`,
              background: C.text,
              color: "#fff",
              fontSize: 12,
              boxShadow: "0 4px 12px rgba(17,24,39,0.16)",
            }}
          >
            <span style={{ color: "#D1D5DB" }}>{titluri?.[hover] ?? etichete[hover]}</span>{" "}
            <span style={{ fontWeight: 600, ...CIFRE }}>{format(valori[hover])}</span>
          </div>
        )}
      </div>
      <div className="mt-1.5 flex" style={{ marginLeft: AX }} aria-hidden>
        {etichete.map((l, i) => (
          <span
            key={i}
            className="flex flex-1 justify-center whitespace-nowrap"
            style={{ fontSize: 11, color: evidentiat === i ? C.text : C.text2, fontWeight: evidentiat === i ? 600 : 400, width: 0 }}
          >
            {arataEticheta(i) ? l : ""}
          </span>
        ))}
      </div>
    </div>
  );
}

const NIVEL = ["liniștit", "liniștit", "moderat", "aglomerat", "foarte aglomerat"];

/** Ore aglomerate: mov în trepte de opacitate, ca în aplicația client. Coloanele se întind pe toată lățimea. */
export function Heatmap({ celula = 22, gap = 3, ziCurenta = 2, oraCurenta = 10, compact }: { celula?: number; gap?: number; ziCurenta?: number; oraCurenta?: number; compact?: boolean }) {
  const [hover, setHover] = useState<{ d: number; h: number } | null>(null);
  const trepte = [0.14, 0.3, 0.5, 0.74, 1];
  const culoare = (v: number | null) => {
    if (v === null) return "transparent";
    const t = trepte.find((x) => v <= x) ?? 1;
    return `rgba(74, 43, 122, ${t})`;
  };
  const n = ORE_HEATMAP.length;
  return (
    <div className="relative select-none" onMouseLeave={() => setHover(null)}>
      <div className="grid" style={{ gridTemplateColumns: `20px repeat(${n}, minmax(0, 1fr))`, gridTemplateRows: `14px repeat(7, ${celula}px)`, gap }}>
        <span />
        {ORE_HEATMAP.map((h) => (
          <span key={h} className="text-center" style={{ fontSize: 10.5, lineHeight: "14px", color: C.text2, ...CIFRE }}>
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
                className="block rounded-[4px]"
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
          className="pointer-events-none absolute z-10 whitespace-nowrap rounded-[8px] px-2.5 py-1.5"
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
          <span style={{ fontWeight: 600 }}>
            {HEATMAP[hover.d][hover.h] === null ? "închis" : NIVEL[Math.min(4, Math.floor((HEATMAP[hover.d][hover.h] ?? 0) * 4.99))]}
          </span>
        </div>
      )}
    </div>
  );
}

export function LegendaHeatmap() {
  return (
    <span className="flex items-center gap-1.5" style={{ fontSize: 11.5, color: C.text2 }}>
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
