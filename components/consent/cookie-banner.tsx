"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { isDivision, type Division } from "@/lib/division";
import {
  CONSENT_EVENT,
  CONSENT_NONE,
  readConsent,
  writeConsent,
} from "@/lib/consent";

/**
 * Bannerul de cookie-uri (FAZA 7).
 *
 * Blochează efectiv: `lib/analytics.ts` nu injectează nimic până nu
 * există un „da” pe categoria respectivă. Refuzul e la fel de vizibil
 * ca acceptul — un buton „Doar necesare” de aceeași mărime, nu un link
 * gri ascuns în colț.
 *
 * Se colorează după lumea în care se află vizitatorul (cookie-ul de
 * divizie, citit pe client): pe /video e cald, pe /software e rece, pe
 * gateway e neutru. Citirea pe server ar fi făcut toate paginile
 * dinamice — nu merită pentru un banner.
 */

function readDivision(): Division | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((entry) => entry.startsWith("meridian_division="));
  if (!match) return null;
  const value = match.slice("meridian_division=".length);
  return isDivision(value) ? value : null;
}

export function CookieBanner() {
  const t = useTranslations("cookies");
  const [visible, setVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [world, setWorld] = useState<Division | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const evaluate = useCallback(() => {
    setVisible(readConsent() === null);
    setWorld(readDivision());
  }, []);

  useEffect(() => {
    evaluate();
    window.addEventListener(CONSENT_EVENT, evaluate);
    return () => window.removeEventListener(CONSENT_EVENT, evaluate);
  }, [evaluate]);

  useEffect(() => {
    if (visible) ref.current?.focus();
  }, [visible]);

  if (!visible) return null;

  const decide = (choice: { analytics: boolean; marketing: boolean }) => {
    writeConsent({ necessary: true, ...choice });
    setVisible(false);
  };

  return (
    <div
      data-world={world ?? undefined}
      className="fixed inset-x-0 bottom-0 z-(--z-toast) p-3 sm:p-4"
    >
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="false"
        aria-labelledby="cookie-banner-title"
        aria-describedby="cookie-banner-body"
        className="mx-auto max-w-4xl rounded-md border border-line bg-surface p-5 shadow-overlay outline-none sm:p-6"
      >
        <p className="font-mono text-[11px] tracking-[0.24em] text-accent">
          {t("eyebrow")}
        </p>
        <h2
          id="cookie-banner-title"
          className="mt-3 font-display text-xl tracking-tight sm:text-2xl"
        >
          {t("title")}
        </h2>
        <p id="cookie-banner-body" className="mt-2 text-sm text-muted">
          {t("body")}{" "}
          <Link
            href="/legal/cookies"
            className="text-accent underline-offset-4 hover:underline"
          >
            {t("readPolicy")}
          </Link>
        </p>

        {expanded ? (
          <fieldset className="mt-5 divide-y divide-line border-y border-line">
            <legend className="sr-only">{t("categoriesLegend")}</legend>

            <CategoryRow
              id="cookie-necessary"
              label={t("categories.necessary.label")}
              description={t("categories.necessary.description")}
              checked
              disabled
              onChange={() => undefined}
              lockedLabel={t("alwaysOn")}
            />
            <CategoryRow
              id="cookie-analytics"
              label={t("categories.analytics.label")}
              description={t("categories.analytics.description")}
              checked={analytics}
              onChange={setAnalytics}
            />
            <CategoryRow
              id="cookie-marketing"
              label={t("categories.marketing.label")}
              description={t("categories.marketing.description")}
              checked={marketing}
              onChange={setMarketing}
            />
          </fieldset>
        ) : null}

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Button onClick={() => decide({ analytics: true, marketing: true })}>
            {t("acceptAll")}
          </Button>
          <Button
            variant="secondary"
            onClick={() => decide(CONSENT_NONE)}
          >
            {t("rejectAll")}
          </Button>
          {expanded ? (
            <Button variant="ghost" onClick={() => decide({ analytics, marketing })}>
              {t("saveChoice")}
            </Button>
          ) : (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="text-sm text-muted underline-offset-4 transition-colors duration-150 hover:text-fg hover:underline"
            >
              {t("customize")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

interface CategoryRowProps {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  lockedLabel?: string;
  onChange: (value: boolean) => void;
}

function CategoryRow({
  id,
  label,
  description,
  checked,
  disabled,
  lockedLabel,
  onChange,
}: CategoryRowProps) {
  return (
    <div className="flex items-start gap-4 py-3.5">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className={cn(
          "mt-1 size-4 shrink-0 accent-[var(--accent)]",
          disabled && "opacity-60"
        )}
      />
      <div className="min-w-0">
        <label
          htmlFor={id}
          className="flex flex-wrap items-center gap-2 text-sm font-medium text-fg"
        >
          {label}
          {lockedLabel ? (
            <span className="font-mono text-[10px] tracking-[0.18em] text-accent-2">
              {lockedLabel}
            </span>
          ) : null}
        </label>
        <p className="mt-1 text-sm text-muted">{description}</p>
      </div>
    </div>
  );
}
