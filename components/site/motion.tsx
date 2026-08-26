"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

/* ============================================================
   Primitive de motion pentru LAB.
   Regula: fără librărie de animație. IntersectionObserver +
   CSS transitions. Totul se dezactivează sub
   prefers-reduced-motion, iar conținutul rămâne complet vizibil.
   ============================================================ */

export function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduced(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return reduced;
}

type RevealProps = {
  children: ReactNode;
  /** întârziere în ms, pentru cascadă */
  delay?: number;
  className?: string;
  variant?: "up" | "blur" | "scale";
  as?: "div" | "section" | "li" | "article" | "header" | "figure";
  style?: CSSProperties;
  id?: string;
};

export function Reveal({
  children,
  delay = 0,
  className = "",
  variant = "up",
  as: Tag = "div",
  style,
  id,
}: RevealProps) {
  const ref = useRef<HTMLElement | null>(null);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setSeen(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setSeen(true);
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.08 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const variantClass =
    variant === "blur"
      ? "reveal reveal-blur"
      : variant === "scale"
      ? "reveal reveal-scale"
      : "reveal";

  return (
    <Tag
      id={id}
      // @ts-expect-error — ref polimorf pe un set restrâns de taguri
      ref={ref}
      className={`${variantClass} ${seen ? "is-in" : ""} ${className}`}
      style={{ ["--d" as string]: `${delay}ms`, ...style }}
    >
      {children}
    </Tag>
  );
}

/** Contor care pornește când intră în viewport. */
export function CountUp({
  to,
  suffix = "",
  prefix = "",
  duration = 1400,
  decimals = 0,
  className = "",
}: {
  to: number;
  suffix?: string;
  prefix?: string;
  duration?: number;
  decimals?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [val, setVal] = useState(0);
  const done = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setVal(to);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting || done.current) return;
        done.current = true;
        const start = performance.now();
        const tick = (now: number) => {
          const p = Math.min(1, (now - start) / duration);
          const eased = 1 - Math.pow(1 - p, 3);
          setVal(to * eased);
          if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      },
      { threshold: 0.4 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [to, duration]);

  return (
    <span ref={ref} className={className}>
      {prefix}
      {val.toFixed(decimals)}
      {suffix}
    </span>
  );
}

/** Cuvânt care se rotește în headline — motion cu sens, nu decor. */
export function RotatingWord({
  words,
  interval = 2200,
  className = "",
}: {
  words: string[];
  interval?: number;
  className?: string;
}) {
  const [i, setI] = useState(0);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) return;
    const id = window.setInterval(
      () => setI((p) => (p + 1) % words.length),
      interval
    );
    return () => window.clearInterval(id);
  }, [words.length, interval, reduced]);

  // Cuvântul-fantomă ține lățimea stabilă (fără salturi de layout) și dă
  // linia de bază. Fără overflow: hidden — altfel se taie diacriticele
  // descendente (ț, ș) și se pierde alinierea la baseline într-un h1.
  const longest = words.reduce((a, b) => (b.length > a.length ? b : a), "");

  return (
    <span className={`relative inline-block ${className}`}>
      <span aria-hidden className="invisible">
        {longest}
      </span>
      {words.map((w, idx) => (
        <span
          key={w}
          className="absolute left-0 top-0 whitespace-nowrap"
          style={{
            transform: reduced
              ? undefined
              : `translateY(${idx === i ? 0 : Math.sign(idx - i) * 0.3}em)`,
            opacity: reduced ? (idx === 0 ? 1 : 0) : idx === i ? 1 : 0,
            transition:
              "transform 620ms cubic-bezier(0.16,1,0.3,1), opacity 420ms ease",
          }}
          aria-hidden={idx !== i}
        >
          {w}
        </span>
      ))}
    </span>
  );
}

/** Glow care urmărește cursorul peste un container. */
export function PointerGlow({
  children,
  className = "",
  strength = 380,
}: {
  children: ReactNode;
  className?: string;
  strength?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el || reduced) return;
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty("--mx", `${e.clientX - r.left}px`);
      el.style.setProperty("--my", `${e.clientY - r.top}px`);
      el.style.setProperty("--mo", "1");
    };
    const onLeave = () => el.style.setProperty("--mo", "0");
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    return () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
    };
  }, [reduced]);

  return (
    <div ref={ref} className={`relative ${className}`}>
      {!reduced && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-0 transition-opacity duration-500"
          style={{
            opacity: "var(--mo, 0)" as unknown as number,
            background: `radial-gradient(${strength}px circle at var(--mx, 50%) var(--my, 50%), color-mix(in oklab, var(--md-a1) 22%, transparent), transparent 70%)`,
          }}
        />
      )}
      {children}
    </div>
  );
}

/** Bară de progres a citirii, sus de tot. */
export function ScrollProgress({ className = "" }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const max = document.body.scrollHeight - window.innerHeight;
      const p = max > 0 ? window.scrollY / max : 0;
      el.style.transform = `scaleX(${p})`;
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div
      className={`pointer-events-none fixed inset-x-0 top-0 z-[60] h-px ${className}`}
      aria-hidden
    >
      <div
        ref={ref}
        className="h-full origin-left bg-a1"
        style={{ transform: "scaleX(0)" }}
      />
    </div>
  );
}

/** Adaugă o clasă pe element după ce pagina e derulată peste `after` px. */
export function useScrolled(after = 24) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > after);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [after]);
  return scrolled;
}

/** Bandă infinită, orizontală. Conținutul se dublează pentru buclă continuă. */
export function Marquee({
  children,
  duration = 38,
  className = "",
  reverse = false,
}: {
  children: ReactNode;
  duration?: number;
  className?: string;
  reverse?: boolean;
}) {
  return (
    <div className={`fade-x overflow-hidden ${className}`}>
      <div
        className="marquee"
        style={{
          ["--dur" as string]: `${duration}s`,
          animationDirection: reverse ? "reverse" : undefined,
        }}
      >
        <div className="flex shrink-0 items-center" aria-hidden={false}>
          {children}
        </div>
        <div className="flex shrink-0 items-center" aria-hidden>
          {children}
        </div>
      </div>
    </div>
  );
}
