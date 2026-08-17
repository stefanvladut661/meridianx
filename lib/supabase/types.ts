import type { Division } from "@/lib/division";
import type { LeadInput, LeadStatus } from "@/lib/validations/lead";

/**
 * Stratul de tipuri între baza de date și restul aplicației (FAZA 6).
 *
 * Regula: în afara acestui fișier NIMENI nu vede `snake_case`. Baza
 * vorbește `created_at` / `project_type`, aplicația vorbește `createdAt` /
 * `projectType`. Traducerea se face aici, într-un singur loc, ca migrarea
 * spre un CRM complet (iterația 2) să atingă un singur fișier.
 *
 * `Lead` e tipul din contractul FAZEI 0 pentru `GET /api/leads`
 * (`{ ok: true, items: Lead[], ... }`) — e forma pe care o consumă și
 * dashboard-ul, ca să nu existe două adevăruri.
 */

/** Rândul din `public.leads`, exact cum îl întoarce Supabase. */
export interface LeadRow {
  id: string;
  created_at: string;
  division: Division;
  source: string;
  locale: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  project_type: string | null;
  budget_range: string | null;
  timeline: string | null;
  message: string | null;
  status: LeadStatus;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  referrer: string | null;
  notes: string | null;
  is_funded: boolean;
}

/** Rândul din `public.lead_events`. */
export interface LeadEventRow {
  id: string;
  lead_id: string;
  type: string;
  payload: Record<string, unknown>;
  created_at: string;
}

/** Forma publică a unui lead. Singura care circulă prin API și UI. */
export interface Lead {
  id: string;
  createdAt: string;
  division: Division;
  source: string;
  locale: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  projectType: string | null;
  budgetRange: string | null;
  timeline: string | null;
  message: string | null;
  status: LeadStatus;
  utm: {
    source: string | null;
    medium: string | null;
    campaign: string | null;
  };
  referrer: string | null;
  notes: string | null;
  /** Lead din segmentul „fonduri de modernizare" — cel mai valoros. */
  isFunded: boolean;
}

export interface LeadEvent {
  id: string;
  leadId: string;
  type: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

/** Indicatorii din capul dashboard-ului. */
export interface LeadStats {
  /** Lead-uri în ultimele 7 zile. */
  thisWeek: number;
  /** Lead-uri în cele 7 zile dinainte — pentru comparație. */
  previousWeek: number;
  total: number;
  video: number;
  software: number;
  funded: number;
  /** Câte au trecut de `new` (contacted și mai departe). */
  qualified: number;
  /** `qualified / total`, 0–1. Null când nu există încă lead-uri. */
  qualificationRate: number | null;
}

export function toLead(row: LeadRow): Lead {
  return {
    id: row.id,
    createdAt: row.created_at,
    division: row.division,
    source: row.source,
    locale: row.locale,
    name: row.name,
    email: row.email,
    phone: row.phone,
    company: row.company,
    projectType: row.project_type,
    budgetRange: row.budget_range,
    timeline: row.timeline,
    message: row.message,
    status: row.status,
    utm: {
      source: row.utm_source,
      medium: row.utm_medium,
      campaign: row.utm_campaign,
    },
    referrer: row.referrer,
    notes: row.notes,
    isFunded: row.is_funded,
  };
}

export function toLeadEvent(row: LeadEventRow): LeadEvent {
  return {
    id: row.id,
    leadId: row.lead_id,
    type: row.type,
    payload: row.payload ?? {},
    createdAt: row.created_at,
  };
}

/** `undefined` din payload devine `null` în bază — coloanele sunt nullable. */
function orNull(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/** Payload-ul validat (contractul F0) → rândul de inserat. */
export function toLeadInsert(
  input: LeadInput
): Omit<LeadRow, "id" | "created_at" | "status" | "notes"> {
  return {
    division: input.division,
    source: input.source,
    locale: input.locale,
    name: input.name.trim(),
    email: orNull(input.email),
    phone: orNull(input.phone),
    company: orNull(input.company),
    project_type: orNull(input.projectType),
    budget_range: orNull(input.budgetRange),
    timeline: orNull(input.timeline),
    message: orNull(input.message),
    utm_source: orNull(input.utm?.source),
    utm_medium: orNull(input.utm?.medium),
    utm_campaign: orNull(input.utm?.campaign),
    referrer: orNull(input.referrer),
    is_funded: input.isFunded,
  };
}

/** Etichetele de status, în română, pentru dashboard și emailuri. */
export const STATUS_LABELS: Record<LeadStatus, string> = {
  new: "Nou",
  contacted: "Contactat",
  qualified: "Calificat",
  proposal: "Ofertă trimisă",
  won: "Câștigat",
  lost: "Pierdut",
};
