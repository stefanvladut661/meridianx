"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/lib/hooks/use-reduced-motion";
import {
  CEILING,
  FEATURES,
  FLOOR,
  INTEGRATIONS,
  PROJECT_TYPES,
  type ProjectTypeId,
} from "@/lib/estimator-config";
import { formatEuro, type Estimate } from "./estimate";

/**
 * SIGNATURE-UL PAGINII /software/brief (FAZA 5) — „fișa de calibrare”.
 *
 * Un instrument de măsură care câștigă precizie: fiecare răspuns din
 * brief adaugă o linie în fișă și strânge banda de estimare. Lățimea
 * benzii NU e decor — e exact cât de puțin știm încă despre proiect.
 *
 * De ce e onest: un estimator care scuipă „12.400 €” după trei
 * click-uri minte. Ăsta arată din prima că nu poate ști, și arată și
 * cum ajunge să știe. Cifra finală rămâne mereu un interval.
 *
 * Motion: sub 400ms peste tot (CLAUDE.md §2 — lumea software).
 * Reduced motion: valorile sar direct, banda nu tranziționează.
 */

/** Scală logaritmică: 1.500 € și 60.000 € pe același rigla, lizibil. */
function position(value: number): number {
  const min = Math.log(FLOOR);
  const max = Math.log(CEILING);
  const clamped = Math.min(CEILING, Math.max(FLOOR, value));
  return ((Math.log(clamped) - min) / (max - min)) * 100;
}

const TICKS = [2500, 5000, 15000, 30000, 60000];

/** Contor scurt — motion-ul lumii software: rapid, funcțional, sub 400ms. */
function useCountUp(target: number, disabled: boolean): number {
  const [display, setDisplay] = useState(target);
  const fromRef = useRef(target);

  useEffect(() => {
    if (disabled) {
      fromRef.current = target;
      setDisplay(target);
      return;
    }

    const from = fromRef.current;
    if (from === target) return;

    const duration = 320;
    let frame = 0;
    let start = 0;

    const tick = (time: number) => {
      if (!start) start = time;
      const progress = Math.min(1, (time - start) / duration);
      // ease-out: ajunge repede aproape de valoare, apoi se așază
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(from + (target - from) * eased));
      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      } else {
        fromRef.current = target;
      }
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, disabled]);

  return display;
}

export interface CalibrationRows {
  type: ProjectTypeId | null;
  screens: number | null;
  features: string[];
  integrations: string[];
  languages: number;
  maintenance: boolean;
}

export interface CalibrationReadoutProps {
  rows: CalibrationRows;
  estimate: Estimate;
  step: number;
  totalSteps: number;
  className?: string;
}

function labelsFor(ids: string[], catalog: typeof FEATURES): string {
  const labels = ids
    .map((id) => catalog.find((item) => item.id === id)?.label)
    .filter((label): label is string => Boolean(label));
  return labels.length > 0 ? labels.join(", ") : "—";
}

