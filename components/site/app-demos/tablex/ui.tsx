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
import { FONT, L } from "./theme";

/* ============================================================
   Piesele de interfață ale panoului TableX (shadcn/ui în produs):
   butoane, insigne, dialoguri, sertare, notificări.
   ============================================================ */

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

/* ---------- stiluri comune (hover, focus, animații) ---------- */

export function StiluriDemo() {
  return (
    <style>{`
      .tx-root *:focus-visible { outline: 2px solid ${L.primary}; outline-offset: 2px; }
      .tx-root .tx-dark *:focus-visible, .tx-root .tx-dark:focus-visible { outline-color: #60a5fa; }
      .tx-root .tx-masa:hover .tx-forma { stroke-width: 3.5; }
      .tx-root .tx-masa:focus-visible .tx-forma { stroke: #60a5fa !important; stroke-width: 5 !important; }
      .tx-root .tx-insigna:focus-visible circle { stroke: #f8fafc; stroke-width: 3; }
      .tx-root .tx-slot:hover { background: #1e293b; }
      .tx-root .tx-slot[aria-pressed="true"]:hover { background: #60a5fa; }
      .tx-root .tx-btn-dark:hover { background: #1e293b !important; }
      .tx-root .tx-fara-bara { scrollbar-width: none; }
      .tx-root .tx-fara-bara::-webkit-scrollbar { display: none; }
      .tx-root .tx-scroll { scrollbar-width: thin; scrollbar-color: rgba(15,23,42,.22) transparent; }
      .tx-root .tx-scroll::-webkit-scrollbar { width: 6px; height: 6px; }
      .tx-root .tx-scroll::-webkit-scrollbar-thumb { background: rgba(15,23,42,.2); border-radius: 99px; }
      .tx-root .tx-scroll-dark { scrollbar-width: thin; scrollbar-color: rgba(248,250,252,.2) transparent; }
      @keyframes tx-halou { 0%,100% { opacity: .35 } 50% { opacity: 1 } }
      .tx-root .tx-halou { animation: tx-halou 1.4s ease-in-out infinite; }
      @keyframes tx-fade { from { opacity: 0 } to { opacity: 1 } }
      @keyframes tx-dreapta { from { transform: translateX(28px); opacity: 0 } to { transform: none; opacity: 1 } }
      @keyframes tx-sus { from { transform: translateY(40px); opacity: 0 } to { transform: none; opacity: 1 } }
      @keyframes tx-pop { from { transform: scale(.96); opacity: 0 } to { transform: none; opacity: 1 } }
      @keyframes tx-toast { from { transform: translateY(10px); opacity: 0 } to { transform: none; opacity: 1 } }
      @keyframes tx-shake { 0%,100% { transform: translateX(0) } 20%,60% { transform: translateX(-4px) } 40%,80% { transform: translateX(4px) } }
      @keyframes tx-nou { from { background: #dbeafe } to { background: transparent } }
      @keyframes tx-puls { 0% { box-shadow: 0 0 0 0 rgba(16,185,129,.55) } 70% { box-shadow: 0 0 0 7px rgba(16,185,129,0) } 100% { box-shadow: 0 0 0 0 rgba(16,185,129,0) } }
      @keyframes tx-scan { 0% { transform: translateY(0) } 100% { transform: translateY(196px) } }
      .tx-root .tx-anim-fade { animation: tx-fade .2s ease both; }
      .tx-root .tx-anim-dreapta { animation: tx-dreapta .28s cubic-bezier(.16,1,.3,1) both; }
      .tx-root .tx-anim-sus { animation: tx-sus .3s cubic-bezier(.16,1,.3,1) both; }
      .tx-root .tx-anim-pop { animation: tx-pop .22s cubic-bezier(.16,1,.3,1) both; }
      .tx-root .tx-anim-toast { animation: tx-toast .25s cubic-bezier(.16,1,.3,1) both; }
      .tx-root .tx-anim-shake { animation: tx-shake .32s ease-in-out; }
      .tx-root .tx-anim-nou { animation: tx-nou 2.4s ease-out both; }
      .tx-root .tx-puls { animation: tx-puls 1.8s ease-out infinite; }
      .tx-root .tx-scan { animation: tx-scan 1.6s ease-in-out infinite alternate; }
    `}</style>
  );
}

