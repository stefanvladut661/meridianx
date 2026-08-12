"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/lib/hooks/use-reduced-motion";

/**
 * Citirea de coordonate a jumătății SOFTWARE (FAZA 1).
 * Centrul geografic al României — 45.9432° N, 24.9668° E — coordonate
 * reale, nu decor: meridianul e instrument de poziționare.
 *
 * La activare (hover/focus pe jumătate), cifrele se „calibrează":
 * se amestecă scurt și se fixează de la stânga la dreapta, sub 400ms.
 * Sub prefers-reduced-motion: static, mereu fixat.
 */

const FINAL = "45.9432° N · 24.9668° E";
const DURATION_MS = 360;

export function CoordReadout({
  active,
  className,
}: {
  active: boolean;
  className?: string;
}) {
  const reducedMotion = useReducedMotion();
  const [text, setText] = useState(FINAL);
  const rafRef = useRef(0);

  useEffect(() => {
    if (!active || reducedMotion) {
      setText(FINAL);
      return;
    }
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / DURATION_MS);
      const settled = Math.floor(p * FINAL.length);
      let out = "";
      for (let i = 0; i < FINAL.length; i++) {
        const ch = FINAL[i];
        out +=
          i < settled || !/\d/.test(ch)
            ? ch
            : String(Math.floor(Math.random() * 10));
      }
      setText(out);
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [active, reducedMotion]);

  return (
    <span className={cn("font-mono tabular-nums", className)} aria-hidden="true">
      {text}
    </span>
  );
}
