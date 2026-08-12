"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "@/lib/hooks/use-reduced-motion";

/**
 * Cursorul-reticul al diviziei VIDEO (FAZA 2).
 *
 * Un reticul de focus urmărește pointerul pe toată pagina; peste
 * elementele marcate cu data-focus-cursor (thumbnail-uri video)
 * colțurile de cadru „trag focusul” — intră din blur pe poziție, ca o
 * lentilă care prinde subiectul. Eticheta se ia din data-focus-label.
 *
 * Se dezactivează complet: sub prefers-reduced-motion, pe touch
 * (pointer: coarse) și fără JS. Cursorul nativ rămâne pe inputuri.
 */
export function FocusCursor() {
  const reducedMotion = useReducedMotion();
  const [enabled, setEnabled] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (reducedMotion) {
      setEnabled(false);
      return;
    }
    const mql = window.matchMedia("(pointer: fine)");
    const apply = () => setEnabled(mql.matches);
    apply();
    mql.addEventListener("change", apply);
    return () => mql.removeEventListener("change", apply);
  }, [reducedMotion]);

  useEffect(() => {
    if (!enabled) return;
    const root = rootRef.current;
    const label = labelRef.current;
    if (!root || !label) return;

    let frame = 0;
    let x = -100;
    let y = -100;
    let shown = false;

    const render = () => {
      frame = 0;
      root.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    };

    const onMove = (event: PointerEvent) => {
      x = event.clientX;
      y = event.clientY;
      if (!shown) {
        shown = true;
        root.style.opacity = "1";
      }
      if (!frame) frame = requestAnimationFrame(render);
    };

    const onOver = (event: PointerEvent) => {
      const target = (event.target as Element | null)?.closest?.(
        "[data-focus-cursor]"
      );
      if (target) {
        root.setAttribute("data-lock", "");
        label.textContent = target.getAttribute("data-focus-label") ?? "AF";
      }
    };

    const onOut = (event: PointerEvent) => {
      const target = (event.target as Element | null)?.closest?.(
        "[data-focus-cursor]"
      );
      const next = event.relatedTarget as Element | null;
      if (target && !(next && target.contains(next))) {
        root.removeAttribute("data-lock");
        label.textContent = "AF";
      }
    };

    const onLeave = () => {
      shown = false;
      root.style.opacity = "0";
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerover", onOver, true);
    window.addEventListener("pointerout", onOut, true);
    document.documentElement.addEventListener("pointerleave", onLeave);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerover", onOver, true);
      window.removeEventListener("pointerout", onOut, true);
      document.documentElement.removeEventListener("pointerleave", onLeave);
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <>
      <style>{`
body{cursor:none}
a,button,[data-focus-cursor],[data-focus-cursor] *{cursor:none}
input,textarea,select,[contenteditable]{cursor:auto}
.mv-reticle{transition:opacity 200ms ease}
.mv-ret-cross{color:rgba(237,232,224,0.75);transition:opacity 200ms ease}
.mv-ret-corners{opacity:0;transform:scale(1.35);filter:blur(2px);color:var(--v-daylight);transition:opacity 250ms ease,transform 250ms cubic-bezier(0.22,1,0.36,1),filter 250ms ease}
.mv-reticle[data-lock] .mv-ret-corners{opacity:1;transform:scale(1);filter:blur(0)}
.mv-reticle[data-lock] .mv-ret-cross{opacity:0.35}
.mv-ret-label{opacity:0;transition:opacity 200ms ease}
.mv-reticle[data-lock] .mv-ret-label{opacity:1}
`}</style>
      <div
        ref={rootRef}
        aria-hidden="true"
        className="mv-reticle pointer-events-none fixed left-0 top-0 z-[95] opacity-0"
      >
        <div className="relative -translate-x-1/2 -translate-y-1/2">
          <svg
            viewBox="0 0 48 48"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="mv-ret-cross absolute left-1/2 top-1/2 size-12 -translate-x-1/2 -translate-y-1/2"
          >
            <path d="M24 19v10M19 24h10" />
          </svg>
          <svg
            viewBox="0 0 48 48"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            className="mv-ret-corners size-12"
          >
            <path d="M2 14V2h12" />
            <path d="M34 2h12v12" />
            <path d="M46 34v12H34" />
            <path d="M14 46H2V34" />
          </svg>
          <span
            ref={labelRef}
            className="mv-ret-label absolute left-1/2 top-full mt-1.5 -translate-x-1/2 whitespace-nowrap font-mono text-[10px] tracking-[0.25em] text-v-daylight"
          >
            AF
          </span>
        </div>
      </div>
    </>
  );
}
