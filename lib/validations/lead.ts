import { z } from "zod";
import { DIVISIONS } from "@/lib/division";

/**
 * Contractul API pentru lead-uri (FAZA 0, ÎNGHEȚAT).
 * F3 și F5 validează cu ACESTE scheme pe client înainte de POST;
 * F6 le refolosește pe server. Nu redefini scheme locale.
 *
 * Honeypot: câmpul `website` există în toate formularele, e ascuns
 * vizual (nu display:none pe input-ul real — folosește poziționare
 * off-screen + aria-hidden + tabIndex=-1) și TREBUIE să rămână gol.
 */

export const LEAD_STATUSES = [
  "new",
  "contacted",
  "qualified",
  "proposal",
  "won",
  "lost",
] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const leadInputSchema = z
  .object({
    division: z.enum(DIVISIONS),
    /** Pagina/formularul sursă: 'video-contact', 'video-audit', 'software-brief', 'software-fonduri'... */
    source: z.string().min(1).max(80),
    locale: z.enum(["ro", "en"]).default("ro"),
    name: z.string().trim().min(2).max(120),
    email: z.email().max(254).optional(),
    phone: z
      .string()
      .trim()
      .regex(/^\+?[0-9\s().-]{7,20}$/)
      .optional(),
    company: z.string().trim().max(160).optional(),
    projectType: z.string().max(80).optional(),
    budgetRange: z.string().max(80).optional(),
    timeline: z.string().max(160).optional(),
    message: z.string().max(5000).optional(),
    /** Lead din segmentul „fonduri de modernizare". */
    isFunded: z.boolean().default(false),
    utm: z
      .object({
        source: z.string().max(160).optional(),
        medium: z.string().max(160).optional(),
        campaign: z.string().max(160).optional(),
      })
      .optional(),
    referrer: z.string().max(500).optional(),
    /** Honeypot — orice valoare non-goală = spam, răspundem 200 fals. */
    website: z.string().max(0).optional().or(z.literal("")),
  })
  .refine((data) => data.email || data.phone, {
    message: "Cerem cel puțin un canal de contact: email sau telefon.",
    path: ["email"],
  });

export type LeadInput = z.infer<typeof leadInputSchema>;

/** Răspunsul POST /api/leads (201). */
export interface LeadCreatedResponse {
  ok: true;
  id: string;
}

export const leadEventInputSchema = z.object({
  /** 'brief_step', 'estimator_used', 'download', 'call_booked'... */
  type: z.string().min(1).max(60),
  payload: z.record(z.string(), z.unknown()).default({}),
});

export type LeadEventInput = z.infer<typeof leadEventInputSchema>;

export const leadPatchSchema = z
  .object({
    status: z.enum(LEAD_STATUSES).optional(),
    notes: z.string().max(10000).optional(),
  })
  .refine((data) => data.status !== undefined || data.notes !== undefined, {
    message: "PATCH gol — trimite cel puțin status sau notes.",
  });

export type LeadPatch = z.infer<typeof leadPatchSchema>;

export const leadListQuerySchema = z.object({
  division: z.enum(DIVISIONS).optional(),
  status: z.enum(LEAD_STATUSES).optional(),
  /** Căutare liberă în name/email/company. */
  q: z.string().max(120).optional(),
  from: z.iso.datetime().optional(),
  to: z.iso.datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(25),
});

export type LeadListQuery = z.infer<typeof leadListQuerySchema>;

/** Forma standard a erorilor API — fără detalii interne către client. */
export interface ApiError {
  ok: false;
  error: string;
}
