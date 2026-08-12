"use client";

import { useEffect, useRef } from "react";
import type { ProcessStep } from "@/content/types";
import { Reveal } from "@/components/ui/reveal";
import { useReducedMotion } from "@/lib/hooks/use-reduced-motion";
import { loadMotion } from "./motion/motion";

/**
 * Signature-ul paginii de proces (FAZA 2): rail de peliculă cu marcaje
 * de timecode. Numerotarea e legitimă — e o secvență reală — și se
 * afișează ca TC 01:00:00:00, nu ca „01/02/03” de template.
 *
 * Linia de progres (tungsten → daylight, de la brief la livrare) se
 * desenează la scroll cu GSAP (lazy). Fără JS sau sub reduced-motion,
 * linia e desenată complet — pagina rămâne întreagă.
 */
export function ProcessRail({ steps }: { steps: ProcessStep[] }) {
  const reducedMotion = useReducedMotion();
  const listRef = useRef<HTMLOListElement>(null);
  const lineRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (reducedMotion) return;
    let disposed = false;
    let ctx: { revert: () => void } | null = null;

    void loadMotion().then(({ gsap }) => {
      if (disposed) return;
      const list = listRef.current;
      const line = lineRef.current;
      if (!list || !line) return;
      ctx = gsap.context(() => {
        gsap.fromTo(
          line,
          { scaleY: 0 },
          {
            scaleY: 1,
            transformOrigin: "top center",
            ease: "none",
            scrollTrigger: {
              trigger: list,
              start: "top 72%",
              end: "bottom 62%",
              scrub: 0.6,
            },
          }
        );
      }, list);
    });

    return () => {
      disposed = true;
      ctx?.revert();
    };
  }, [reducedMotion]);

  return (
    <div className="relative">
      {/* rail: linia de bază + linia de progres tungsten→daylight */}
      <div
        aria-hidden="true"
        className="absolute bottom-2 left-[7px] top-2 hidden w-px bg-line sm:block"
      />
      <div
        ref={lineRef}
        aria-hidden="true"
        className="absolute bottom-2 left-[7px] top-2 hidden w-px bg-gradient-to-b from-v-tungsten via-v-bone/60 to-v-daylight sm:block"
      />
      <ol ref={listRef} className="space-y-16 sm:space-y-24 sm:pl-16">
        {steps.map((step) => (
          <li key={step.id} className="relative">
            {/* perforație de peliculă în dreptul etapei */}
            <span
              aria-hidden="true"
              className="absolute -left-16 top-1.5 hidden size-[15px] rounded-full border-2 border-muted bg-bg sm:block"
            />
            <Reveal>
              <p className="font-mono text-xs tracking-[0.25em] text-accent-2">
                TC {String(step.order).padStart(2, "0")}:00:00:00
              </p>
              <h2 className="mt-3 font-display text-3xl tracking-tight sm:text-4xl">
                {step.title}
              </h2>
              {step.duration ? (
                <p className="mt-2 font-mono text-xs tracking-[0.2em] text-fg/60">
                  {/* i18n: */}
                  DURATĂ: {step.duration.toUpperCase()}
                </p>
              ) : null}
              <p className="mt-4 max-w-2xl text-pretty text-fg/75">
                {step.description}
              </p>
              <div className="mt-6 grid max-w-3xl gap-6 md:grid-cols-2">
                <div>
                  <h3 className="font-mono text-xs tracking-[0.25em] text-v-tungsten">
                    {/* i18n: */}
                    NOI FACEM
                  </h3>
                  <ul className="mt-3 space-y-2 text-sm text-fg/75">
                    {step.weDo.map((item) => (
                      <li key={item} className="flex gap-2.5">
                        <span aria-hidden="true" className="text-v-tungsten">
                          —
                        </span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3 className="font-mono text-xs tracking-[0.25em] text-v-daylight">
                    {/* i18n: */}
                    TU ADUCI
                  </h3>
                  <ul className="mt-3 space-y-2 text-sm text-fg/75">
                    {step.youDo.map((item) => (
                      <li key={item} className="flex gap-2.5">
                        <span aria-hidden="true" className="text-v-daylight">
                          —
                        </span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </Reveal>
          </li>
        ))}
      </ol>
    </div>
  );
}
