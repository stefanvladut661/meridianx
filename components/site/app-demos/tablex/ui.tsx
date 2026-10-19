import {
  useContext,
  useEffect,
  useRef,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type ReactNode,
} from "react";
import { CircleAlert, CircleCheck, Info, Minus, Plus, X } from "lucide-react";
import type { StatusRez, Sursa } from "./data";
import { createPortal } from "react-dom";
import { Ctx } from "./ctx";
import { FONT, L, UMBRA } from "./theme";

/* ============================================================
   Piesele de interfață ale panoului TableX (shadcn/ui în produs,
   pe tokenii din src/index.css): butoane, insigne, dialoguri,
   sertare, notificări. Raze: 5px insigne, 8px elemente de meniu,
   10px controale, 12px carduri și dialoguri, 16px sertarul de jos.
   ============================================================ */

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

/* ---------- stiluri comune (hover, focus, animații) ---------- */

export function StiluriDemo() {
  return (
    <style>{`
      .tx-root { font-variant-numeric: tabular-nums; }
      .tx-root h1, .tx-root h2, .tx-root h3 { text-wrap: balance; }
      .tx-root ::selection { background: rgba(20,20,19,.14); color: ${L.fg}; }
      .tx-root *:focus-visible { outline: 2px solid ${L.fg}; outline-offset: 2px; }
      .tx-root .tx-dark *:focus-visible, .tx-root .tx-dark:focus-visible { outline-color: #edece8; }
      .tx-root input:focus-visible, .tx-root select:focus-visible, .tx-root textarea:focus-visible {
        outline: none; border-color: rgba(20,20,19,.45) !important; box-shadow: 0 0 0 3px rgba(20,20,19,.1) !important;
      }
      .tx-root [aria-invalid="true"]:focus-visible { border-color: ${L.destructive} !important; box-shadow: 0 0 0 3px rgba(196,53,43,.2) !important; }
      .tx-root input::placeholder, .tx-root textarea::placeholder { color: ${L.mutedFg}; opacity: 1; }
      .tx-root .tx-masa:hover .tx-forma { stroke-width: 3; }
      .tx-root .tx-masa:focus-visible .tx-forma { stroke: #6e9bff !important; stroke-width: 4 !important; }
      .tx-root .tx-insigna:focus-visible circle { stroke: #edece8; stroke-width: 3; }
      .tx-root .tx-slot:hover { background: #23231f; }
      .tx-root .tx-slot[aria-pressed="true"]:hover { background: #edece8; }
      .tx-root .tx-btn-dark:hover { background: #2a2a27 !important; }
      .tx-root .tx-fara-bara { scrollbar-width: none; }
      .tx-root .tx-fara-bara::-webkit-scrollbar { display: none; }
      .tx-root .tx-scroll { scrollbar-width: thin; scrollbar-color: rgba(20,20,19,.2) transparent; }
      .tx-root .tx-scroll::-webkit-scrollbar { width: 6px; height: 6px; }
      .tx-root .tx-scroll::-webkit-scrollbar-thumb { background: rgba(20,20,19,.2); border-radius: 99px; }
      .tx-root .tx-scroll-dark { scrollbar-width: thin; scrollbar-color: rgba(237,236,232,.2) transparent; }
      @keyframes tx-fade { from { opacity: 0 } to { opacity: 1 } }
      @keyframes tx-dreapta { from { transform: translateX(40px); opacity: 0 } to { transform: none; opacity: 1 } }
      @keyframes tx-stanga { from { transform: translateX(-40px); opacity: 0 } to { transform: none; opacity: 1 } }
      @keyframes tx-sus { from { transform: translateY(40px); opacity: 0 } to { transform: none; opacity: 1 } }
      @keyframes tx-pop { from { transform: scale(.95); opacity: 0 } to { transform: none; opacity: 1 } }
      @keyframes tx-toast { from { transform: translateY(8px); opacity: 0 } to { transform: none; opacity: 1 } }
      @keyframes tx-shake { 0%,100% { transform: translateX(0) } 20%,60% { transform: translateX(-4px) } 40%,80% { transform: translateX(4px) } }
      @keyframes tx-nou { from { background-color: #efeeea } to { background-color: #ffffff } }
      @keyframes tx-scan { 0% { transform: translateY(0) } 100% { transform: translateY(196px) } }
      .tx-root .tx-anim-fade { animation: tx-fade .15s ease-out both; }
      .tx-root .tx-anim-dreapta { animation: tx-dreapta .2s ease-out both; }
      .tx-root .tx-anim-stanga { animation: tx-stanga .2s ease-out both; }
      .tx-root .tx-anim-sus { animation: tx-sus .2s ease-out both; }
      .tx-root .tx-anim-pop { animation: tx-pop .15s ease-out both; }
      .tx-root .tx-anim-toast { animation: tx-toast .2s ease-out both; }
      .tx-root .tx-anim-shake { animation: tx-shake .32s ease-in-out; }
      .tx-root .tx-anim-nou { animation: tx-nou 1.6s ease-out; }
      .tx-root .tx-scan { animation: tx-scan 1.6s ease-in-out infinite alternate; }
    `}</style>
  );
}

