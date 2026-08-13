import { leadInputSchema, type LeadInput } from "@/lib/validations/lead";

/**
 * Validarea pe client a formularelor video (FAZA 3).
 *
 * Contractul FAZEI 0 e lege: validăm cu `leadInputSchema`, aceeași
 * schemă pe care o rulează serverul (F6). Nu redefinim reguli locale —
 * traducem doar problemele în mesajele standard din `forms.errors.*`.
 */

export type FieldErrors = Record<string, string>;

/** Cheia sub care punem erorile care nu aparțin unui câmp vizibil. */
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

/**
 * Scoate câmpurile opționale rămase goale. `z.email()` respinge "",
 * deci un câmp necompletat trebuie să lipsească din payload, nu să fie
 * string gol.
 */
export function compact<T extends Record<string, unknown>>(input: T): T {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (typeof value === "string" && value.trim() === "") continue;
    if (value === undefined || value === null) continue;
    out[key] = value;
  }
  return out as T;
}

/**
 * @param visibleFields câmpurile chiar randate în formular; o eroare
 * pe un câmp absent (ex. `email` în formularul de audit) urcă la
 * nivel de formular, ca să nu rămână invizibilă.
 */
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
    const field = visibleFields.includes(rawField)
      ? rawField
      : FORM_LEVEL_ERROR;

    let message: string;
    if (issue.code === "custom") {
      // ex. refine-ul „email SAU telefon” — mesajul e deja scris în schemă
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

    // prima eroare per câmp câștigă — nu suprapunem mesaje
    if (!errors[field]) errors[field] = message;
  }

  return { ok: false, errors };
}
