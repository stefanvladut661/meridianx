import { leadInputSchema, type LeadInput } from "@/lib/validations/lead";

/**
 * Validarea pe client a brief-ului software (FAZA 5).
 *
 * Contractul FAZEI 0 e lege: validăm cu `leadInputSchema`, aceeași
 * schemă pe care o rulează serverul (F6), și traducem problemele în
 * mesajele standard din `forms.errors.*`.
 *
 * DUPLICARE CONȘTIENTĂ: `components/video/forms/validate.ts` face
 * același lucru pentru divizia video. Regula CLAUDE.md §6.6 —
 * duplicarea temporară e mai ieftină decât un conflict de merge între
 * terminale. Candidat de deduplicare la F7 (`lib/leads/`).
 */

export type FieldErrors = Record<string, string>;

export const FORM_LEVEL_ERROR = "_form";

export interface ValidationMessages {
  required: string;
  invalidEmail: string;
  invalidPhone: string;
  tooLong: (max: number) => string;
}

export type ValidationResult =
  | { ok: true; data: LeadInput }
  | { ok: false; errors: FieldErrors };

/** Scoate câmpurile opționale goale — `z.email()` respinge "". */
export function compact<T extends Record<string, unknown>>(input: T): T {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (typeof value === "string" && value.trim() === "") continue;
    if (value === undefined || value === null) continue;
    out[key] = value;
  }
  return out as T;
}

export function validateLead(
  input: unknown,
  messages: ValidationMessages,
  visibleFields: readonly string[]
): ValidationResult {
  const parsed = leadInputSchema.safeParse(input);
  if (parsed.success) return { ok: true, data: parsed.data };

  const errors: FieldErrors = {};

  for (const issue of parsed.error.issues) {
    const rawField = String(issue.path[0] ?? FORM_LEVEL_ERROR);
    const field = visibleFields.includes(rawField) ? rawField : FORM_LEVEL_ERROR;

    let message: string;
    if (issue.code === "custom") {
      message = issue.message;
    } else if (rawField === "email") {
      message = messages.invalidEmail;
    } else if (rawField === "phone") {
      message = messages.invalidPhone;
    } else if (issue.code === "too_big" && typeof issue.maximum === "number") {
      message = messages.tooLong(issue.maximum);
    } else if (issue.code === "too_small") {
      message = messages.required;
    } else {
      message = issue.message;
    }

    if (!errors[field]) errors[field] = message;
  }

  return { ok: false, errors };
}