/* ---------- buton (Button din produs) ---------- */

type Varianta = "primary" | "outline" | "secondary" | "ghost" | "destructive";
type Marime = "xs" | "sm" | "md" | "lg";

const VARIANTE: Record<Varianta, string> = {
  primary: "bg-[#141413] text-[#fafaf8] shadow-[0_1px_1px_rgba(20,20,19,.06)] hover:bg-[#373736]",
  outline:
    "border border-[#d3d0c8] bg-white text-[#141413] shadow-[0_1px_1px_rgba(20,20,19,.06)] hover:bg-[#efeeea]",
  secondary: "bg-[#eeede9] text-[#141413] hover:bg-[#e3e2de]",
  ghost: "bg-transparent text-[#141413] hover:bg-[#f1f0ec]",
  destructive: "bg-[#f9ebea] text-[#c4352b] hover:bg-[#f3d7d5]",
};
const MARIMI: Record<Marime, string> = {
  xs: "h-6 gap-1 rounded-[8px] px-2 text-[12px]",
  sm: "h-7 gap-1 rounded-[8px] px-2.5 text-[13px]",
  md: "h-8 gap-1.5 rounded-[10px] px-2.5 text-[14px]",
  lg: "h-10 gap-2 rounded-[10px] px-4 text-[15px]",
};

export function Btn({
  v = "primary",
  m = "md",
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { v?: Varianta; m?: Marime }) {
  return (
    <button
      type="button"
      {...rest}
      className={cx(
        "inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap font-[550] transition-[background-color,color,box-shadow,transform] duration-150 active:translate-y-px disabled:pointer-events-none disabled:opacity-50",
        VARIANTE[v],
        MARIMI[m],
        className
      )}
    >
      {children}
    </button>
  );
}

/* ---------- insigne ---------- */

export const ETICHETA_REZ: Record<StatusRez, string> = {
  pending: "În așteptare",
  confirmata: "Confirmată",
  sosita: "Sosită",
  anulata: "Anulată",
  no_show: "Neprezentat",
  respinsa: "Respinsă",
};

export const ETICHETA_SURSA: Record<Sursa, string> = {
  widget: "Widget public",
  manual: "Introdusă manual",
  walk_in: "Walk-in",
  telefon: "Telefonic",
};

/** Aceleași culori ca pe hartă: chihlimbar ce cere atenție, verde confirmat, roșu problemă. */
const STIL_REZ: Record<StatusRez, CSSProperties> = {
  pending: { background: L.expirareSoft, color: L.fg },
  confirmata: { background: L.liberSoft, color: L.fg },
  sosita: { background: L.liber, color: L.liberFg },
  anulata: { background: L.inactivSoft, color: L.fg },
  no_show: { background: L.ocupatSoft, color: L.fg },
  respinsa: { background: L.inactivSoft, color: L.fg },
};

export function BadgeStatus({ s, className }: { s: StatusRez; className?: string }) {
  return (
    <span
      className={cx("inline-flex h-5 shrink-0 items-center rounded-[5px] px-1.5 text-[12px] font-[550]", className)}
      style={STIL_REZ[s]}
    >
      {ETICHETA_REZ[s]}
    </span>
  );
}

/** Numărul mesei, în listă: insigna îl ține lizibil și lângă un nume lung. */
export function Chip({
  children,
  style,
  className,
}: {
  children: ReactNode;
  style?: CSSProperties;
  className?: string;
}) {
  return (
    <span
      className={cx("inline-flex shrink-0 items-center gap-1 rounded-[4px] px-1.5 py-0.5 text-[12px] font-semibold", className)}
      style={{ background: L.secondary, color: L.secondaryFg, ...style }}
    >
      {children}
    </span>
  );
}

export function Avatar({ nume, marime = 36 }: { nume: string; marime?: number }) {
  const init = nume
    .replace(/[^A-Za-zĂÂÎȘȚăâîșț ]/g, "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold"
      style={{ width: marime, height: marime, fontSize: Math.round(marime * 0.36), background: L.muted, color: L.mutedFg }}
    >
      {init}
    </span>
  );
}

/* ---------- câmp de număr (persoane) ---------- */

export function Stepper({
  value,
  onChange,
  min = 1,
  max = 20,
  eticheta,
  mare = false,
}: {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  eticheta: string;
  mare?: boolean;
}) {
  const s = mare ? 44 : 32;
  const btn =
    "inline-flex items-center justify-center rounded-[10px] border border-[#d3d0c8] bg-white text-[#141413] shadow-[0_1px_1px_rgba(20,20,19,.06)] transition-colors duration-150 hover:bg-[#efeeea] disabled:pointer-events-none disabled:opacity-50";
  return (
    <div className="flex items-center gap-2" role="group" aria-label={eticheta}>
      <button
        type="button"
        aria-label={`Mai puține (${eticheta.toLowerCase()})`}
        disabled={value <= min}
        onClick={() => onChange(Math.max(min, value - 1))}
        className={btn}
        style={{ width: s, height: s }}
      >
        <Minus size={mare ? 18 : 16} aria-hidden />
      </button>
      <output aria-live="polite" className="min-w-9 text-center font-semibold" style={{ fontSize: mare ? 24 : 16 }}>
        {value}
      </output>
      <button
        type="button"
        aria-label={`Mai multe (${eticheta.toLowerCase()})`}
        disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}
        className={btn}
        style={{ width: s, height: s }}
      >
        <Plus size={mare ? 18 : 16} aria-hidden />
      </button>
    </div>
  );
}

