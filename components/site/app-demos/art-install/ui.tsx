"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import type { DemoDevice } from "../types";
import type { CalcForm, ProductCategory, PfCategory } from "./data";

/* ============================================================
   Trusa vizuală Art Instal: paleta reală a site-ului (index.css),
   fonturile (Playfair Display + DM Sans → serif de sistem + Satoshi),
   raza de 12px, butoanele .btn-primary / .btn-outline-white.
   ============================================================ */

/* Culorile din :root, convertite din HSL. */
export const C = {
  bg: "#0E1115", // --background 220 20% 7%
  fg: "#EBE6E0", // --foreground 36 20% 90%
  card: "#15181E", // --card / --cream 220 18% 10%
  muted: "#1E2229", // --muted / --secondary 220 15% 14%
  mutedFg: "#9096A2", // --muted-foreground 220 9% 60%
  border: "#272C35", // --border 220 15% 18%
  navy: "#0A0C0F", // --navy 220 20% 5%
  white: "#F6F3EE", // --primary-foreground 36 33% 95%
  orange: "#F97316", // --accent 24 95% 53%
  orangeHover: "#E55F06",
  wizard: "#A370EB", // --wizard 265 75% 68%
  whatsapp: "#25D466", // --whatsapp 142 70% 49%
};

export const HEAD = `"Playfair Display", Georgia, "Times New Roman", serif`;
export const BODY = `var(--font-satoshi), "DM Sans", system-ui, sans-serif`;

export const IMG = "/software/proiecte/art-install";
export const SHEETS = {
  prod: { src: `${IMG}/produse.webp`, n: 10, tile: 4 / 3 },
  a: { src: `${IMG}/lucrari-a.webp`, n: 5, tile: 4 / 3 },
  b: { src: `${IMG}/lucrari-b.webp`, n: 5, tile: 4 / 3 },
} as const;
export type SheetId = keyof typeof SHEETS;

/* ---------------- Contextul demo-ului ---------------- */

export type ContactPrefill = {
  service?: string;
  message?: string;
  context?: string;
};

export type Nav = {
  go: (screen: string) => void;
  shop: (cat?: ProductCategory | "toate") => void;
  portfolio: (cat?: PfCategory) => void;
  contact: (prefill?: ContactPrefill) => void;
  /** Pagini care nu fac parte din demo. */
  off: (page: string) => void;
};

type Ctx = {
  device: DemoDevice;
  mobile: boolean;
  reduced: boolean;
  scroller: HTMLDivElement | null;
  overlay: HTMLDivElement | null;
  notify: (m: string) => void;
  nav: Nav;
  form: CalcForm;
  setForm: (f: CalcForm | ((f: CalcForm) => CalcForm)) => void;
};

export const AICtx = createContext<Ctx | null>(null);
export function useAI() {
  const c = useContext(AICtx);
  if (!c) throw new Error("Art Instal: context lipsă");
  return c;
}

/* ---------------- Mesaje pentru acțiunile blocate ---------------- */

export const MSG = {
  call: "În demo, apelul e oprit. Pe site-ul real, butonul sună direct la echipa Art Instal.",
  whatsapp: "În demo, WhatsApp nu se deschide. Pe site-ul real, conversația pornește cu mesajul deja scris.",
  email: "În demo, emailul nu pleacă. Pe site-ul real, se deschide clientul de email.",
  send: "În demo, cererea nu pleacă. Pe site-ul real, ajunge direct la echipa Art Instal.",
  external: "În demo, linkurile externe sunt oprite. Pe site-ul real, se deschid într-un tab nou.",
  pdf: "În demo, documentul nu se descarcă. Pe site-ul real, autorizația Daikin se deschide ca PDF.",
  video: "În demo, clipurile de montaj nu se redau. Pe site-ul real, pornesc direct din galerie.",
  map: "În demo, harta nu se încarcă. Pe site-ul real, e harta Google cu sediul din Pitești.",
};

/* ---------------- Clase comune ---------------- */

export const FOCUS =
  "outline-none focus-visible:ring-2 focus-visible:ring-[#F97316] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0E1115]";

