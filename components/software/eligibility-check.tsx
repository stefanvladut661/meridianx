"use client";

import { useId, useMemo, useState } from "react";
import { Link } from "@/i18n/navigation";
import {
  eligibilityQuestions,
  eligibilityVerdicts,
} from "@/content/software/funding";
import { cn } from "@/lib/utils";
import { softwareCtaClasses } from "./cta";

/**
 * Testul de încadrare (FAZA 4, pagina /software/fonduri).
 *
 * CTA-ul de calificare cerut de brief, separat de restul site-ului — dar
 * NU un formular: nu colectează nimic, nu trimite nimic, nu cere email ca
 * să-ți dea răspunsul. Formularele software sunt zona F5 (CLAUDE.md §6);
 * aici e doar un instrument care citește ce bifezi și îți dă verdictul,
 * inclusiv „încă nu”.
 *
 * Un test de calificare care nu poate spune „nu” e o reclamă deghizată.
 * Ăsta poate, și de aceea merită încredere.
 */

type Answer = "da" | "nu";

export function EligibilityCheck() {
  const groupId = useId();
  const [answers, setAnswers] = useState<Record<string, Answer | undefined>>({});

  const answered = eligibilityQuestions.filter(
    (question) => answers[question.id] !== undefined
  ).length;
  const complete = answered === eligibilityQuestions.length;

  const verdict = useMemo(() => {
    if (!complete) return null;
    const yes = eligibilityQuestions.filter(
      (question) => answers[question.id] === "da"
    ).length;
    if (yes === eligibilityQuestions.length) return eligibilityVerdicts.full;
    if (yes >= 2) return eligibilityVerdicts.partial;
    return eligibilityVerdicts.none;
  }, [answers, complete]);

  return (
    <div className="overflow-hidden rounded-lg border border-line bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3 sm:px-7">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-accent-2">
          {/* i18n: */}
          Test de încadrare
        </p>
        <p
          className="font-mono text-[11px] tabular-nums tracking-[0.18em] text-muted"
          aria-hidden="true"
        >
          {String(answered).padStart(2, "0")}/
          {String(eligibilityQuestions.length).padStart(2, "0")}
        </p>
      </div>

      <div className="px-5 py-6 sm:px-7">
        <p className="max-w-2xl text-sm leading-relaxed text-fg/70">
          {/* i18n: */}
          Patru întrebări, răspuns pe loc. Nu se trimite nimic nicăieri și nu
          îți cerem emailul ca să vezi rezultatul.
        </p>

        <ol className="mt-6 space-y-6">
          {eligibilityQuestions.map((question, index) => {
            const value = answers[question.id];
            return (
              <li key={question.id}>
                <fieldset>
                  <legend className="flex gap-3 text-pretty text-base leading-snug text-fg">
                    <span
                      aria-hidden="true"
                      className="font-mono text-[11px] tabular-nums leading-6 tracking-[0.18em] text-muted"
                    >
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span>{question.question}</span>
                  </legend>

                  <div className="mt-3 flex gap-2 pl-8">
                    {(["da", "nu"] as const).map((option) => {
                      const id = `${groupId}-${question.id}-${option}`;
                      const selected = value === option;
                      return (
                        <div key={option}>
                          <input
                            type="radio"
                            id={id}
                            name={`${groupId}-${question.id}`}
                            value={option}
                            checked={selected}
                            onChange={() =>
                              setAnswers((previous) => ({
                                ...previous,
                                [question.id]: option,
                              }))
                            }
                            className="peer sr-only"
                          />
                          <label
                            htmlFor={id}
                            className={cn(
                              "block cursor-pointer rounded-sm border px-4 py-1.5 font-mono text-[11px] uppercase tracking-[0.18em] transition-colors duration-150",
                              "peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-(--focus-ring)",
                              selected
                                ? "border-accent bg-s-signal text-s-ink"
                                : "border-line text-fg/70 hover:border-muted hover:text-fg"
                            )}
                          >
                            {option}
                          </label>
                        </div>
                      );
                    })}
                  </div>

                  {value === "nu" ? (
                    <p className="mt-3 border-l-2 border-accent-2/60 py-1 pl-4 text-sm leading-relaxed text-fg/70 sm:ml-8">
                      {question.ifNo}
                    </p>
                  ) : null}
                </fieldset>
              </li>
            );
          })}
        </ol>
      </div>

      {/* Citirea instrumentului. aria-live: verdictul apare fără reîncărcare,
          deci trebuie anunțat cititoarelor de ecran. */}
      <div
        aria-live="polite"
        className="border-t border-line bg-bg px-5 py-6 sm:px-7"
      >
        {verdict ? (
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-accent">
              {verdict.code}
            </p>
            <p className="mt-3 text-balance font-display text-xl font-semibold tracking-tight">
              {verdict.title}
            </p>
            <p className="mt-2 max-w-2xl text-pretty text-sm leading-relaxed text-fg/75">
              {verdict.body}
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              {verdict === eligibilityVerdicts.none ? null : (
                <Link
                  href="/software/brief"
                  className={softwareCtaClasses({ size: "md" })}
                >
                  {/* i18n: */}
                  Completează brief-ul
                </Link>
              )}
              <button
                type="button"
                onClick={() => setAnswers({})}
                className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted underline-offset-4 hover:text-fg hover:underline"
              >
                {/* i18n: */}
                Șterge răspunsurile
              </button>
            </div>
          </div>
        ) : (
          <p className="font-mono text-[11px] uppercase leading-relaxed tracking-[0.16em] text-muted">
            {/* i18n: */}
            Răspunde la toate patru ca să vezi citirea.
          </p>
        )}
      </div>
    </div>
  );
}
