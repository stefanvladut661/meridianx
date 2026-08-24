import type { SupabaseClient } from "@supabase/supabase-js";
import type { LeadInput, LeadListQuery, LeadStatus } from "@/lib/validations/lead";
import { LEAD_STATUSES } from "@/lib/validations/lead";
import {
  createAdminClient,
  createReadOnlySessionClient,
} from "./clients";
import {
  toLead,
  toLeadEvent,
  toLeadInsert,
  type Lead,
  type LeadEvent,
  type LeadEventRow,
  type LeadRow,
  type LeadStats,
} from "./types";

/**
 * Stratul de date pentru lead-uri (FAZA 6).
 *
 * Toate interogările trec pe aici — rutele API și dashboard-ul nu ating
 * niciodată `supabase.from(...)` direct. Motivul e cerința din brief:
 * panoul trebuie să poată crește spre CRM complet, iar asta e imposibil
 * dacă interogările sunt împrăștiate prin componente.
 *
 * Fiecare funcție întoarce un `Result` explicit în loc să arunce: rutele
 * trebuie să distingă „nu e configurat” de „a eșuat” de „nu există”, ca
 * să răspundă cu statusul corect.
 */

export type DataResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: "unconfigured" | "not_found" | "error"; detail?: string };

const LEAD_COLUMNS =
  "id, created_at, division, source, locale, name, email, phone, company, " +
  "project_type, budget_range, timeline, message, status, utm_source, " +
  "utm_medium, utm_campaign, referrer, notes, is_funded";

function fail(
  reason: "unconfigured" | "not_found" | "error",
  detail?: string
): { ok: false; reason: "unconfigured" | "not_found" | "error"; detail?: string } {
  return { ok: false, reason, detail };
}

/**
 * Clientul Supabase fără tipuri generate întoarce, pentru `select("col, col")`,
 * un union care include `GenericStringError`. Forma reală a rândului e
 * garantată de schema din `supabase/migrations/`, nu de TypeScript, deci
 * conversia trece intenționat prin `unknown`.
 *
 * Când proiectul va genera tipuri (`supabase gen types`), astea două
 * funcții dispar și `SupabaseClient<Database>` face treaba corect.
 */
function asRow<T>(data: unknown): T {
  return data as T;
}

function asRows<T>(data: unknown): T[] {
  return (data ?? []) as T[];
}

// ---------------------------------------------------------------------------
// Scriere — insert public de lead
// ---------------------------------------------------------------------------

/**
 * Inserează lead-ul și evenimentul `created` în aceeași operațiune logică.
 *
 * Dacă evenimentul eșuează, lead-ul RĂMÂNE — un istoric incomplet e mult
 * mai puțin grav decât un lead pierdut. Eșecul se loghează pe server.
 */
export async function createLead(
  input: LeadInput
): Promise<DataResult<Lead>> {
  const supabase = createAdminClient();
  if (!supabase) return fail("unconfigured");

  const { data, error } = await supabase
    .from("leads")
    .insert(toLeadInsert(input))
    .select(LEAD_COLUMNS)
    .single();

  if (error || !data) {
    return fail("error", error?.message);
  }

  const lead = toLead(asRow<LeadRow>(data));

  const { error: eventError } = await supabase.from("lead_events").insert({
    lead_id: lead.id,
    type: "created",
    payload: {
      source: lead.source,
      locale: lead.locale,
      utm: lead.utm,
      referrer: lead.referrer,
    },
  });
  if (eventError) {
    console.error("[leads] lead salvat, evenimentul 'created' a eșuat:", eventError.message);
  }

  return { ok: true, data: lead };
}

/** Evenimente ulterioare (pași de brief, estimator, download, call). */
export async function addLeadEvent(
  leadId: string,
  type: string,
  payload: Record<string, unknown>
): Promise<DataResult<string>> {
  const supabase = createAdminClient();
  if (!supabase) return fail("unconfigured");

  // Verificăm existența înainte: ruta e publică, iar un FK violation ar
  // răspunde 500 acolo unde adevărul e 404.
  const { data: lead, error: lookupError } = await supabase
    .from("leads")
    .select("id")
    .eq("id", leadId)
    .maybeSingle();

  if (lookupError) return fail("error", lookupError.message);
  if (!lead) return fail("not_found");

  const { data, error } = await supabase
    .from("lead_events")
    .insert({ lead_id: leadId, type, payload })
    .select("id")
    .single();

  if (error || !data) return fail("error", error?.message);
  return { ok: true, data: data.id as string };
}