export const BTN_PRIMARY = `inline-flex items-center justify-center gap-2 rounded-lg bg-[#F97316] font-semibold text-white transition-all duration-200 ease-out hover:scale-[1.03] hover:shadow-lg hover:shadow-[#F97316]/30 active:scale-[0.98] ${FOCUS}`;
export const BTN_OUTLINE_WHITE = `inline-flex items-center justify-center gap-2 rounded-lg border-2 border-[#F6F3EE]/60 font-semibold text-[#F6F3EE] transition-all duration-200 ease-out hover:scale-[1.03] hover:bg-[#F6F3EE]/10 active:scale-[0.98] ${FOCUS}`;
export const BTN_WIZARD = `inline-flex items-center justify-center gap-2 rounded-lg bg-[#A370EB] font-semibold text-white transition-all duration-200 ease-out hover:scale-[1.02] hover:shadow-lg hover:shadow-[#A370EB]/30 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100 ${FOCUS}`;
export const CARD = "rounded-2xl border border-[#272C35] bg-[#15181E]";
export const CARD_HOVER = "transition-all duration-200 ease-out hover:-translate-y-1.5 hover:shadow-xl hover:shadow-black/40";
export const INPUT = `w-full rounded-lg border border-[#272C35] bg-[#0E1115] px-4 py-3 text-[15px] text-[#EBE6E0] placeholder:text-[#9096A2]/70 transition-all duration-200 outline-none focus:border-transparent focus:ring-2 focus:ring-[#F97316]`;

export function pill(active: boolean) {
  return `rounded-full border px-4 py-2 text-sm font-medium transition-all duration-200 select-none ${FOCUS} ${
    active
      ? "border-[#F97316] bg-[#F97316] text-white"
      : "border-[#272C35] text-[#EBE6E0] hover:border-[#F97316]/60"
  }`;
}

/* ---------------- Stiluri globale ale demo-ului ----------------
   Doar keyframes și două clase de font. Fără media queries. */
export function DemoStyles() {
  return (
    <style>{`
.ai-h{font-family:${HEAD};letter-spacing:-0.01em}
.ai-noscroll{scrollbar-width:none}
.ai-noscroll::-webkit-scrollbar{display:none}
@keyframes aiFadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}
@keyframes aiFadeIn{from{opacity:0}to{opacity:1}}
@keyframes aiFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(8px)}}
@keyframes aiPing{75%,100%{transform:scale(1.9);opacity:0}}
@keyframes aiSheet{from{transform:translateY(40px);opacity:0}to{transform:none;opacity:1}}
@keyframes aiPop{from{opacity:0;transform:scale(.96)}to{opacity:1;transform:none}}
@keyframes aiSpin{to{transform:rotate(360deg)}}
@keyframes aiGrow{from{transform:scaleX(0)}to{transform:scaleX(1)}}
`}</style>
  );
}

/** Animație CSS doar când mișcarea e permisă. */
export function anim(reduced: boolean, value: string): React.CSSProperties | undefined {
  return reduced ? undefined : { animation: value };
}

/* ---------------- Imagini din benzi (sprite) ----------------
   O singură imagine .webp cu n cadre 4:3 alăturate. Cadrul e decupat
   „cover” în cutia cu raportul `box`. */
export function Sprite({
  sheet,
  i,
  box,
  alt,
  className = "",
  innerClassName = "",
  fill = false,
}: {
  sheet: SheetId;
  i: number;
  box: number;
  alt: string;
  className?: string;
  innerClassName?: string;
  fill?: boolean;
}) {
  const s = SHEETS[sheet];
  const k = box / s.tile;
  const inner: React.CSSProperties =
    k >= 1
      ? { left: 0, width: "100%", height: `${k * 100}%`, top: `${((1 - k) / 2) * 100}%` }
      : { top: 0, height: "100%", width: `${(1 / k) * 100}%`, left: `${((1 - 1 / k) / 2) * 100}%` };
  return (
    <div
      className={`${fill ? "absolute inset-0" : "relative"} overflow-hidden ${className}`}
      style={fill ? undefined : { aspectRatio: box }}
    >
      <div className={`absolute overflow-hidden ${innerClassName}`} style={inner}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={s.src}
          alt={alt}
          draggable={false}
          className="absolute top-0 h-full max-w-none select-none"
          style={{ width: `${s.n * 100}%`, left: `${-i * 100}%` }}
        />
      </div>
    </div>
  );
}

/* ---------------- Apariție la derulare (ScrollReveal de pe site) ---------------- */
export function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const { scroller, reduced } = useAI();
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (reduced || !el || !scroller || typeof IntersectionObserver === "undefined") {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { root: scroller, threshold: 0, rootMargin: "0px 0px 40px 0px" }
    );
    io.observe(el);
    /* Plasă de siguranță: ce e deja în ecran apare la primul cadru, iar
       nimic nu rămâne invizibil dacă observatorul întârzie. */
    const raf = requestAnimationFrame(() => {
      const r = el.getBoundingClientRect();
      const s = scroller.getBoundingClientRect();
      if (r.top < s.bottom && r.bottom > s.top) setShown(true);
    });
    const late = window.setTimeout(() => setShown(true), 2500);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
      clearTimeout(late);
    };
  }, [scroller, reduced]);

  const visible = shown || reduced;
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "none" : "translateY(30px)",
        transition: reduced
          ? undefined
          : `opacity .6s ease-out ${delay}s, transform .6s ease-out ${delay}s`,
      }}
    >
      {children}
    </div>
  );
}

