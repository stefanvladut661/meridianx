"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/lib/hooks/use-reduced-motion";

/**
 * FIȘIER ÎNGHEȚAT după FAZA 0 — cereri de modificare în PLAN.md.
 *
 * Reveal de intrare partajat, fără dependențe de animație: CSS +
 * IntersectionObserver. Sub prefers-reduced-motion conținutul e
 * vizibil imediat, fără nicio tranziție.
 *
 * E intenționat simplu — coregrafiile complexe (GSAP pe video) se
 * construiesc în zona diviziei, nu aici.
 */

export interface RevealProps {
  children: ReactNode;
  /** Întârziere în ms — pentru eșalonarea elementelor dintr-un grup. */
  delay?: number;
  /** Durata în ms. Software: ține sub 400 (CLAUDE.md §2). */
  duration?: number;
  /** Deplasarea inițială pe Y, în px. */
  distance?: number;
  className?: string;
}

export function Reveal({
  children,
  delay = 0,
  duration = 500,
  distance = 16,
  className,
}: RevealProps) {
  const reducedMotion = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (reducedMotion) return;
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -10% 0px" }
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [reducedMotion]);

  const show = reducedMotion || visible;

  return (
    <div
      ref={ref}
      className={cn(
        "transition-[opacity,transform] ease-out will-change-transform",
        show ? "opacity-100 translate-y-0" : "opacity-0",
        className
      )}
      style={{
        transitionDuration: reducedMotion ? "0ms" : `${duration}ms`,
        transitionDelay: reducedMotion ? "0ms" : `${delay}ms`,
        transform: show ? undefined : `translateY(${distance}px)`,
      }}
    >
      {children}
    </div>
  );
}
