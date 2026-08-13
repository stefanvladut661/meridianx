"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { captureUTM, getStoredUTM } from "@/lib/utm";
import type { LeadCreatedResponse } from "@/lib/validations/lead";
import type { FieldErrors } from "./validate";

/**
 * Motorul comun al formularelor video (FAZA 3): captură UTM, validare
 * cu schema FAZEI 0, POST la /api/leads, stări distincte.
 *
 * Stările sunt trei lucruri diferite, nu trei nuanțe: „se trimite”
 * (butonul e ocupat), „gata” (formularul dispare, apare confirmarea),
 * „nu a plecat” (datele rămân completate, spunem ce s-a întâmplat).
 */

export type LeadFormStatus = "idle" | "submitting" | "success" | "error";

/** Câmpurile pe care le compun formularele video din contractul LeadInput. */
export interface LeadDraft {
  source: string;
  name: string;
  phone?: string;
  email?: string;
  company?: string;
  projectType?: string;
  budgetRange?: string;
  timeline?: string;
  message?: string;
  /** Honeypot — trebuie să rămână gol. */
  website?: string;
}

export interface UseLeadSubmit {
  status: LeadFormStatus;
  fieldErrors: FieldErrors;
  /** Eroarea de nivel formular (rețea, rate limit, câmp invizibil). */
  formError: string | null;
  submit: (draft: LeadDraft, visibleFields: readonly string[]) => Promise<void>;
  reset: () => void;
}

export function useLeadSubmit(): UseLeadSubmit {
  const locale = useLocale();
  const t = useTranslations("forms");
  const [status, setStatus] = useState<LeadFormStatus>("idle");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  // first-touch: atribuim campania care a adus vizitatorul, nu ultima pagină
  useEffect(() => {
    captureUTM();
  }, []);

  const reset = useCallback(() => {
    setStatus("idle");
    setFieldErrors({});
    setFormError(null);
  }, []);

  const submit = useCallback(
    async (draft: LeadDraft, visibleFields: readonly string[]) => {
      setFieldErrors({});
      setFormError(null);

      // Honeypot completat = bot. Contractul FAZEI 0 cere „succes fals,
      // fără insert”; îl servim din client, fără să mai lovim API-ul.
      // (Ruta nu poate face asta azi — vezi observația din PLAN.md:
      // schema respinge `website` non-gol înainte de ramura de honeypot,
      // deci serverul răspunde 400 în loc de 200.)
      if (draft.website && draft.website.trim() !== "") {
        setStatus("success");
        return;
      }

      // Butonul intră în „se trimite” din prima apăsare — inclusiv pe
      // durata importului de mai jos, ca să nu existe un moment mort
      // în care pare că nu s-a întâmplat nimic.
      setStatus("submitting");

      // Zod se încarcă abia la trimitere: schema FAZEI 0 rămâne sursa
      // de adevăr, dar nu intră în JS-ul inițial al paginii (aceeași
      // disciplină ca GSAP/Lenis în F2). Până aici, câmpurile
      // obligatorii sunt deja verificate de formular.
      const { compact, validateLead, FORM_LEVEL_ERROR } = await import(
        "./validate"
      );

      const utm = getStoredUTM();
      const payload = compact({
        ...draft,
        division: "video" as const,
        locale: locale === "en" ? "en" : "ro",
        isFunded: false,
        utm: compact({
          source: utm.source,
          medium: utm.medium,
          campaign: utm.campaign,
        }),
        referrer: utm.referrer,
        website: draft.website ?? "",
      });

      const result = validateLead(payload, {
        required: t("errors.required"),
        invalidEmail: t("errors.invalidEmail"),
        invalidPhone: t("errors.invalidPhone"),
        tooLong: (max) => t("errors.tooLong", { max }),
      }, visibleFields);

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

        // Honeypot completat → serverul răspunde 200 cu id gol. Pentru
        // bot arată identic cu succesul; nimic nu se persistă.
        (await response.json()) as LeadCreatedResponse;
        setStatus("success");
      } catch {
        setFormError(t("errors.submitFailed"));
        setStatus("error");
      }
    },
    [locale, t]
  );

  return { status, fieldErrors, formError, submit, reset };
}
