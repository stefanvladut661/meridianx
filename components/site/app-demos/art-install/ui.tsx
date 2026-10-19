"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import type { DemoDevice } from "../types";

/* ============================================================
   Trusa vizuală Art Instal, copiată de pe confortsolutions.ro:
   paleta din src/index.css, fonturile Playfair Display + DM Sans,
   clasele .btn-primary / .btn-outline / .card-hover / .form-input.

   Site-ul real e pe Tailwind v3, MERIDIAN pe v4: razele și
   umbrele se scriu explicit (rounded-xl real = 12px, aici 16px).
   ============================================================ */

/* Culorile din :root, convertite din HSL. */
export const C = {
  bg: "#0E1115", // --background 220 20% 7%
  fg: "#EBE7E0", // --foreground 36 20% 90%
  card: "#15181E", // --card / --cream 220 18% 10%
  muted: "#1E2229", // --muted / --secondary 220 15% 14%
  mutedFg: "#9096A2", // --muted-foreground 220 9% 60%
  border: "#272C35", // --border 220 15% 18%
  navy: "#0A0C0F", // --navy 220 20% 5%
  navyFg: "#F6F3EE", // --primary-foreground / --navy-foreground 36 33% 95%
  orange: "#F97015", // --accent 24 95% 53%
  orangeHover: "#E55F06", // --orange-hover 24 95% 46%
  wizard: "#A370EB", // --wizard 265 75% 68%
  whatsapp: "#25D466", // --whatsapp 142 70% 49%
};

export const IMG = "/software/proiecte/art-install";

/* ---------------- Contextul demo-ului ---------------- */

export type Nav = {
  go: (screen: string) => void;
  /** Pagini ale site-ului real care nu fac parte din demo. */
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
};

export const AICtx = createContext<Ctx | null>(null);
export function useAI() {
  const c = useContext(AICtx);
  if (!c) throw new Error("Art Instal: context lipsă");
  return c;
}

/* ---------------- Acțiunile oprite în demo ---------------- */

export const MSG = {
  call: "Apelul e oprit în demo; pe site, butonul sună direct.",
  whatsapp: "WhatsApp e oprit în demo; pe site, mesajul vine deja scris.",
  email: "Emailul e oprit în demo; pe site, se deschide clientul de email.",
  send: "Formularul nu trimite nimic în demo.",
  external: "Linkurile externe sunt oprite în demo.",
  pdf: "PDF-ul autorizației Daikin nu se deschide din demo.",
  video: "Clipurile de montaj nu rulează în demo.",
  map: "Harta Google e oprită în demo.",
};

/* ---------------- Clasele site-ului ---------------- */

/** .container-custom: max-w-7xl mx-auto px-4 lg:px-8. */
export const container = (m: boolean) => `mx-auto max-w-[1280px] ${m ? "px-4" : "px-8"}`;

/** .section-padding: px-4 py-16, lg:px-8 md:py-24. */
export const sectionPad = (m: boolean) => (m ? "px-4 py-16" : "px-8 py-24");

/** .section-title: text-3xl md:text-4xl lg:text-5xl, bold. */
export const sectionTitle = (m: boolean) =>
  `ai-h font-bold text-[#EBE7E0] ${m ? "text-[30px] leading-[36px]" : "text-[48px] leading-[48px]"}`;

/** Titlul paginilor (h1 text-3xl md:text-5xl, black). */
export const pageTitle = (m: boolean) =>
  `ai-h font-black text-[#F6F3EE] ${m ? "text-[30px] leading-[36px]" : "text-[48px] leading-[48px]"}`;

/* Butoanele nu primesc padding aici: în Tailwind v4 două clase px-*
   pe același element nu se mai bat după ordinea din atribut. */

/** .btn-primary (fără padding). Hover-ul există doar pe desktop. */
export const btnPrimary = (m: boolean) =>
  `inline-flex items-center justify-center rounded-[12px] bg-[#F97015] font-semibold text-white transition-all duration-200 ease-out active:scale-[0.98] ${
    m ? "" : "hover:scale-[1.03] hover:shadow-lg hover:shadow-[#F97015]/30"
  }`;

/** .btn-outline (fără padding și fără culori). */
export const btnOutline = (m: boolean) =>
  `inline-flex items-center justify-center rounded-[12px] border-2 font-semibold transition-all duration-200 ease-out active:scale-[0.98] ${
    m ? "" : "hover:scale-[1.03]"
  }`;

/** .btn-outline-white: text alb, bordură albă la 60%. */
export const btnOutlineWhite = (m: boolean) =>
  `${btnOutline(m)} border-white/60 text-white ${m ? "" : "hover:bg-white/10"}`;

/** .card-hover: se ridică 6px, doar pe desktop (site-ul de pe telefon n-are hover). */
export const cardHover = (m: boolean) =>
  m ? "" : "transition-all duration-200 ease-out hover:-translate-y-1.5 hover:shadow-xl";

/** .form-input. */
export const FORM_INPUT =
  "w-full rounded-[12px] border border-[#272C35] bg-[#0E1115] px-4 py-3 text-[#EBE7E0] placeholder:text-[#9CA3AF] transition-all duration-200 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#F97015]";

/* ---------------- Stilurile de bază ale pânzei ----------------
   Fără media queries. Regulile sunt în afara straturilor Tailwind ca
   să bată regulile globale MERIDIAN (focus verde cu rază de 4px,
   selecția, cursorul implicit al butoanelor din v4). */
