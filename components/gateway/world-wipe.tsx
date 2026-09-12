"use client";

import { useCallback, useEffect, useState, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "@/i18n/navigation";
import { Mark } from "@/components/site/mark";

/* ============================================================
   VĂLUL DE TRECERE AL PORȚII

   Același mecanism ca în `components/site/world-switch.tsx` (sfertul
   de cerc din colț), dar pornit din punctul apăsat, nu dintr-un colț:
   pe poartă suprafețele apăsabile sunt mari, iar un văl care crește
   de sub deget explică saltul dintre lumi mai bine decât unul care
   vine din altă parte a ecranului.

   Culoarea vălului e a lumii în care intri (`data-scope` pe portal),
   iar navigarea pleacă în clipa în care ecranul e acoperit — restul
   creșterii se petrece sub un ecran plin. Sub reduced-motion nu se
   declanșează nimic: link-ul rămâne un link obișnuit.
   ============================================================ */

type World = "video" | "software";

/** Cât îi ia vălului să acopere ecranul (ține pas cu `--ws-cover` din CSS). */
const COVER_MS = 380;

const NAME: Record<World, string> = { video: "VIDEO", software: "SOFTWARE" };

export function useWorldWipe() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [leaving, setLeaving] = useState<{
    to: World;
    x: number;
    y: number;
  } | null>(null);

  useEffect(() => setMounted(true), []);

  const go = useCallback(
    (e: MouseEvent<HTMLAnchorElement>, to: World, href: string) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches)
        return;
      e.preventDefault();

      /* De la tastatură `click`-ul vine fără coordonate; pornim din
         mijlocul elementului, nu din colțul ecranului. */
      const r = e.currentTarget.getBoundingClientRect();
      const fromKeyboard = e.detail === 0;
      setLeaving({
        to,
        x: fromKeyboard ? r.left + r.width / 2 : e.clientX,
        y: fromKeyboard ? r.top + r.height / 2 : e.clientY,
      });
      window.setTimeout(() => router.push(href), COVER_MS);
    },
    [router]
  );

  /* Portal direct în <body>: suprafețele porții au `overflow: hidden`
     și transformări din reveal-uri, deci un `fixed` născut înăuntru
     n-ar mai acoperi ecranul. */
  const overlay =
    mounted && leaving
      ? createPortal(
          <div
            data-scope={leaving.to}
            className="fixed inset-0 z-[90]"
            aria-hidden
            style={{ pointerEvents: "none" }}
          >
            <span
              className="ws-wipe"
              style={{ left: leaving.x, top: leaving.y }}
            />
            <span className="ws-wipe-label fixed inset-0 z-[91] grid place-items-center">
              <span className="flex flex-col items-center gap-4 text-bone">
                <Mark size={44} />
                <span className="font-md-display text-[clamp(1.6rem,5vw,2.6rem)] font-bold tracking-[0.2em]">
                  {NAME[leaving.to]}
                </span>
              </span>
            </span>
          </div>,
          document.body
        )
      : null;

  return { go, overlay };
}