/* ---------------- Fereastră modală (portal în rădăcina demo-ului) ---------------- */
export function Overlay({
  open,
  onClose,
  label,
  children,
  className = "",
  backdrop = "rgba(10,12,15,0.8)",
  align = "center",
}: {
  open: boolean;
  onClose: () => void;
  label: string;
  children: ReactNode;
  className?: string;
  backdrop?: string;
  align?: "center" | "bottom";
}) {
  const { overlay, reduced } = useAI();
  const box = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const el = box.current;
    const first = el?.querySelector<HTMLElement>("[data-autofocus]") ?? el;
    first?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        closeRef.current();
        return;
      }
      if (e.key !== "Tab" || !el) return;
      const items = [
        ...el.querySelectorAll<HTMLElement>(
          'a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])'
        ),
      ];
      if (!items.length) return;
      const a = items[0];
      const z = items[items.length - 1];
      if (e.shiftKey && document.activeElement === a) {
        e.preventDefault();
        z.focus();
      } else if (!e.shiftKey && document.activeElement === z) {
        e.preventDefault();
        a.focus();
      }
    };
    el?.addEventListener("keydown", onKey);
    return () => {
      el?.removeEventListener("keydown", onKey);
      prev?.focus?.({ preventScroll: true });
    };
  }, [open, overlay]);

  if (!open || !overlay) return null;
  return createPortal(
    <div
      className={`pointer-events-auto absolute inset-0 z-[60] flex ${
        align === "bottom" ? "items-end" : "items-center"
      } justify-center`}
      style={{ background: backdrop, ...anim(reduced, "aiFadeIn .2s ease-out both") }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={box}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        className={`outline-none ${className}`}
        style={anim(reduced, align === "bottom" ? "aiSheet .28s cubic-bezier(.2,.8,.2,1) both" : "aiPop .22s ease-out both")}
      >
        {children}
      </div>
    </div>,
    overlay
  );
}

/* ---------------- Mărunțișuri ---------------- */

export function Eyebrow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <span className={`text-xs font-semibold uppercase tracking-wider text-[#F97316] ${className}`}>
      {children}
    </span>
  );
}

/** Banda bleumarin de sus a paginilor interioare (pt-32 pb-8 bg-navy). */
export function PageHero({
  title,
  crumb,
  children,
}: {
  title: string;
  crumb?: string;
  children?: ReactNode;
}) {
  const { mobile } = useAI();
  return (
    <section className="bg-[#0A0C0F]" style={{ paddingTop: mobile ? 100 : 124, paddingBottom: mobile ? 28 : 36 }}>
      <div className={mobile ? "px-4" : "mx-auto max-w-[1216px] px-8"}>
        {children}
        <h1 className={`ai-h font-black text-[#F6F3EE] ${mobile ? "text-[30px] leading-tight" : "text-[48px] leading-[1.1]"}`}>
          {title}
        </h1>
        {crumb && <p className="mt-2 text-[15px] text-[#F6F3EE]/60">{crumb}</p>}
      </div>
    </section>
  );
}

/** Siluetele caselor pentru „regimul de înălțime”. */
export function HouseGlyph({ kind, size = 44 }: { kind: string; size?: number }) {
  const floors = kind === "parter" || kind === "p_m" ? 1 : kind === "p_2" ? 3 : 2;
  const attic = kind === "p_m" || kind === "p_1_m";
  const fh = 9;
  const base = 40;
  const top = base - floors * fh;
  const roofH = attic ? 12 : 8;
  return (
    <svg width={size} height={size} viewBox="0 0 44 44" fill="none" aria-hidden>
      <path d={`M6 ${top} L22 ${top - roofH} L38 ${top} Z`} fill="currentColor" opacity={0.9} />
      {attic && <rect x="19" y={top - roofH / 2 - 1} width="6" height="4" rx="0.8" fill="#0E1115" />}
      {Array.from({ length: floors }).map((_, f) => (
        <g key={f}>
          <rect x="9" y={top + f * fh + 1} width="26" height={fh - 1} rx="1" stroke="currentColor" strokeWidth="1.6" />
          <rect x="13" y={top + f * fh + 3.5} width="4" height="3.2" rx="0.6" fill="currentColor" />
          <rect x="27" y={top + f * fh + 3.5} width="4" height="3.2" rx="0.6" fill="currentColor" />
        </g>
      ))}
      <line x1="3" y1={base + 0.5} x2="41" y2={base + 0.5} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/** Logo-ul real (scutul Art Instal Group). */
export function Logo({ size }: { size: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`${IMG}/logo.webp`}
      alt="Art Instal"
      width={size}
      height={size}
      className="rounded"
      style={{ width: size, height: size }}
      draggable={false}
    />
  );
}
