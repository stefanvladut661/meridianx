"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { whatsappHref, type ContactContext } from "@/components/video/cta/channels";

/**
 * Confirmarea de după trimitere (FAZA 3).
 *
 * Regula de copy (CLAUDE.md §4): confirmarea folosește exact
 * vocabularul butonului („Ofertă cerută”, „Audit cerut”), spune ce
 * urmează concret și cât durează. Nu se scuză, nu e vagă.
 *
 * Focusul sare aici după trimitere, iar regiunea e aria-live, ca omul
 * care navighează la tastatură sau cu cititor de ecran să afle că
 * formularul a plecat, nu doar cel care vede.
 */
export interface FormSuccessProps {
  /** Ex. „Ofertă cerută.” — același verb ca pe buton. */
  title: string;
  /** Ce urmează, în ordine. Fiecare pas e concret și are termen. */
  steps: string[];
  /** Contextul pentru scurtătura de WhatsApp („nu am răbdare”). */
  context: ContactContext;
  /** Textul de deasupra scurtăturii de WhatsApp. */
  impatientLabel?: string;
  className?: string;
}

export function FormSuccess({
  title,
  steps,
  context,
  impatientLabel,
  className,
}: FormSuccessProps) {
  const ref = useRef<HTMLDivElement>(null);
  const wa = whatsappHref(context);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="status"
      aria-live="polite"
      className={cn(
        "rounded-md border border-accent bg-surface p-6 sm:p-8",
        className
      )}
    >
      <p className="font-mono text-[11px] tracking-[0.28em] text-accent">
        {/* i18n: */}
        ■ ÎNREGISTRAT
      </p>
      <h3 className="mt-4 font-display text-3xl tracking-tight sm:text-4xl">
        {title}
      </h3>
      <ol className="mt-6 space-y-3">
        {steps.map((step, index) => (
          <li key={step} className="flex gap-3 text-fg/80">
            <span
              aria-hidden="true"
              className="mt-0.5 font-mono text-xs tracking-[0.2em] text-accent-2"
            >
              {String(index + 1).padStart(2, "0")}
            </span>
            <span className="text-pretty">{step}</span>
          </li>
        ))}
      </ol>
      {wa ? (
        <p className="mt-7 text-sm text-fg/70">
          {impatientLabel ??
            /* i18n: */ "Nu ai răbdare? Scrie-ne direct pe WhatsApp — "}
          <a
            href={wa}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-accent underline-offset-4 hover:underline"
          >
            {/* i18n: */}
            deschide conversația
            <span className="sr-only"> (se deschide în filă nouă)</span>
          </a>
          .
        </p>
      ) : null}
    </div>
  );
}