/* ---------- buton ---------- */

type Varianta = "primary" | "outline" | "secondary" | "ghost" | "destructive" | "walkin";
type Marime = "xs" | "sm" | "md" | "lg";

const VARIANTE: Record<Varianta, string> = {
  primary: "bg-[#1d4ed8] text-white hover:bg-[#1e40af] disabled:bg-[#93a8e6]",
  outline: "border border-[#e2e8f0] bg-white text-[#0f172a] hover:bg-[#f1f5f9] disabled:text-[#94a3b8]",
  secondary: "bg-[#e2e8f0] text-[#1e293b] hover:bg-[#cbd5e1]",
  ghost: "bg-transparent text-[#0f172a] hover:bg-[#f1f5f9]",
  destructive: "bg-[#dc2626] text-white hover:bg-[#b91c1c]",
  walkin: "bg-[#10b981] text-[#052e1f] hover:bg-[#0ea371]",
};
const MARIMI: Record<Marime, string> = {
  xs: "h-7 gap-1 rounded-md px-2.5 text-[12px]",
  sm: "h-8 gap-1.5 rounded-md px-3 text-[13px]",
  md: "h-9 gap-2 rounded-lg px-4 text-[14px]",
  lg: "h-11 gap-2 rounded-lg px-5 text-[15px]",
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
        "inline-flex shrink-0 items-center justify-center whitespace-nowrap font-medium transition-colors disabled:cursor-not-allowed",
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
      className={cx("inline-flex shrink-0 items-center rounded-md px-2 py-0.5 text-[12px] font-medium", className)}
      style={STIL_REZ[s]}
    >
      {ETICHETA_REZ[s]}
    </span>
  );
}

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
      className={cx("inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[12px] font-semibold tabular-nums", className)}
      style={{ background: L.secondary, color: L.secondaryFg, ...style }}
    >
      {children}
    </span>
  );
}

export function Avatar({ nume, marime = 36, culoare }: { nume: string; marime?: number; culoare?: string }) {
  const init = nume
    .replace(/[^A-Za-zĂÂÎȘȚăâîșț ]/g, "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
  let h = 0;
  for (const ch of nume) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const paleta = ["#dbeafe", "#d1fae5", "#fef3c7", "#ede9fe", "#ffedd5", "#e0f2fe", "#fce7f3"];
  const text = ["#1e40af", "#065f46", "#92400e", "#5b21b6", "#9a3412", "#075985", "#9d174d"];
  const i = h % paleta.length;
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold"
      style={{
        width: marime,
        height: marime,
        fontSize: marime * 0.38,
        background: culoare ?? paleta[i],
        color: culoare ? "#fff" : text[i],
      }}
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
  const s = mare ? 44 : 36;
  return (
    <div className="flex items-center gap-2" role="group" aria-label={eticheta}>
      <button
        type="button"
        aria-label={`Mai puține (${eticheta.toLowerCase()})`}
        disabled={value <= min}
        onClick={() => onChange(Math.max(min, value - 1))}
        className="inline-flex items-center justify-center rounded-lg border border-[#e2e8f0] bg-white text-[#0f172a] hover:bg-[#f1f5f9] disabled:opacity-40"
        style={{ width: s, height: s }}
      >
        <Minus size={mare ? 20 : 16} aria-hidden />
      </button>
      <output
        aria-live="polite"
        className="min-w-10 text-center font-semibold tabular-nums"
        style={{ fontSize: mare ? 26 : 18 }}
      >
        {value}
      </output>
      <button
        type="button"
        aria-label={`Mai multe (${eticheta.toLowerCase()})`}
        disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}
        className="inline-flex items-center justify-center rounded-lg border border-[#e2e8f0] bg-white text-[#0f172a] hover:bg-[#f1f5f9] disabled:opacity-40"
        style={{ width: s, height: s }}
      >
        <Plus size={mare ? 20 : 16} aria-hidden />
      </button>
    </div>
  );
}

