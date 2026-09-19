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
  "id, created_at, updated_at, division, source, locale, name, email, phone, company, " +
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
 * Fereastra în care două trimiteri identice se consideră aceeași trimitere.
 * Cinci minute: acoperă dublu-click, refresh cu formularul completat și
 * „n-a mers, mai încerc o dată”, dar nu blochează un om care revine peste
 * o oră cu alt proiect de pe aceeași adresă.
 */
const DEDUPE_WINDOW_MS = 5 * 60 * 1000;

/**
 * Lead-ul identic trimis adineauri, dacă există.
 *
 * DE CE: formularele au stare de loading, dar un dublu-click rapid, un
 * refresh sau o rețea proastă tot produc două POST-uri. Două rânduri
 * pentru același om înseamnă două emailuri de notificare și un panou în
 * care nu știi pe care dintre ele ai lucrat. Contractul rămâne intact —
 * răspunsul e tot 201 cu un id valid, doar că e id-ul primului.
 */
async function findRecentDuplicate(
  supabase: SupabaseClient,
  input: LeadInput
): Promise<Lead | null> {
  const contact = input.email?.trim() || input.phone?.trim();
  if (!contact) return null;

  const since = new Date(Date.now() - DEDUPE_WINDOW_MS).toISOString();

  const { data, error } = await supabase
    .from("leads")
    .select(LEAD_COLUMNS)
    .eq("division", input.division)
    .eq("source", input.source)
    .eq(input.email?.trim() ? "email" : "phone", contact)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // O căutare eșuată nu are voie să blocheze un lead: mai bine un duplicat
  // decât o vânzare pierdută.
  if (error || !data) return null;
  return toLead(asRow<LeadRow>(data));
}

/**
 * Inserează lead-ul și evenimentul `created` în aceeași operațiune logică.
 *
 * Dacă evenimentul eșuează, lead-ul RĂMÂNE — un istoric incomplet e mult
 * mai puțin grav decât un lead pierdut. Eșecul se loghează pe server.
 */
