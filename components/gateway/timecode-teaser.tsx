"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/lib/hooks/use-reduced-motion";
import { formatTimecode, FPS } from "@/components/shell/timecode";

/**
 * Teaser-ul de timecode al jumătății VIDEO din gateway (FAZA 1).
 * Cât timp jumătatea e activă (hover/focus), camera „rulează": timecode
 * live la 24fps + REC. Inactiv sau sub reduced-motion: static la zero.
 */

export function TimecodeTeaser({
  active,
  className,
}: {
  active: boolean;
  className?: string;
}) {
  const reducedMotion = useReducedMotion();
  const [tc, setTc] = useState("00:00:00:00");
  const rafRef = useRef(0);

  useEffect(() => {
    if (!active || reducedMotion) {
      setTc("00:00:00:00");
      return;
    }
    const start = performance.now();
    const tick = (now: number) => {
      setTc(formatTimecode(((now - start) / 1000) * FPS));
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [active, reducedMotion]);

  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex items-center gap-2 font-mono text-[11px] tracking-[0.15em] text-v-tungsten",
        className
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full bg-v-tungsten",
          active && !reducedMotion && "motion-safe:animate-pulse"
        )}
      />
      REC
      <span className="tabular-nums">{tc}</span>
    </span>
  );
}
