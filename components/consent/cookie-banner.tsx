"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { isDivision, type Division } from "@/lib/division";
import {
  CONSENT_EVENT,
  CONSENT_NONE,
  readConsent,
  writeConsent,
} from "@/lib/consent";

/**
 * Bannerul de cookie-uri.
 *
 * Blochează efectiv: `lib/analytics.ts` nu injectează nimic până nu
 * există un „da” pe categoria respectivă. Refuzul e la fel de vizibil
 * ca acceptul — un buton „Doar necesare” de aceeași mărime, nu un link
 * gri ascuns în colț.
 *
 * Se colorează după lumea în care se află vizitatorul (cookie-ul de
 * divizie, citit pe client): pe /video e indigo pe fundal închis, pe
 * /software e verde pe hârtie, pe poartă e neutru. Citirea pe server ar
 * fi făcut toate paginile dinamice — nu merită pentru un banner.
 *
 * `data-scope` pe înveliș nu e decorativ: el aduce tokens-ii `--md-*`
 * în subarborele bannerului, care stă în afara oricărui `.md-root`.
 *
 * z-index 70 — peste comutatorul de lumi (55) și peste barele fixe
 * (50). Un banner de consimțământ care intră sub altceva e o problemă
 * juridică, nu una vizuală.
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
      data-scope={world ?? "gate"}
      className="fixed inset-x-0 bottom-0 z-[70] p-3 sm:p-4"
    >
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="false"
        aria-labelledby="cookie-banner-title"
        aria-describedby="cookie-banner-body"
        className="mx-auto max-w-4xl rounded-panel border border-hair bg-char p-5 text-bone shadow-2xl shadow-black/40 outline-none sm:p-6"
      >
        <p className="eyebrow">{t("eyebrow")}</p>
        <h2
          id="cookie-banner-title"
          className="display mt-3 text-[clamp(1.15rem,2.6vw,1.5rem)]"
        >
          {t("title")}
        </h2>
        <p
          id="cookie-banner-body"
          className="mt-2 text-[14.5px] leading-relaxed text-dim"
        >
          {t("body")}{" "}
          <Link
            href="/legal/cookies"
            className="text-a1 underline-offset-4 hover:underline"
          >
            {t("readPolicy")}
          </Link>
        </p>

        {expanded ? (
          <fieldset className="mt-5 divide-y divide-hair border-y border-hair">
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
          <button
            type="button"
            className="btn btn-primary !min-h-11 !px-5 !py-2.5 !text-[14px]"
            onClick={() => decide({ analytics: true, marketing: true })}
          >
            {t("acceptAll")}
          </button>
          <button
            type="button"
            className="btn btn-ghost !min-h-11 !px-5 !py-2.5 !text-[14px]"
            onClick={() => decide(CONSENT_NONE)}
          >
            {t("rejectAll")}
          </button>
          {expanded ? (
            <button
              type="button"
              className="btn btn-ghost !min-h-11 !px-5 !py-2.5 !text-[14px]"
              onClick={() => decide({ analytics, marketing })}
            >
              {t("saveChoice")}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="text-[14px] text-dim underline-offset-4 transition-colors hover:text-bone hover:underline"
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
          "mt-1 size-4 shrink-0 accent-[var(--md-a1)]",
          disabled && "opacity-60"
        )}
      />
      <div className="min-w-0">
        <label
          htmlFor={id}
          className="flex flex-wrap items-center gap-2 text-[14.5px] font-medium text-bone"
        >
          {label}
          {lockedLabel ? (
            <span className="font-md-mono text-[10px] tracking-[0.18em] text-a2">
              {lockedLabel}
            </span>
          ) : null}
        </label>
        <p className="mt-1 text-[14px] leading-relaxed text-dim">
          {description}
        </p>
      </div>
    </div>
  );
}