export function CalibrationReadout({
  rows,
  estimate,
  step,
  totalSteps,
  className,
}: CalibrationReadoutProps) {
  const reducedMotion = useReducedMotion();
  const low = useCountUp(estimate.low, reducedMotion || !estimate.ok);
  const high = useCountUp(estimate.high, reducedMotion || !estimate.ok);

  const type = PROJECT_TYPES.find((item) => item.id === rows.type);
  const left = estimate.ok ? position(estimate.low) : 0;
  const width = estimate.ok ? position(estimate.high) - left : 0;

  // i18n: copy RO hardcodat — F7 îl extrage
  const specs: { key: string; value: string }[] = [
    { key: "TIP", value: type?.label ?? "—" },
    {
      key: type ? type.screenNoun.toUpperCase() : "ECRANE",
      value: rows.screens !== null ? String(rows.screens) : "—",
    },
    { key: "FUNCȚII", value: labelsFor(rows.features, FEATURES) },
    { key: "INTEGRĂRI", value: labelsFor(rows.integrations, INTEGRATIONS) },
    {
      key: "LIMBI",
      value:
        rows.languages <= 1 ? "doar română" : `${rows.languages} limbi`,
    },
    { key: "MENTENANȚĂ", value: rows.maintenance ? "da, lunar" : "nu" },
  ];

  return (
    <aside
      aria-label="Fișa de calibrare a proiectului"
      className={cn(
        "overflow-hidden rounded-md border border-line bg-surface",
        className
      )}
    >
      <div className="flex items-center justify-between border-b border-line px-5 py-3">
        <p className="font-mono text-[11px] tracking-[0.24em] text-accent">
          ■ FIȘĂ DE CALIBRARE
        </p>
        <p className="font-mono text-[11px] tracking-[0.18em] text-muted">
          {String(step).padStart(2, "0")} / {String(totalSteps).padStart(2, "0")}
        </p>
      </div>

      <dl className="divide-y divide-line">
        {specs.map((spec) => (
          <div
            key={spec.key}
            className={cn(
              "items-baseline gap-4 px-5 py-2.5",
              // pe mobil fișa crește odată cu răspunsurile: rândurile
              // încă necompletate ar împinge întrebarea sub fold
              spec.value === "—" ? "hidden lg:flex" : "flex"
            )}
          >
            <dt className="w-28 shrink-0 font-mono text-[11px] tracking-[0.16em] text-muted">
              {spec.key}
            </dt>
            <dd className="min-w-0 flex-1 text-sm text-fg">{spec.value}</dd>
          </div>
        ))}
      </dl>

      <div className="border-t border-line px-5 py-5">
        <div className="flex items-baseline justify-between gap-3">
          <p className="font-mono text-[11px] tracking-[0.24em] text-muted">
            INTERVAL ESTIMAT
          </p>
          {/* la plafon, un „±10%” ar sugera exact precizia pe care
              instrumentul o contestă — mai bine nimic */}
          {estimate.ok && !estimate.aboveCeiling ? (
            <p className="font-mono text-[11px] tracking-[0.16em] text-accent-2">
              ±{Math.round(estimate.uncertainty * 100)}%
            </p>
          ) : null}
        </div>

        {estimate.ok ? (
          <>
            <p
              aria-live="polite"
              className="mt-3 font-display text-2xl tabular-nums tracking-tight text-fg sm:text-3xl"
            >
              {estimate.aboveCeiling
                ? `Peste ${formatEuro(CEILING)}`
                : `${formatEuro(low)} – ${formatEuro(high)}`}
            </p>

            {/* rigla: banda arată cât de larg e intervalul pe scara reală */}
            <div className="mt-5">
              <div className="relative h-8">
                <div className="absolute inset-x-0 top-3 h-px bg-line" />
                <div
                  className={cn(
                    "absolute top-1.5 h-4 rounded-xs bg-accent/25 ring-1 ring-accent",
                    !reducedMotion &&
                      "transition-[left,width] duration-300 ease-out"
                  )}
                  style={{ left: `${left}%`, width: `${Math.max(width, 1.5)}%` }}
                />
                {TICKS.map((tick) => (
                  <div
                    key={tick}
                    className="absolute top-1 h-4 w-px bg-line"
                    style={{ left: `${position(tick)}%` }}
                  />
                ))}
              </div>
              <div className="relative h-4">
                {TICKS.map((tick) => (
                  <span
                    key={tick}
                    className="absolute -translate-x-1/2 font-mono text-[10px] tracking-wider text-muted"
                    style={{ left: `${position(tick)}%` }}
                  >
                    {tick / 1000}k
                  </span>
                ))}
              </div>
            </div>

            <p className="mt-5 text-xs text-muted">
              Estimare orientativă. Banda se strânge cu fiecare răspuns —
              prețul final se stabilește după discuție, nu de aici.
            </p>
            {estimate.aboveCeiling ? (
              <p className="mt-2 text-xs text-accent-2">
                Peste 60.000 € nu mai estimăm dintr-un formular. La valorile
                astea meriți o discuție, nu un calculator.
              </p>
            ) : null}
          </>
        ) : (
          <p className="mt-3 text-sm text-muted">
            {rows.type === "altceva"
              ? "Pentru proiectele care încă nu au o formă, orice cifră ar fi o invenție. Completează brief-ul și îți spunem la telefon."
              : "Alege tipul proiectului și rigla începe să măsoare."}
          </p>
        )}
      </div>
    </aside>
  );
}
