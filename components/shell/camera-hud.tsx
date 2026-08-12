"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/lib/hooks/use-reduced-motion";
import { formatTimecode } from "./timecode";

/**
 * HUD-ul de cameră al diviziei VIDEO (FAZA 1 — signature-ul lumii video).
 *
 * - Colțuri de cadru fixate în viewport (viewfinder)
 * - REC discret (pulsare doar motion-safe)
 * - Timecode care avansează cu POZIȚIA DE SCROLL (6px = 1 frame @24fps)
 * - Accentul migrează tungsten → daylight pe măsură ce cobori:
 *   citirea de „balans de alb" (3200K → 5600K) e afișată explicit.
 *
 * Sub prefers-reduced-motion: complet static (TC 00:00:00:00, fără puls,
 * culoare fixă tungsten). Decorativ: aria-hidden, pointer-events-none.
 * Culori brute --v-* permise: suntem în interiorul lumii video.
 */

const PX_PER_FRAME = 6;

export function CameraHud() {
  const reducedMotion = useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const [timecode, setTimecode] = useState("00:00:00:00");
  const [kelvin, setKelvin] = useState(3200);

  useEffect(() => {
    if (reducedMotion) return;
    let raf = 0;

    const update = () => {
      raf = 0;
      const doc = document.documentElement;
      const max = Math.max(1, doc.scrollHeight - window.innerHeight);
      const y = Math.min(Math.max(window.scrollY, 0), max);
      const p = max > 1 ? y / max : 0;

      setTimecode(formatTimecode(y / PX_PER_FRAME));
      setKelvin(3200 + Math.round((p * 2400) / 50) * 50);
      rootRef.current?.style.setProperty("--hud-p", p.toFixed(4));
    };

    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [reducedMotion]);

  return (
    <div
      ref={rootRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-(--z-signature) font-mono text-[10px] tracking-[0.15em]"
      style={
        {
          "--hud-p": "0",
          "--hud-c":
            "color-mix(in oklab, var(--v-tungsten) calc((1 - var(--hud-p)) * 100%), var(--v-daylight))",
        } as React.CSSProperties
      }
    >
      {/* colțuri de cadru — doar pe ecrane cu spațiu */}
      <Corner className="left-4 top-4 hidden border-l border-t md:block" />
      <Corner className="right-4 top-4 hidden border-r border-t md:block" />
      <Corner className="bottom-4 left-4 hidden border-b border-l md:block" />
      <Corner className="bottom-4 right-4 hidden border-b border-r md:block" />

      {/* timecode legat de scroll */}
      <div className="absolute bottom-5 left-4 flex items-center gap-2 text-[color:var(--hud-c,var(--v-tungsten))] md:left-9">
        <span className="opacity-60">TC</span>
        <span className="tabular-nums">{timecode}</span>
      </div>

      {/* REC + balans de alb */}
      <div className="absolute bottom-5 right-4 flex items-center gap-3 text-[color:var(--hud-c,var(--v-tungsten))] md:right-9">
        <span className="tabular-nums opacity-80">{kelvin}K</span>
        <span className="flex items-center gap-1.5">
          <span
            className={cn(
              "size-1.5 rounded-full bg-[color:var(--hud-c,var(--v-tungsten))]",
              !reducedMotion && "motion-safe:animate-pulse"
            )}
          />
          REC
        </span>
      </div>
    </div>
  );
}

function Corner({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "absolute size-5 border-[color:var(--hud-c,var(--v-tungsten))] opacity-70",
        className
      )}
    />
  );
}