export async function createLead(
  input: LeadInput
): Promise<DataResult<Lead & { duplicate?: true }>> {
  const supabase = createAdminClient();
  if (!supabase) return fail("unconfigured");

  const existing = await findRecentDuplicate(supabase, input);
  if (existing) {
    // Se notează în istoric, nu se ascunde: dacă cineva se întreabă de ce
    // n-a primit două emailuri, răspunsul e vizibil pe lead.
    const { error: eventError } = await supabase.from("lead_events").insert({
      lead_id: existing.id,
      type: "duplicate_suppressed",
      payload: { source: input.source, withinSeconds: DEDUPE_WINDOW_MS / 1000 },
    });
    if (eventError) {
      console.error("[leads] duplicat detectat, evenimentul a eșuat:", eventError.message);
    }
    return { ok: true, data: { ...existing, duplicate: true } };
  }

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

/**
 * Plafon de evenimente per lead.
 *
 * Ruta de evenimente e publică (F5 trimite pașii de brief din browser),
 * deci cine află un id poate umple istoricul acelui lead cu zgomot.
 * Rate limit-ul pe IP încetinește, dar nu plafonează. Un brief real
 * generează sub 40 de evenimente; 200 lasă loc și pentru revenirea
 * cuiva care completează în trei reprize.
 */
const MAX_EVENTS_PER_LEAD = 200;

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

  const { count, error: countError } = await supabase
    .from("lead_events")
    .select("id", { count: "exact", head: true })
    .eq("lead_id", leadId);

  if (!countError && (count ?? 0) >= MAX_EVENTS_PER_LEAD) {
    // Răspundem ca la un succes: clientul legitim (wizard-ul de brief) nu
    // are ce face cu o eroare pe telemetrie, iar unui bot nu-i spunem că a
    // atins un plafon. Rândul nu se scrie.
    console.warn(`[events] plafon atins pentru lead ${leadId} — eveniment ignorat: ${type}`);
    return { ok: true, data: "" };
  }

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

// ---------------------------------------------------------------------------
// Diagnostic
// ---------------------------------------------------------------------------

export interface DatabasePing {
  /** Conexiunea + autentificarea cu service role funcționează. */
  reachable: boolean;
  /** Ambele migrări sunt aplicate (`updated_at` vine din a doua). */
  schemaCurrent: boolean;
  leadCount: number | null;
  detail?: string;
}

/**
 * O interogare reală, nu o verificare de variabile de mediu.
 *
 * Diferența contează exact în ziua deploy-ului: „cheile sunt setate” și
 * „baza răspunde și are schema corectă” sunt două lucruri, iar al doilea
 * e cel care spune dacă lead-urile chiar au unde să aterizeze. Selectăm
 * toate coloanele pe care le folosește aplicația, ca o migrare neaplicată
 * să iasă la iveală aici, nu la primul formular trimis de un client.
 */
export async function pingDatabase(): Promise<DatabasePing> {
  const supabase = createAdminClient();
  if (!supabase) {
    return { reachable: false, schemaCurrent: false, leadCount: null, detail: "unconfigured" };
  }

  const { error, count } = await supabase
    .from("leads")
    .select(LEAD_COLUMNS, { count: "exact", head: true });

  if (error) {
    // Coloana lipsă înseamnă migrarea 2 neaplicată, nu bază căzută.
    const missingColumn = /column .* does not exist/i.test(error.message);
    return {
      reachable: !missingColumn ? false : true,
      schemaCurrent: false,
      leadCount: null,
      detail: error.message,
    };
  }

  return { reachable: true, schemaCurrent: true, leadCount: count ?? 0 };
}

export type ProbeStep = "ok" | "failed" | "skipped";

export interface DatabaseProbe {
  /** Toți pașii au reușit. */
  ok: boolean;
  steps: {
    /** Rândul de test a fost scris cu service role. */
    insert: ProbeStep;
    /** Același rând, citit înapoi după id. */
    read: ProbeStep;
    /** Rândul de test a fost șters. */
    delete: ProbeStep;
    /** Numărătoarea lead-urilor reale. */
    count: ProbeStep;
  };
  /** Lead-uri reale în bază (rândul de test nu intră). */
  leadCount: number | null;
  durationMs: number;
  /** Mesajul primei erori — pentru log și pentru emailul de alertă. */
  detail?: string;
  /** Id-ul rândului de test dacă ștergerea a picat — ca să se poată curăța. */
  leftoverId?: string;
}

/**
 * Rândul de test scris de sondă. Sursa `keepalive` și numele îl fac
 * imposibil de confundat cu un lead real dacă, printr-o eroare de
 * ștergere, rămâne în panou.
 */
const PROBE_LEAD = {
  division: "software",
  source: "keepalive",
  locale: "ro",
  name: "TEST AUTOMAT — rând de sondă, șterge-l",
  email: "keepalive@meridianx.ro",
  message:
    "Rând scris de sonda zilnică (/api/cron/keepalive) ca să țină proiectul Supabase activ. Se șterge imediat după ce e citit înapoi.",
  is_funded: false,
} as const;

/**
 * Activitate REALĂ în bază, nu doar o verificare de conexiune.
 *
 * DE CE EXISTĂ: Supabase pune pe pauză proiectele din planul gratuit care
 * nu au „suficiente cereri de la utilizatori către bază în ultima
 * săptămână” — documentația spune că „de regulă câteva cereri pe zi” ajung.
 * Un `count` singur, o dată pe săptămână, nu e „chiar sub prag”: e sub el.
 * Sonda face patru cereri distincte prin Data API — insert, select,
 * delete, count — și, în trecere, dovedește tot lanțul de care depinde un
 * lead real: cheia de service role e valabilă, schema e la zi, scrierea
 * chiar merge.
 *
 * Rândul de test se șterge în aceeași rulare, ca panoul și statisticile
 * să nu vadă niciodată un lead care nu există. Dacă ștergerea pică, id-ul
 * pleacă în raport ca să se poată curăța de mână.
 */
export async function probeDatabase(): Promise<DatabaseProbe> {
  const started = Date.now();
  const probe: DatabaseProbe = {
    ok: false,
    steps: { insert: "skipped", read: "skipped", delete: "skipped", count: "skipped" },
    leadCount: null,
    durationMs: 0,
  };
  const finish = () => {
    probe.durationMs = Date.now() - started;
    probe.ok = Object.values(probe.steps).every((step) => step === "ok");
    return probe;
  };

  const supabase = createAdminClient();
  if (!supabase) {
    probe.detail = "Supabase neconfigurat — lipsesc NEXT_PUBLIC_SUPABASE_URL sau SUPABASE_SERVICE_ROLE_KEY.";
    probe.steps.insert = "failed";
    return finish();
  }

  // Clientul întoarce erorile de rețea ca `error`, dar un proiect pus pe
  // pauză nu mai are nici DNS, iar `fetch` poate arunca înainte să ajungă
  // la client. Prindem ambele forme.
  try {
    const { data: inserted, error: insertError } = await supabase
      .from("leads")
      .insert(PROBE_LEAD)
      .select("id")
      .single();

    if (insertError || !inserted) {
      probe.steps.insert = "failed";
      probe.detail = insertError?.message ?? "insert fără rând întors";
      return finish();
    }
    probe.steps.insert = "ok";
    const id = inserted.id as string;

    const { data: read, error: readError } = await supabase
      .from("leads")
      .select("id, source")
      .eq("id", id)
      .maybeSingle();
    probe.steps.read = !readError && read?.source === PROBE_LEAD.source ? "ok" : "failed";
    if (probe.steps.read === "failed") {
      probe.detail ??= readError?.message ?? "rândul de test nu s-a citit înapoi";
    }

    // `select("id")` după delete confirmă că s-a șters CHIAR un rând;
    // fără el, un delete care nu potrivește nimic e tot „fără eroare”.
    const { data: deleted, error: deleteError } = await supabase
      .from("leads")
      .delete()
      .eq("id", id)
      .select("id");
    probe.steps.delete = !deleteError && (deleted?.length ?? 0) === 1 ? "ok" : "failed";
    if (probe.steps.delete === "failed") {
      probe.leftoverId = id;
      probe.detail ??= deleteError?.message ?? "ștergerea nu a atins niciun rând";
    }

    const { count, error: countError } = await supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .neq("source", PROBE_LEAD.source);
    probe.steps.count = countError ? "failed" : "ok";
    probe.leadCount = countError ? null : (count ?? 0);
    if (countError) probe.detail ??= countError.message;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    probe.detail ??= message;
    // Primul pas neînceput e cel care a aruncat.
    for (const key of ["insert", "read", "delete", "count"] as const) {
      if (probe.steps[key] === "skipped") {
        probe.steps[key] = "failed";
        break;
      }
    }
  }

  return finish();
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
