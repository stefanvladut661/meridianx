"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useReducedMotion } from "@/lib/hooks/use-reduced-motion";

/**
 * Containerul pentru diagramele care se desenează la scroll (FAZA 4).
 * Pune `data-draw="on"` când intră în viewport; stilurile efective vin
 * din `SoftwareMotionStyles`, care trebuie montat o dată per pagină.
 *
 * Sub `prefers-reduced-motion` pornește direct în starea finală — diagrama
 * e desenată integral, nu absentă.
 *
 * Copiii marcați cu `data-draw-path` se trasează, cei cu `data-draw-fade`
 * apar. Eșalonarea se face cu `style={{ "--draw-delay": "80ms" }}`.
 */
export function DrawIn({
  children,
  className,
  /** Cât din element trebuie să fie vizibil ca să pornească trasarea. */
  threshold = 0.25,
}: {
  children: ReactNode;
  className?: string;
  threshold?: number;
}) {
  const reducedMotion = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const [drawn, setDrawn] = useState(false);

  useEffect(() => {
    if (reducedMotion) return;
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setDrawn(true);
          observer.disconnect();
        }
      },
      { threshold, rootMargin: "0px 0px -5% 0px" }
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [reducedMotion, threshold]);

  return (
    <div
      ref={ref}
      data-draw={reducedMotion || drawn ? "on" : "off"}
      className={className}
    >
      {children}
    </div>
  );
}