// ---------------------------------------------------------------------------
// Citire — dashboard și GET /api/leads
// ---------------------------------------------------------------------------

/**
 * Citirile merg pe clientul legat de sesiune: RLS rămâne un al doilea
 * strat de apărare, după verificarea de autentificare din rută. Dacă
 * cineva scapă o rută neprotejată, baza tot refuză.
 */
async function readClient(): Promise<SupabaseClient | null> {
  return createReadOnlySessionClient();
}

export interface LeadListResult {
  items: Lead[];
  total: number;
  page: number;
  perPage: number;
}

export async function listLeads(
  query: LeadListQuery
): Promise<DataResult<LeadListResult>> {
  const supabase = await readClient();
  if (!supabase) return fail("unconfigured");

  const from = (query.page - 1) * query.perPage;
  let request = supabase
    .from("leads")
    .select(LEAD_COLUMNS, { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, from + query.perPage - 1);

  if (query.division) request = request.eq("division", query.division);
  if (query.status) request = request.eq("status", query.status);
  if (query.from) request = request.gte("created_at", query.from);
  if (query.to) request = request.lte("created_at", query.to);
  if (query.q) {
    // Escape pentru sintaxa `or()` din PostgREST: virgula separă condiții.
    const term = query.q.replace(/[,()]/g, " ").trim();
    if (term) {
      request = request.or(
        `name.ilike.%${term}%,email.ilike.%${term}%,company.ilike.%${term}%`
      );
    }
  }

  const { data, error, count } = await request;
  if (error) return fail("error", error.message);

  return {
    ok: true,
    data: {
      items: asRows<LeadRow>(data).map(toLead),
      total: count ?? 0,
      page: query.page,
      perPage: query.perPage,
    },
  };
}

export async function getLead(
  id: string
): Promise<DataResult<{ lead: Lead; events: LeadEvent[] }>> {
  const supabase = await readClient();
  if (!supabase) return fail("unconfigured");

  const { data, error } = await supabase
    .from("leads")
    .select(LEAD_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error) return fail("error", error.message);
  if (!data) return fail("not_found");

  const { data: eventRows, error: eventsError } = await supabase
    .from("lead_events")
    .select("id, lead_id, type, payload, created_at")
    .eq("lead_id", id)
    .order("created_at", { ascending: false });

  if (eventsError) return fail("error", eventsError.message);

  return {
    ok: true,
    data: {
      lead: toLead(asRow<LeadRow>(data)),
      events: asRows<LeadEventRow>(eventRows).map(toLeadEvent),
    },
  };
}

/** Toate rândurile care se potrivesc filtrului, pentru exportul CSV. */
export async function listLeadsForExport(
  query: Omit<LeadListQuery, "page" | "perPage">
): Promise<DataResult<Lead[]>> {
  const supabase = await readClient();
  if (!supabase) return fail("unconfigured");

  let request = supabase
    .from("leads")
    .select(LEAD_COLUMNS)
    .order("created_at", { ascending: false })
    // Plafon de siguranță: un export nelimitat pe un tabel mare ar bloca
    // funcția. La 5000 de lead-uri se filtrează pe interval de timp.
    .limit(5000);

  if (query.division) request = request.eq("division", query.division);
  if (query.status) request = request.eq("status", query.status);
  if (query.from) request = request.gte("created_at", query.from);
  if (query.to) request = request.lte("created_at", query.to);
  if (query.q) {
    const term = query.q.replace(/[,()]/g, " ").trim();
    if (term) {
      request = request.or(
        `name.ilike.%${term}%,email.ilike.%${term}%,company.ilike.%${term}%`
      );
    }
  }

  const { data, error } = await request;
  if (error) return fail("error", error.message);
  return { ok: true, data: asRows<LeadRow>(data).map(toLead) };
}

/** Indicatorii din capul dashboard-ului, într-un singur drum la bază. */
export async function getLeadStats(): Promise<DataResult<LeadStats>> {
  const supabase = await readClient();
  if (!supabase) return fail("unconfigured");

  const { data, error } = await supabase
    .from("leads")
    .select("created_at, division, status, is_funded")
    .limit(10000);

  if (error) return fail("error", error.message);

  const rows = (data ?? []) as Array<
    Pick<LeadRow, "created_at" | "division" | "status" | "is_funded">
  >;

  const now = Date.now();
  const week = 7 * 24 * 60 * 60 * 1000;
  let thisWeek = 0;
  let previousWeek = 0;
  let video = 0;
  let software = 0;
  let funded = 0;
  let qualified = 0;

  for (const row of rows) {
    const age = now - new Date(row.created_at).getTime();
    if (age <= week) thisWeek += 1;
    else if (age <= week * 2) previousWeek += 1;

    if (row.division === "video") video += 1;
    else software += 1;

    if (row.is_funded) funded += 1;
    if (row.status !== "new" && row.status !== "lost") qualified += 1;
  }

  return {
    ok: true,
    data: {
      thisWeek,
      previousWeek,
      total: rows.length,
      video,
      software,
      funded,
      qualified,
      qualificationRate: rows.length > 0 ? qualified / rows.length : null,
    },
  };
}

// ---------------------------------------------------------------------------
// Actualizare — status și note din admin
// ---------------------------------------------------------------------------

export interface LeadPatchFields {
  status?: LeadStatus;
  notes?: string;
}

/**
 * Actualizează lead-ul și scrie evenimentele corespunzătoare.
 * Apelantul TREBUIE să fi verificat deja sesiunea: aici se folosește
 * service role, ca actualizarea să nu depindă de nuanțele de RLS.
 */
export async function updateLead(
  id: string,
  patch: LeadPatchFields,
  actor: string | null
): Promise<DataResult<Lead>> {
  const supabase = createAdminClient();
  if (!supabase) return fail("unconfigured");

  const { data: current, error: lookupError } = await supabase
    .from("leads")
    .select("id, status")
    .eq("id", id)
    .maybeSingle();

  if (lookupError) return fail("error", lookupError.message);
  if (!current) return fail("not_found");

  const fields: Record<string, unknown> = {};
  if (patch.status !== undefined) fields.status = patch.status;
  if (patch.notes !== undefined) fields.notes = patch.notes;

  const { data, error } = await supabase
    .from("leads")
    .update(fields)
    .eq("id", id)
    .select(LEAD_COLUMNS)
    .single();

  if (error || !data) return fail("error", error?.message);

  const events: Array<{ lead_id: string; type: string; payload: Record<string, unknown> }> = [];
  if (patch.status !== undefined && patch.status !== current.status) {
    events.push({
      lead_id: id,
      type: "status_changed",
      payload: { from: current.status, to: patch.status, actor },
    });
  }
  if (patch.notes !== undefined) {
    events.push({
      lead_id: id,
      type: "note_added",
      payload: { length: patch.notes.length, actor },
    });
  }
  if (events.length > 0) {
    const { error: eventError } = await supabase.from("lead_events").insert(events);
    if (eventError) {
      console.error("[leads] update reușit, evenimentele au eșuat:", eventError.message);
    }
  }

  return { ok: true, data: toLead(asRow<LeadRow>(data)) };
}

/** Marchează trimiterea emailurilor, ca să se vadă în istoric. */
export async function recordEmailEvent(
  leadId: string,
  payload: Record<string, unknown>
): Promise<void> {
  const supabase = createAdminClient();
  if (!supabase) return;
  const { error } = await supabase
    .from("lead_events")
    .insert({ lead_id: leadId, type: "email_sent", payload });
  if (error) {
    console.error("[leads] evenimentul 'email_sent' a eșuat:", error.message);
  }
}

export { LEAD_STATUSES };
