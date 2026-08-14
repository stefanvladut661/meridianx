"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { captureUTM, getStoredUTM } from "@/lib/utm";
import type { LeadCreatedResponse } from "@/lib/validations/lead";
import type { FieldErrors } from "./validate";

/**
 * Motorul de lead al diviziei SOFTWARE (FAZA 5).
 *
 * Față de varianta video: `division: "software"` și, după crearea
 * lead-ului, trimite evenimentele cerute de brief (răspunsurile pe
 * pași + estimarea) la `/api/leads/[id]/events`.
 *
 * Evenimentele sunt analitice, nu lead-ul: dacă pică, omul tot vede
 * confirmarea. Nu-l pedepsim pentru o cerere secundară eșuată.
 *
 * Duplicat conștient al hook-ului din `components/video/forms/` —
 * candidat de deduplicare la F7 (`lib/leads/use-lead-submit.ts`).
 */

export type LeadFormStatus = "idle" | "submitting" | "success" | "error";

export interface SoftwareLeadDraft {
  source: string;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  projectType?: string;
  budgetRange?: string;
  timeline?: string;
  message?: string;
  isFunded?: boolean;
  /** Honeypot — trebuie să rămână gol. */
  website?: string;
}

export interface LeadEvent {
  type: string;
  payload: Record<string, unknown>;
}

export interface UseLeadSubmit {
  status: LeadFormStatus;
  fieldErrors: FieldErrors;
  formError: string | null;
  submit: (
    draft: SoftwareLeadDraft,
    visibleFields: readonly string[],
    events?: LeadEvent[]
  ) => Promise<void>;
  reset: () => void;
}

export function useLeadSubmit(): UseLeadSubmit {
  const locale = useLocale();
  const t = useTranslations("forms");
  const [status, setStatus] = useState<LeadFormStatus>("idle");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    captureUTM();
  }, []);

  const reset = useCallback(() => {
    setStatus("idle");
    setFieldErrors({});
    setFormError(null);
  }, []);

  const submit = useCallback(
    async (
      draft: SoftwareLeadDraft,
      visibleFields: readonly string[],
      events: LeadEvent[] = []
    ) => {
      setFieldErrors({});
      setFormError(null);

      // Honeypot completat = bot. Contractul cere „succes fals, fără
      // insert”; îl servim din client. (Ruta nu poate azi — vezi
      // observația F3 din PLAN.md: schema respinge `website` non-gol
      // înainte de ramura de honeypot, deci serverul dă 400.)
      if (draft.website && draft.website.trim() !== "") {
        setStatus("success");
        return;
      }

      setStatus("submitting");

      // Zod se încarcă abia la trimitere — schema F0 rămâne sursa de
      // adevăr, dar nu intră în JS-ul inițial al paginii (aceeași
      // disciplină ca la F3; vezi nota din PLAN.md).
      const { compact, validateLead, FORM_LEVEL_ERROR } = await import(
        "./validate"
      );

      const utm = getStoredUTM();
      const payload = compact({
        ...draft,
        division: "software" as const,
        locale: locale === "en" ? "en" : "ro",
        isFunded: draft.isFunded ?? false,
        utm: compact({
          source: utm.source,
          medium: utm.medium,
          campaign: utm.campaign,
        }),
        referrer: utm.referrer,
        website: draft.website ?? "",
      });

      const result = validateLead(
        payload,
        {
          required: t("errors.required"),
          invalidEmail: t("errors.invalidEmail"),
          invalidPhone: t("errors.invalidPhone"),
          tooLong: (max) => t("errors.tooLong", { max }),
        },
        visibleFields
      );

      if (!result.ok) {
        const { [FORM_LEVEL_ERROR]: formLevel, ...rest } = result.errors;
        setFieldErrors(rest);
        setFormError(formLevel ?? null);
        setStatus("error");
        return;
      }

      try {
        const response = await fetch("/api/leads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(result.data),
        });

        if (response.status === 429) {
          setFormError(t("errors.rateLimited"));
          setStatus("error");
          return;
        }

        if (!response.ok) {
          setFormError(t("errors.submitFailed"));
          setStatus("error");
          return;
        }

        const created = (await response.json()) as LeadCreatedResponse;
        setStatus("success");

        // Evenimentele pleacă după confirmare și nu o pot strica.
        if (created.id && events.length > 0) {
          void Promise.allSettled(
            events.map((event) =>
              fetch(`/api/leads/${created.id}/events`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(event),
              })
            )
          );
        }
      } catch {
        setFormError(t("errors.submitFailed"));
        setStatus("error");
      }
    },
    [locale, t]
  );

  return { status, fieldErrors, formError, submit, reset };
}
