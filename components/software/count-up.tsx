"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "@/lib/hooks/use-reduced-motion";

/**
 * Contorul care se așază pe valoare (FAZA 4).
 *
 * Se folosește DOAR pe cifre reale — durate pe care ni le asumăm, totaluri
 * derivate din conținut. Nu pe metrici de portofoliu: acelea sunt încă
 * placeholder și un contor care numără spre o cifră inventată ar minți
 * frumos (CLAUDE.md §5).
 *
 * 380ms, sub pragul de 400 al lumii software. Sub reduced motion afișează
 * direct valoarea finală — cifra e informație, nu animație.
 */
export function CountUp({
  to,
  duration = 380,
  className,
}: {
  to: number;
  duration?: number;
  className?: string;
}) {
  const reducedMotion = useReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const [value, setValue] = useState(to);
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (reducedMotion) {
      setValue(to);
      return;
    }
    const element = ref.current;
    if (!element) return;

    setValue(0);
    setArmed(true);

    let frame = 0;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();

        const start = performance.now();
        const tick = (now: number) => {
          const t = Math.min(1, (now - start) / duration);
          // easing de instrument: se apropie ferm, fără să sară peste
          const eased = 1 - Math.pow(1 - t, 3);
          setValue(Math.round(eased * to));
          if (t < 1) frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
      },
      { threshold: 0.4 }
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [to, duration, reducedMotion]);

  return (
    <span ref={ref} className={className}>
      {/* Cifra finală rămâne în DOM pentru cititoarele de ecran, ca să nu
          li se anunțe numărătoarea intermediară. */}
      <span aria-hidden={armed ? "true" : undefined}>{value}</span>
      {armed ? <span className="sr-only">{to}</span> : null}
    </span>
  );
}
