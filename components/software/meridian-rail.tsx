"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * SIGNATURE-UL DIVIZIEI SOFTWARE (FAZA 4) — linia meridian cu gradații.
 *
 * Nu e un progress bar decorativ. E un instrument de măsură:
 * - scara reprezintă întregul document, nu viewport-ul;
 * - fiecare secțiune are o gradație majoră la poziția ei REALĂ, măsurată
 *   din DOM — dacă o secțiune e lungă, distanța pe scară e mare;
 * - gradațiile minore sunt echidistante și dau densitatea citirii;
 * - citirea de jos afișează secțiunea curentă și poziția în document.
 *
 * E și navigație funcțională: fiecare gradație majoră e o ancoră reală,
 * care merge și fără JavaScript (`href="#id"`). Etichetele stau în DOM
 * pentru cititoarele de ecran; vizual apare doar cea activă sau cea
 * peste care ești cu mouse-ul/focusul — un instrument arată o citire.
 *
 * Vizibil de la xl în sus: sub asta, marginea nu există și un rail
 * înghesuit ar fi decor, nu măsură.
 */

export interface RailSection {
  /** id-ul elementului <section> din pagină. */
  id: string;
  /** Eticheta scurtă, citită de instrument. */
  label: string;
}

const MINOR_TICKS = 48;

export function MeridianRail({ sections }: { sections: RailSection[] }) {
  // Înainte de măsurare: distribuție uniformă. Server și client randează
  // identic, deci fără eroare de hidratare; măsurarea reală vine în effect.
  const [offsets, setOffsets] = useState<number[]>(() =>
    sections.map((_, index) =>
      sections.length > 1 ? index / (sections.length - 1) : 0
    )
  );
  const [progress, setProgress] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const frame = useRef<number | null>(null);

  const measure = useCallback(() => {
    const doc = document.documentElement;
    const scrollable = doc.scrollHeight - window.innerHeight;
    if (scrollable <= 0) {
      setOffsets(sections.map(() => 0));
      return;
    }
    setOffsets(
      sections.map((section) => {
        const element = document.getElementById(section.id);
        if (!element) return 0;
        const top = element.getBoundingClientRect().top + window.scrollY;
        return Math.min(1, Math.max(0, top / scrollable));
      })
    );
  }, [sections]);

  const read = useCallback(() => {
    const doc = document.documentElement;
    const scrollable = doc.scrollHeight - window.innerHeight;
    const ratio = scrollable > 0 ? window.scrollY / scrollable : 0;
    setProgress(Math.min(1, Math.max(0, ratio)));

    // Secțiunea activă = ultima al cărei prag a fost depășit. Pragul e la
    // o treime de viewport, ca titlul să fie citit când ajunge sus.
    const threshold = window.scrollY + window.innerHeight / 3;
    let current = 0;
    sections.forEach((section, index) => {
      const element = document.getElementById(section.id);
      if (!element) return;
      const top = element.getBoundingClientRect().top + window.scrollY;
      if (top <= threshold) current = index;
    });
    setActiveIndex(current);
  }, [sections]);

  useEffect(() => {
    const onScroll = () => {
      if (frame.current !== null) return;
      frame.current = window.requestAnimationFrame(() => {
        frame.current = null;
        read();
      });
    };

    measure();
    read();

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", measure);

    // Secțiunile își schimbă înălțimea (fonturi, imagini, filtre) —
    // remăsurăm în loc să presupunem.
    const observer = new ResizeObserver(() => {
      measure();
      read();
    });
    observer.observe(document.body);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", measure);
      observer.disconnect();
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, [measure, read]);

  if (sections.length === 0) return null;

  return (
    <nav
      aria-label="Gradațiile paginii"
      className="pointer-events-none fixed inset-y-0 left-0 z-(--z-signature) hidden w-16 select-none xl:block"
    >
      {/* Coloana instrumentului: linia, gradațiile minore, cursorul. */}
      <div className="absolute inset-y-20 left-7 w-px bg-line">
        {/* gradații minore — densitatea citirii */}
        {Array.from({ length: MINOR_TICKS + 1 }, (_, index) => (
          <span
            key={index}
            aria-hidden="true"
            className={cn(
              "absolute left-0 h-px bg-line",
              index % 4 === 0 ? "w-2" : "w-1"
            )}
            style={{ top: `${(index / MINOR_TICKS) * 100}%` }}
          />
        ))}

        {/* porțiunea parcursă — se umple în signal */}
        <span
          aria-hidden="true"
          className="absolute left-0 top-0 w-px bg-accent"
          style={{ height: `${progress * 100}%` }}
        />

        {/* cursorul de citire */}
        <span
          aria-hidden="true"
          className="absolute -left-[3px] h-px w-[7px] bg-accent"
          style={{ top: `${progress * 100}%` }}
        >
          <span className="absolute -top-[2px] left-[7px] block size-[5px] rotate-45 border-r border-t border-accent" />
        </span>

        {/* gradații majore — o secțiune reală fiecare */}
        {sections.map((section, index) => {
          const active = index === activeIndex;
          return (
            <a
              key={section.id}
              href={`#${section.id}`}
              aria-current={active ? "true" : undefined}
              className="group pointer-events-auto absolute left-0 flex items-center gap-2 py-1.5 pl-0 pr-2 focus-visible:outline-offset-4"
              style={{ top: `${offsets[index] * 100}%` }}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "block h-px transition-[width,background-color] duration-200",
                  active
                    ? "w-5 bg-accent"
                    : "w-3 bg-muted group-hover:w-5 group-hover:bg-fg"
                )}
              />
              <span
                className={cn(
                  "whitespace-nowrap rounded-xs bg-bg/90 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em] backdrop-blur-sm",
                  "transition-opacity duration-200",
                  active
                    ? "text-accent opacity-100"
                    : "text-fg opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"
                )}
              >
                {section.label}
              </span>
            </a>
          );
        })}
      </div>

      {/* Citirea instrumentului. aria-hidden: informația e deja disponibilă
          prin aria-current de pe gradația activă. */}
      <p
        aria-hidden="true"
        className="absolute bottom-6 left-2 font-mono text-[10px] leading-tight tracking-[0.18em] text-muted"
      >
        <span className="block text-accent-2">
          {String(activeIndex + 1).padStart(2, "0")}/
          {String(sections.length).padStart(2, "0")}
        </span>
        {String(Math.round(progress * 100)).padStart(3, "0")}%
      </p>
    </nav>
  );
}
