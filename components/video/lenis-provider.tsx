"use client";

import { useEffect } from "react";
import { useReducedMotion } from "@/lib/hooks/use-reduced-motion";

/**
 * Smooth scroll Lenis pentru paginile diviziei VIDEO (FAZA 2).
 *
 * Se montează o dată per pagină (nu în layout — layout-ul e al F1).
 * Import dinamic după mount, deci nu blochează LCP. Sub
 * prefers-reduced-motion nu se încarcă nimic: scroll nativ.
 *
 * REFOLOSIBIL de F3 pe /video/reclame și /video/contact:
 *   import { VideoLenis } from "@/components/video/lenis-provider";
 *   ... <VideoLenis />  — atât.
 */
export function VideoLenis() {
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (reducedMotion) return;

    let cancelled = false;
    let lenis: { destroy: () => void } | null = null;

    void import("lenis").then(({ default: Lenis }) => {
      if (cancelled) return;
      lenis = new Lenis({
        autoRaf: true,
        lerp: 0.12,
        anchors: true,
      });
    });

    return () => {
      cancelled = true;
      lenis?.destroy();
      lenis = null;
    };
  }, [reducedMotion]);

  return null;
}