/* ---------- comutator segmentat (lista de taburi) ---------- */

export function Segmented<T extends string>({
  optiuni,
  value,
  onChange,
  eticheta,
  mic = false,
  className,
}: {
  optiuni: { id: T; text: ReactNode }[];
  value: T;
  onChange: (v: T) => void;
  eticheta: string;
  mic?: boolean;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={eticheta}
      className={cx("inline-flex rounded-[10px] p-[3px]", mic ? "h-7" : "h-8", className)}
      style={{ background: L.muted }}
    >
      {optiuni.map((o) => {
        const on = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(o.id)}
            className={cx(
              "inline-flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-[8px] font-medium transition-colors duration-150",
              mic ? "px-2.5 text-[13px]" : "px-3 text-[14px]",
              on ? "text-[#141413]" : "text-[#141413]/60 hover:text-[#141413]"
            )}
            style={{ background: on ? L.card : "transparent", boxShadow: on ? UMBRA.xs : undefined }}
          >
            {o.text}
          </button>
        );
      })}
    </div>
  );
}

/* ---------- comutator on/off ---------- */

export function Switch({
  on,
  onChange,
  eticheta,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  eticheta: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={eticheta}
      onClick={() => onChange(!on)}
      className="relative inline-flex h-[18px] w-8 shrink-0 items-center rounded-full transition-colors duration-150"
      style={{ background: on ? L.primary : L.input }}
    >
      <span
        aria-hidden
        className="absolute left-px top-px h-4 w-4 rounded-full transition-transform duration-150"
        style={{ background: L.bg, transform: on ? "translateX(14px)" : "none" }}
      />
    </button>
  );
}

/* ---------- dialog / sertar (în pânza demo-ului, nu fixed) ---------- */

const FOCUSABILE =
  'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

export function Modal({
  onClose,
  eticheta,
  children,
  tip = "centru",
  latime = 440,
  reducedMotion,
  className,
  style,
}: {
  onClose: () => void;
  eticheta: string;
  children: ReactNode;
  tip?: "centru" | "dreapta" | "jos";
  latime?: number;
  reducedMotion: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  const portal = useContext(Ctx)?.portal ?? null;
  const panou = useRef<HTMLDivElement>(null);
  const inchide = useRef(onClose);
  useEffect(() => {
    inchide.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const anterior = document.activeElement as HTMLElement | null;
    const p = panou.current;
    const primul = p?.querySelector<HTMLElement>("[data-autofocus]") ?? p?.querySelector<HTMLElement>(FOCUSABILE);
    (primul ?? p)?.focus({ preventScroll: true });
    return () => {
      anterior?.focus?.({ preventScroll: true });
    };
  }, []);

  const laTasta = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      inchide.current();
      return;
    }
    if (e.key !== "Tab") return;
    const el = panou.current ? Array.from(panou.current.querySelectorAll<HTMLElement>(FOCUSABILE)) : [];
    if (!el.length) return;
    const prim = el[0];
    const ultim = el[el.length - 1];
    if (e.shiftKey && document.activeElement === prim) {
      e.preventDefault();
      ultim.focus();
    } else if (!e.shiftKey && document.activeElement === ultim) {
      e.preventDefault();
      prim.focus();
    }
  };

  const anim = reducedMotion
    ? ""
    : tip === "dreapta"
      ? "tx-anim-dreapta"
      : tip === "jos"
        ? "tx-anim-sus"
        : "tx-anim-pop";

  const continut = (
    <div className="absolute inset-0 z-40" onKeyDown={laTasta}>
      <div
        aria-hidden
        className={cx("absolute inset-0", !reducedMotion && "tx-anim-fade")}
        style={{ background: tip === "centru" ? "rgba(20,20,19,.28)" : "rgba(20,20,19,.24)" }}
        onClick={onClose}
      />
      <div
        ref={panou}
        role="dialog"
        aria-modal="true"
        aria-label={eticheta}
        tabIndex={-1}
        className={cx(
          "absolute flex flex-col outline-none",
          tip === "centru" && "left-1/2 top-1/2 max-h-[92%] -translate-x-1/2 -translate-y-1/2 rounded-[12px]",
          tip === "dreapta" && "bottom-0 right-0 top-0 border-l",
          tip === "jos" && "bottom-0 left-0 right-0 max-h-[88%] rounded-t-[16px]",
          className
        )}
        style={{
          width: tip === "jos" ? undefined : latime,
          maxWidth: tip === "centru" ? "calc(100% - 24px)" : undefined,
          background: L.card,
          color: L.fg,
          borderColor: L.border,
          boxShadow: tip === "centru" ? `0 0 0 1px rgba(20,20,19,.08), ${UMBRA.xl}` : UMBRA.xl,
          ...style,
        }}
      >
        <div className={cx("flex min-h-0 flex-1 flex-col", anim)} style={{ borderRadius: "inherit" }}>
          {children}
        </div>
      </div>
    </div>
  );
  return portal ? createPortal(continut, portal) : continut;
}