export function DemoStyles() {
  return (
    <style>{`
.ai-root{font-family:var(--ai-body),sans-serif}
.ai-root :is(h1,h2,h3,h4),.ai-h{font-family:var(--ai-heading),serif}
.ai-root :focus-visible{outline:2px solid #F97015;outline-offset:2px;border-radius:revert-layer}
.ai-root :is(input,select,textarea):focus-visible{outline:none}
.ai-root input[type=checkbox]:focus-visible{outline:2px solid #F97015;outline-offset:2px}
.ai-root :is(button,[role=button],label[for]):not(:disabled){cursor:pointer}
.ai-root ::selection{background:Highlight;color:HighlightText}
.ai-noscroll{scrollbar-width:none}
.ai-noscroll::-webkit-scrollbar{display:none}
@keyframes aiPing{75%,100%{transform:scale(2);opacity:0}}
@keyframes aiFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(8px)}}
@keyframes aiFade{from{opacity:0}to{opacity:1}}
@keyframes aiDialog{from{opacity:0;transform:translateY(2%) scale(.95)}to{opacity:1;transform:none}}
`}</style>
  );
}

/** Poziția unui element în derulator, în px CSS. Vizualizatorul scalează
    pânza cu transform, deci diferența de dreptunghiuri se împarte la scară. */
export function offsetIn(scroller: HTMLElement, el: HTMLElement) {
  const s = scroller.getBoundingClientRect();
  const k = s.height / scroller.clientHeight || 1;
  return (el.getBoundingClientRect().top - s.top) / k + scroller.scrollTop;
}

/** Animație CSS doar când mișcarea e permisă. */
export function anim(reduced: boolean, value: string): CSSProperties | undefined {
  return reduced ? undefined : { animation: value };
}

/* ---------------- Apariția la derulare (ScrollReveal.tsx) ----------------
   Ca pe site: opacitate 0 și 30px mai jos, apoi 0,6s ease-out când
   10% din bloc intră în ecran. Rădăcina e derulatorul demo-ului. */
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
    if (reduced || shown) return;
    const el = ref.current;
    if (!el || !scroller) return;
    if (typeof IntersectionObserver === "undefined") {
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
      { root: scroller, threshold: 0.1 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [scroller, reduced, shown]);

  const visible = reduced || shown;
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "none" : "translateY(30px)",
        transition: reduced ? undefined : `opacity .6s ease-out ${delay}s, transform .6s ease-out ${delay}s`,
      }}
    >
      {children}
    </div>
  );
}

/* ---------------- Numărătoarea din TrustSection (CountUp.tsx) ----------------
   0 → valoare în 2s, easeOutCubic, când 30% din număr e în ecran.
   Cu mișcare redusă, valoarea finală de la început. */
export function CountUp({ end }: { end: number }) {
  const { scroller, reduced } = useAI();
  const ref = useRef<HTMLSpanElement>(null);
  const [n, setN] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (reduced || !el || !scroller || typeof IntersectionObserver === "undefined") return;
    let raf = 0;
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        io.disconnect();
        const t0 = performance.now();
        const tick = (t: number) => {
          const p = Math.min((t - t0) / 2000, 1);
          setN(Math.floor((1 - Math.pow(1 - p, 3)) * end));
          if (p < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      },
      { root: scroller, threshold: 0.3 }
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [scroller, reduced, end]);

  return <span ref={ref}>{reduced ? end : n}</span>;
}

/* ---------------- Fereastra modală (portal în stratul demo-ului) ----------------
   `dialog` = fereastra Radix din magazin (fundal negru 80%, intrare
   de 200ms); `lightbox` = galeria din portofoliu (fundal bleumarin
   90%, fără animație, se închide la click oriunde). Focusul intră în
   fereastră, Tab rămâne în ea, Escape o închide. */
export function Overlay({
  open,
  onClose,
  label,
  kind,
  children,
  className = "",
}: {
  open: boolean;
  onClose: () => void;
  label: string;
  kind: "dialog" | "lightbox";
  children: ReactNode;
  className?: string;
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
    const tabbables = () =>
      el
        ? [
            ...el.querySelectorAll<HTMLElement>(
              'a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])'
            ),
          ]
        : [];
    (tabbables()[0] ?? el)?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        closeRef.current();
        return;
      }
      if (e.key !== "Tab" || !el) return;
      const items = tabbables();
      if (!items.length) {
        e.preventDefault();
        return;
      }
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

  if (kind === "lightbox") {
    return createPortal(
      <div
        ref={box}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        onClick={onClose}
        className={`pointer-events-auto absolute inset-0 z-[60] flex items-center justify-center bg-[#0A0C0F]/90 p-4 outline-none ${className}`}
      >
        {children}
      </div>,
      overlay
    );
  }

  return createPortal(
    <div
      className="pointer-events-auto absolute inset-0 z-[60] flex items-center justify-center bg-black/80"
      style={anim(reduced, "aiFade .2s ease-out both")}
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
        style={anim(reduced, "aiDialog .2s ease-out both")}
      >
        {children}
      </div>
    </div>,
    overlay
  );
}

/* ---------------- Mărunțișuri ---------------- */

/** Banda bleumarin de sus a paginilor interioare (pt-32 pb-8 bg-navy). */
export function PageHero({ title, crumb }: { title: string; crumb: string }) {
  const { mobile } = useAI();
  return (
    <section className="bg-[#0A0C0F] pb-8 pt-32">
      <div className={container(mobile)}>
        <h1 className={pageTitle(mobile)}>{title}</h1>
        <p className="mt-2 text-[#F6F3EE]/60">{crumb}</p>
      </div>
    </section>
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
      className="rounded-[4px]"
      style={{ width: size, height: size }}
      draggable={false}
    />
  );
}