/* ---------- comutator segmentat ---------- */

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
      className={cx("inline-flex rounded-lg p-[3px]", className)}
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
              "inline-flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-md font-medium transition-colors",
              mic ? "h-7 px-2.5 text-[12.5px]" : "h-8 px-3 text-[13px]"
            )}
            style={{
              background: on ? L.card : "transparent",
              color: on ? L.fg : L.mutedFg,
              boxShadow: on ? "0 1px 2px rgba(15,23,42,.08), 0 0 0 1px rgba(15,23,42,.04)" : undefined,
            }}
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
      className="relative inline-flex h-[22px] w-[40px] shrink-0 items-center rounded-full transition-colors"
      style={{ background: on ? L.primary : "#cbd5e1" }}
    >
      <span
        aria-hidden
        className="absolute left-[3px] top-[3px] h-4 w-4 rounded-full bg-white shadow transition-transform"
        style={{ transform: on ? "translateX(18px)" : "none" }}
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
        style={{ background: "rgba(15,23,42,.45)" }}
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
          tip === "centru" && "left-1/2 top-1/2 max-h-[92%] -translate-x-1/2 -translate-y-1/2 rounded-xl",
          tip === "dreapta" && "bottom-0 right-0 top-0",
          tip === "jos" && "bottom-0 left-0 right-0 max-h-[88%] rounded-t-2xl",
          className
        )}
        style={{
          width: tip === "jos" ? undefined : latime,
          maxWidth: tip === "centru" ? "calc(100% - 24px)" : undefined,
          background: L.card,
          color: L.fg,
          boxShadow: "0 24px 64px -16px rgba(15,23,42,.45)",
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
      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[#475569] hover:bg-[#f1f5f9] hover:text-[#0f172a]"
    >
      <X size={18} aria-hidden />
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
        pozitie === "jos-dreapta" ? "bottom-3 right-2 w-[276px]" : "left-3 right-3 top-[104px]"
      )}
    >
      {lista.map((t) => {
        const Icon = t.tip === "succes" ? CircleCheck : t.tip === "eroare" ? CircleAlert : Info;
        const culoare = t.tip === "succes" ? L.liber : t.tip === "eroare" ? L.destructive : L.primary;
        return (
          <div
            key={t.id}
            role={t.tip === "eroare" ? "alert" : "status"}
            className={cx("pointer-events-auto flex items-start gap-2.5 rounded-lg px-3.5 py-3", !reducedMotion && "tx-anim-toast")}
            style={{
              background: L.card,
              border: `1px solid ${L.border}`,
              boxShadow: "0 12px 32px -12px rgba(15,23,42,.35)",
              fontFamily: FONT.sans,
            }}
          >
            <Icon size={18} color={culoare} className="mt-px shrink-0" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] font-medium leading-snug" style={{ color: L.fg }}>
                {t.text}
              </p>
              {t.desc && (
                <p className="mt-0.5 text-[12.5px] leading-snug" style={{ color: L.mutedFg }}>
                  {t.desc}
                </p>
              )}
            </div>
            <button
              type="button"
              aria-label="Închide notificarea"
              onClick={() => onInchide(t.id)}
              className="-mr-1 -mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-[#94a3b8] hover:text-[#0f172a]"
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
      className={cx("min-w-0 rounded-xl", className)}
      style={{
        background: L.card,
        boxShadow: "0 0 0 1px rgba(15,23,42,.07), 0 1px 2px rgba(15,23,42,.05)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function Eticheta({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="text-[13px] font-medium" style={{ color: L.fg }}>
      {children}
    </label>
  );
}

export const stilInput: CSSProperties = {
  height: 38,
  width: "100%",
  borderRadius: 8,
  border: `1px solid ${L.border}`,
  background: L.card,
  padding: "0 12px",
  fontSize: 14,
  color: L.fg,
};