export function BtnInchide({ onClick, eticheta = "Închide" }: { onClick: () => void; eticheta?: string }) {
  return (
    <button
      type="button"
      aria-label={eticheta}
      onClick={onClick}
      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] text-[#63615b] transition-colors duration-150 hover:bg-[#f1f0ec] hover:text-[#141413]"
    >
      <X size={16} aria-hidden />
    </button>
  );
}

/* ---------- notificări în aplicație (sonner, în produs) ---------- */

export type Toast = { id: number; tip: "succes" | "eroare" | "info"; text: string; desc?: string };

export function Toasturi({
  lista,
  pozitie,
  reducedMotion,
  onInchide,
}: {
  lista: Toast[];
  pozitie: "jos-dreapta" | "sus";
  reducedMotion: boolean;
  onInchide: (id: number) => void;
}) {
  return (
    <div
      aria-live="polite"
      className={cx(
        "pointer-events-none absolute z-50 flex flex-col gap-2",
        pozitie === "jos-dreapta" ? "bottom-4 right-4 w-[320px]" : "left-3 right-3 top-[104px]"
      )}
    >
      {lista.map((t) => {
        // Ca în produs: pictograma ia culoarea textului. Roșul rămâne doar pentru erori.
        const Icon = t.tip === "succes" ? CircleCheck : t.tip === "eroare" ? CircleAlert : Info;
        return (
          <div
            key={t.id}
            role={t.tip === "eroare" ? "alert" : "status"}
            className={cx("pointer-events-auto flex items-start gap-2.5 rounded-[8px] px-3.5 py-3", !reducedMotion && "tx-anim-toast")}
            style={{ background: L.card, border: `1px solid ${L.border}`, boxShadow: UMBRA.lg, fontFamily: FONT.sans }}
          >
            <Icon size={16} color={t.tip === "eroare" ? L.destructive : L.fg} className="mt-0.5 shrink-0" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-medium leading-snug" style={{ color: L.fg }}>
                {t.text}
              </p>
              {t.desc && (
                <p className="mt-0.5 text-[13px] leading-snug" style={{ color: L.mutedFg }}>
                  {t.desc}
                </p>
              )}
            </div>
            <button
              type="button"
              aria-label="Închide notificarea"
              onClick={() => onInchide(t.id)}
              className="-mr-1 -mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-[6px] text-[#63615b] transition-colors duration-150 hover:bg-[#f1f0ec] hover:text-[#141413]"
            >
              <X size={14} aria-hidden />
            </button>
          </div>
        );
      })}
    </div>
  );
}

/* ---------- card ---------- */

export function Card({
  children,
  className,
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className={cx("min-w-0 rounded-[12px]", className)}
      style={{ background: L.card, boxShadow: `${UMBRA.inel}, ${UMBRA.xs}`, ...style }}
    >
      {children}
    </div>
  );
}

/** Titlul unui card: Display, 16px, ca `CardTitle` din produs. */
export function TitluCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <h2
      className={cx("text-[16px] font-semibold leading-snug", className)}
      style={{ fontFamily: FONT.display, letterSpacing: "-0.01em" }}
    >
      {children}
    </h2>
  );
}

export const stilInput: CSSProperties = {
  height: 32,
  width: "100%",
  borderRadius: 10,
  border: `1px solid ${L.input}`,
  background: L.card,
  padding: "0 10px",
  fontSize: 14,
  color: L.fg,
  boxShadow: UMBRA.xs,
};
