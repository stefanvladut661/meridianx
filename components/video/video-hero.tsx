"use client";

import { useCallback, useEffect, useRef, type CSSProperties } from "react";
import { Link } from "@/i18n/navigation";
import { buttonClasses } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { useReducedMotion } from "@/lib/hooks/use-reduced-motion";
import { WordReveal } from "./word-reveal";

const MIN_K = 3200;
const MAX_K = 5600;
const DEFAULT_K = 4400;

/**
 * Hero-ul diviziei VIDEO — signature-ul paginii home (FAZA 2):
 * „Balansul de alb”. Tensiunea tungsten↔daylight nu e doar paletă,
 * e un instrument pe care vizitatorul chiar îl folosește: un slider
 * de balans de alb (input range — accesibil la tastatură și touch)
 * și pointer-tracking pe desktop mută linia de split și glow-urile
 * de temperatură peste toată scena.
 *
 * LCP: headline-ul e HTML server-randat cu animație CSS pură;
 * nu așteaptă GSAP/Lenis. Sub reduced-motion: fără pointer-tracking,
 * dar sliderul rămâne funcțional — e un control, nu o animație.
 */
export function VideoHero() {
  const reducedMotion = useReducedMotion();
  const rootRef = useRef<HTMLElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const readoutRef = useRef<HTMLSpanElement>(null);

  const applyKelvin = useCallback((kelvin: number) => {
    const root = rootRef.current;
    if (!root) return;
    const clamped = Math.min(
      MAX_K,
      Math.max(MIN_K, Math.round(kelvin / 50) * 50)
    );
    const k = (clamped - MIN_K) / (MAX_K - MIN_K);
    root.style.setProperty("--k", k.toFixed(3));
    if (readoutRef.current) readoutRef.current.textContent = `${clamped}K`;
    const input = inputRef.current;
    if (input) {
      input.setAttribute("aria-valuetext", `${clamped} Kelvin`);
      if (document.activeElement !== input) input.value = String(clamped);
    }
  }, []);

  useEffect(() => {
    if (reducedMotion) return;
    const root = rootRef.current;
    if (!root) return;
    if (!window.matchMedia("(pointer: fine)").matches) return;

    let frame = 0;
    let pointerX = 0;

    const onMove = (event: PointerEvent) => {
      pointerX = event.clientX;
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const rect = root.getBoundingClientRect();
        if (rect.width === 0) return;
        const ratio = Math.min(1, Math.max(0, (pointerX - rect.left) / rect.width));
        applyKelvin(MIN_K + ratio * (MAX_K - MIN_K));
      });
    };

    root.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      root.removeEventListener("pointermove", onMove);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [reducedMotion, applyKelvin]);

  return (
    <section
      ref={rootRef}
      style={{ "--k": "0.5" } as CSSProperties}
      className="relative flex min-h-[92svh] flex-col justify-center overflow-hidden py-24"
    >
      {/* Scena: glow tungsten (stânga) și daylight (dreapta), plus linia de split a balansului */}
      <div aria-hidden="true" className="absolute inset-0">
        <div
          className="absolute -left-1/4 top-0 h-full w-3/4 bg-[radial-gradient(closest-side,rgba(255,140,59,0.24),transparent)] blur-3xl"
          style={{ opacity: "calc(1 - var(--k) * 0.85)" }}
        />
        <div
          className="absolute -right-1/4 bottom-0 h-full w-3/4 bg-[radial-gradient(closest-side,rgba(67,201,224,0.2),transparent)] blur-3xl"
          style={{ opacity: "calc(0.15 + var(--k) * 0.85)" }}
        />
        <div
          className="absolute inset-y-0 w-px bg-gradient-to-b from-transparent via-v-bone/25 to-transparent"
          style={{ left: "calc(var(--k) * 100%)" }}
        />
      </div>

      <Container className="relative">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-muted">
          {/* i18n: */}
          MERIDIAN VIDEO · WB{" "}
          <span ref={readoutRef} className="text-fg/80">
            {DEFAULT_K}K
          </span>{" "}
          · ISO 800 · 1/50
        </p>

        <h1 className="mt-8 font-display text-[clamp(2.75rem,9.5vw,7.25rem)] leading-[0.95] tracking-tight">
          {/* i18n: */}
          <WordReveal text="Cald vinde." className="block text-v-tungsten" step={90} />
          <WordReveal
            text="Rece convinge."
            className="block text-v-daylight"
            delay={260}
            step={90}
          />
          <WordReveal
            text="Noi le filmăm pe amândouă."
            className="mt-4 block text-[0.4em] font-medium leading-tight text-fg"
            delay={620}
            step={45}
          />
        </h1>

        <p className="mt-8 max-w-2xl text-pretty text-lg text-fg/70">
          {/* i18n: */}
          Producție video comercială pentru imobiliare, corporate, evenimente,
          personal brand și industrie. Reglăm lumina la temperatura la care
          cumpără clientul tău — și o ținem aprinsă și în campanii.
        </p>

        <div className="mt-10 flex flex-wrap gap-4">
          <Link href="/video/portofoliu" className={buttonClasses({ size: "lg" })}>
            {/* i18n: */}
            Vezi portofoliul
          </Link>
          <Link
            href="/video/contact"
            className={buttonClasses({ variant: "secondary", size: "lg" })}
          >
            {/* i18n: */}
            Cere ofertă
          </Link>
        </div>

        {/* Instrumentul: balansul de alb. Control real, nu decor. */}
        <div className="mt-16 max-w-xl">
          <label
            htmlFor="mv-wb-hero"
            className="font-mono text-[11px] uppercase tracking-[0.25em] text-muted"
          >
            {/* i18n: */}
            Balans de alb — trage și vezi diferența
          </label>
          <input
            id="mv-wb-hero"
            ref={inputRef}
            type="range"
            min={MIN_K}
            max={MAX_K}
            step={50}
            defaultValue={DEFAULT_K}
            aria-valuetext={`${DEFAULT_K} Kelvin`}
            onInput={(event) => applyKelvin(Number(event.currentTarget.value))}
            className="mv-wb mt-3 w-full"
          />
          <div className="mt-2 flex justify-between font-mono text-[11px] tracking-[0.2em]">
            <span className="text-v-tungsten">3200K TUNGSTEN</span>
            <span className="text-v-daylight">5600K DAYLIGHT</span>
          </div>
        </div>
      </Container>

      <style>{`
.mv-wb{-webkit-appearance:none;appearance:none;height:28px;background:transparent}
.mv-wb::-webkit-slider-runnable-track{height:4px;border-radius:2px;background:linear-gradient(90deg,var(--v-tungsten),#8d949c 50%,var(--v-daylight))}
.mv-wb::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;margin-top:-8px;height:20px;width:20px;border-radius:50%;background:var(--v-bone);border:2px solid var(--v-void);box-shadow:0 0 0 1px rgba(237,232,224,0.45)}
.mv-wb::-moz-range-track{height:4px;border-radius:2px;background:linear-gradient(90deg,var(--v-tungsten),#8d949c 50%,var(--v-daylight))}
.mv-wb::-moz-range-thumb{height:20px;width:20px;border-radius:50%;background:var(--v-bone);border:2px solid var(--v-void);box-shadow:0 0 0 1px rgba(237,232,224,0.45)}
`}</style>
    </section>
  );
}
