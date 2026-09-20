import type { SupabaseClient } from "@supabase/supabase-js";
import { fromBytea, toBytea } from "./bytea";
import { AD, decryptJson, encryptJson, VaultCryptoError } from "./crypto";
import { describeDbError, VaultDataError } from "./members";

/**
 * Stratul de date al intrărilor (feat/vault, fazele 3–6).
 *
 * Singurul loc care vorbește cu `vault_clients` / `vault_entries`.
 * Primește un client Supabase cu sesiune și DEK-ul din memorie; întoarce
 * rânduri DECRIPTATE, tipizate. Serverul vede doar id-uri, timestamp-uri
 * și blob-uri — tot ce e aici în clar a fost deschis în browser.
 *
 * CONTRACTUL PAYLOAD-ULUI (schema `v: 1`) e definit AICI și e lege
 * pentru fazele 4–6: adăugarea, importul și istoricul scriu și citesc
 * exact această formă. O schimbare de formă cere `v: 2` și un cititor
 * care înțelege ambele — rândurile vechi rămân criptate cu forma veche.
 *
 * Un rând care nu se decriptează (cheie greșită, AD greșit, conținut
 * alterat, JSON în altă formă) NU prăbușește lista: devine o intrare
 * „ilizibilă", vizibilă ca atare. Integritatea e informație pentru om —
 * un rând alterat pe server trebuie văzut, nu ascuns.
 */

// ---------------------------------------------------------------------------
// Contract — ce stă criptat în `encrypted_payload` / `encrypted_name`
// ---------------------------------------------------------------------------

export const ENTRY_SCHEMA_VERSION = 1;

/** Ce fel de secret e. Decide câmpurile propuse la adăugare (faza 4) și
    eticheta mono din listă. Nu decide cum se criptează — totul e la fel. */
export type EntryKind = "login" | "server" | "api" | "database" | "card" | "note" | "other";

export const ENTRY_KINDS: readonly EntryKind[] = [
  "login",
  "server",
  "api",
  "database",
  "card",
  "note",
  "other",
];

export const KIND_LABEL: Record<EntryKind, string> = {
  login: "Autentificare",
  server: "Server",
  api: "Cheie API",
  database: "Bază de date",
  card: "Card",
  note: "Notiță",
  other: "Altceva",
};

/** Cum se randează un câmp. `secret` e separat: un URL poate fi secret
    (un webhook), o parolă e întotdeauna. */
export type FieldKind = "text" | "url" | "multiline";

export interface EntryField {
  label: string;
  value: string;
  /** Mascat în UI, ascuns automat după afișare, EXCLUS din căutare. */
  secret: boolean;
  kind: FieldKind;
}

export interface EntryPayload {
  v: typeof ENTRY_SCHEMA_VERSION;
  kind: EntryKind;
  title: string;
  fields: EntryField[];
  tags: string[];
  /** Text liber, în clar pentru om, căutabil. Nu pune parole aici. */
  notes: string;
}

export interface ClientPayload {
  v: typeof ENTRY_SCHEMA_VERSION;
  name: string;
}

// ---------------------------------------------------------------------------
// Ce iese din strat
// ---------------------------------------------------------------------------

export interface VaultClient {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  updatedBy: string | null;
}

interface EntryMeta {
  id: string;
  clientId: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  updatedBy: string | null;
}

export type VaultEntry =
  | (EntryMeta & { status: "ok"; payload: EntryPayload })
  /** Nu s-a putut decripta sau nu are forma așteptată. Fără payload. */
  | (EntryMeta & { status: "unreadable"; reason: string });

export interface VaultSnapshot {
  clients: VaultClient[];
  entries: VaultEntry[];
  /** Clienți al căror nume nu s-a putut decripta — apar cu id-ul. */
  unreadableClients: number;
  /** Cât a durat decriptarea tuturor rândurilor, în ms. Informație
      reală: tot ce vede omul a fost deschis local, în atâta timp. */
  decryptMs: number;
  loadedAt: number;
  /** Intrări șterse (soft) — câte sunt în coș (faza 6). */
  deletedCount: number;
}

// ---------------------------------------------------------------------------
// Validare — JSON-ul decriptat trebuie să aibă forma contractului
// ---------------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isKind(value: unknown): value is EntryKind {
  return typeof value === "string" && (ENTRY_KINDS as readonly string[]).includes(value);
}

function isFieldKind(value: unknown): value is FieldKind {
  return value === "text" || value === "url" || value === "multiline";
}

function parseField(value: unknown): EntryField | null {
  if (!isRecord(value)) return null;
  if (typeof value.label !== "string" || typeof value.value !== "string") return null;
  return {
    label: value.label,
    value: value.value,
    secret: value.secret === true,
    kind: isFieldKind(value.kind) ? value.kind : "text",
  };
}

/** Aruncă `VaultCryptoError("decrypt_failed")` dacă forma nu e cea din
    contract — pentru apelant e același lucru ca un decrypt eșuat. */
export function parseEntryPayload(value: unknown): EntryPayload {
  if (!isRecord(value) || value.v !== ENTRY_SCHEMA_VERSION) {
    throw new VaultCryptoError("decrypt_failed", "Intrarea are o versiune de schemă necunoscută.");
  }
  if (typeof value.title !== "string" || !Array.isArray(value.fields)) {
    throw new VaultCryptoError("decrypt_failed", "Intrarea nu are titlu sau câmpuri.");
  }
  const fields: EntryField[] = [];
  for (const raw of value.fields) {
    const field = parseField(raw);
    if (!field) throw new VaultCryptoError("decrypt_failed", "Un câmp al intrării are formă greșită.");
    fields.push(field);
  }
  const tags = Array.isArray(value.tags)
    ? value.tags.filter((tag): tag is string => typeof tag === "string" && tag.length > 0)
    : [];
  return {
    v: ENTRY_SCHEMA_VERSION,
    kind: isKind(value.kind) ? value.kind : "other",
    title: value.title,
    fields,
    tags,
    notes: typeof value.notes === "string" ? value.notes : "",
  };
}

export function parseClientPayload(value: unknown): ClientPayload {
  if (!isRecord(value) || value.v !== ENTRY_SCHEMA_VERSION || typeof value.name !== "string") {
    throw new VaultCryptoError("decrypt_failed", "Clientul nu are forma așteptată.");
  }
  return { v: ENTRY_SCHEMA_VERSION, name: value.name };
}

// ---------------------------------------------------------------------------
// Citire
// ---------------------------------------------------------------------------

interface ClientRow {
  id: string;
  encrypted_name: string;
  nonce: string;
  created_at: string;
  updated_at: string;
  updated_by: string | null;
}

interface EntryRow {
  id: string;
  client_id: string;
  encrypted_payload: string;
  nonce: string;
  version: number;
  created_at: string;
  updated_at: string;
  updated_by: string | null;
}

const CLIENT_COLUMNS = "id, encrypted_name, nonce, created_at, updated_at, updated_by";
const ENTRY_COLUMNS = "id, client_id, encrypted_payload, nonce, version, created_at, updated_at, updated_by";

/** Numele afișat pentru un client al cărui nume nu s-a putut decripta:
    id-ul scurt, ca omul să-l poată găsi în bază. */
export function unreadableClientName(id: string): string {
  return `Client ilizibil · ${id.slice(0, 8)}`;
}

/**
 * Tot vault-ul, decriptat local. Toate rândurile vii (fără `deleted_at`),
 * într-o singură trecere: un vault de agenție are sute de intrări, nu
 * milioane, iar XChaCha20 le deschide în milisecunde. Căutarea se face
 * apoi în memorie — serverul n-are ce indexa.
 *
 * Aruncă `VaultDataError` DOAR la erori de transport sau de drepturi;
 * un rând care nu se decriptează e întors ca `unreadable`.
 */
export async function loadVault(supabase: SupabaseClient, dek: Uint8Array): Promise<VaultSnapshot> {
  const [clientsResult, entriesResult, deletedResult] = await Promise.all([
    supabase
      .from("vault_clients")
      .select(CLIENT_COLUMNS)
      .is("deleted_at", null)
      .order("created_at", { ascending: true })
      .overrideTypes<ClientRow[], { merge: false }>(),
    supabase
      .from("vault_entries")
      .select(ENTRY_COLUMNS)
      .is("deleted_at", null)
      .order("created_at", { ascending: true })
      .overrideTypes<EntryRow[], { merge: false }>(),
    supabase
      .from("vault_entries")
      .select("id")
      .not("deleted_at", "is", null)
      .overrideTypes<Array<{ id: string }>, { merge: false }>(),
  ]);
  if (clientsResult.error) throw describeDbError(clientsResult.error);
  if (entriesResult.error) throw describeDbError(entriesResult.error);
  if (deletedResult.error) throw describeDbError(deletedResult.error);

  const t0 = performance.now();

  let unreadableClients = 0;
  const clients: VaultClient[] = (clientsResult.data ?? []).map((row) => {
    const client = decryptClientRow(dek, row);
    if (client.unreadable) unreadableClients += 1;
    return client;
  });
  const entries: VaultEntry[] = (entriesResult.data ?? []).map((row) => decryptEntryRow(dek, row));

  return {
    clients,
    entries,
    unreadableClients,
    decryptMs: performance.now() - t0,
    loadedAt: Date.now(),
    deletedCount: deletedResult.data?.length ?? 0,
  };
}

/** Un rând de client → nume în clar (sau numele de „ilizibil"). */
function decryptClientRow(dek: Uint8Array, row: ClientRow): VaultClient & { unreadable: boolean } {
  let name: string;
  let unreadable = false;
  try {
    name = parseClientPayload(
      decryptJson<unknown>(
        dek,
        { ciphertext: fromBytea(row.encrypted_name), nonce: fromBytea(row.nonce) },
        AD.client(row.id)
      )
    ).name;
  } catch {
    unreadable = true;
    name = unreadableClientName(row.id);
  }
  return {
    id: row.id,
    name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
    unreadable,
  };
}

/** Un rând de intrare → payload în clar, sau `unreadable` cu motivul.
    `entryId` separat de `row.id`: în istoric, rândul are id-ul lui, dar
    AD-ul e cel al intrării. */
function decryptPayload(
  dek: Uint8Array,
  entryId: string,
  encryptedPayload: string,
  nonce: string
): { status: "ok"; payload: EntryPayload } | { status: "unreadable"; reason: string } {
  try {
    const payload = parseEntryPayload(
      decryptJson<unknown>(
        dek,
        { ciphertext: fromBytea(encryptedPayload), nonce: fromBytea(nonce) },
        AD.entry(entryId)
      )
    );
    return { status: "ok", payload };
  } catch (cause) {
    return {
      status: "unreadable",
      reason:
        cause instanceof VaultCryptoError
          ? cause.message
          : "Rândul nu are formatul așteptat de la server.",
    };
  }
}

function decryptEntryRow(dek: Uint8Array, row: EntryRow): VaultEntry {
  const meta: EntryMeta = {
    id: row.id,
    clientId: row.client_id,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
  };
  return { ...meta, ...decryptPayload(dek, row.id, row.encrypted_payload, row.nonce) };
}

// ---------------------------------------------------------------------------
// Ajutoare de prezentare — pure, fără DOM
// ---------------------------------------------------------------------------

/** Rândul al doilea din listă: primul câmp NEsecret pe un singur rând
    (de regulă utilizatorul sau URL-ul). Secretele nu apar niciodată în
    listă, nici mascate — lista e scanată de la distanță. */
export function entrySummary(payload: EntryPayload): string | null {
  const field = payload.fields.find((f) => !f.secret && f.kind !== "multiline" && f.value.trim());
  return field ? field.value : null;
}

// ---------------------------------------------------------------------------
// Șabloane — ce câmpuri PROPUNE un tip la adăugare (faza 4)
// ---------------------------------------------------------------------------

/** Câmpurile cu care pornește o intrare nouă de un anumit tip. Sunt o
    propunere, nu o formă fixă: omul le poate șterge, redenumi sau
    completa cu altele (decizia 2 din faza 3). Ordinea e cea afișată. */
export function templateFields(kind: EntryKind): EntryField[] {
  const f = (label: string, secret = false, fieldKind: FieldKind = "text"): EntryField => ({
    label,
    value: "",
    secret,
    kind: fieldKind,
  });
  switch (kind) {
    case "login":
      return [f("URL", false, "url"), f("Utilizator"), f("Parolă", true)];
    case "server":
      return [f("Host"), f("Port"), f("Utilizator"), f("Parolă", true)];
    case "api":
      return [f("Cheie", true), f("Cont"), f("URL", false, "url")];
    case "database":
      return [f("Host"), f("Bază de date"), f("Utilizator"), f("Parolă", true)];
    case "card":
      return [f("Titular"), f("Număr", true), f("Expiră"), f("CVV", true)];
    case "note":
    case "other":
      return [];
  }
}

/** Etichete: tăiate, fără duplicate (după normalizarea la litere mici),
    fără `#` în față — se pune la afișare. */
export function normalizeTags(input: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of input.split(/[,\n]/)) {
    const tag = raw.trim().replace(/^#+/, "");
    if (!tag) continue;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(tag);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Scriere — id-ul se generează AICI, înainte de criptare
// ---------------------------------------------------------------------------
// Datele adiționale leagă ciphertextul de rândul lui (`vault_entries:<id>`),
// deci id-ul trebuie cunoscut înainte de insert: îl generează browserul
// (`crypto.randomUUID`) și îl trimite explicit. Postgres acceptă un id
// dat; `default gen_random_uuid()` rămâne pentru orice alt client.
//
// Concurența e optimistă: update-ul cere `version` = cea văzută de om;
// zero rânduri afectate = altcineva a salvat între timp → `conflict`.
// Triggerul copiază rândul vechi în istoric și crește versiunea singur.

export function newId(): string {
  return crypto.randomUUID();
}

function conflict(): VaultDataError {
  return new VaultDataError(
    "conflict",
    "Altcineva a modificat intrarea între timp. Reîncarcă, apoi aplică din nou ce ai schimbat."
  );
}

export async function createClient(
  supabase: SupabaseClient,
  dek: Uint8Array,
  name: string
): Promise<string> {
  const id = newId();
  const payload: ClientPayload = { v: ENTRY_SCHEMA_VERSION, name: name.trim() };
  const box = encryptJson(dek, payload, AD.client(id));
  const { error } = await supabase.from("vault_clients").insert({
    id,
    encrypted_name: toBytea(box.ciphertext),
    nonce: toBytea(box.nonce),
  });
  if (error) throw describeDbError(error);
  return id;
}

export async function renameClient(
  supabase: SupabaseClient,
  dek: Uint8Array,
  clientId: string,
  name: string
): Promise<void> {
  const payload: ClientPayload = { v: ENTRY_SCHEMA_VERSION, name: name.trim() };
  const box = encryptJson(dek, payload, AD.client(clientId));
  const { data, error } = await supabase
    .from("vault_clients")
    .update({ encrypted_name: toBytea(box.ciphertext), nonce: toBytea(box.nonce) })
    .eq("id", clientId)
    .is("deleted_at", null)
    .select("id");
  if (error) throw describeDbError(error);
  if (!data || data.length === 0) {
    throw new VaultDataError("not_found", "Clientul nu mai există. Reîncarcă lista.");
  }
}

/** Ștergere soft. Se cheamă DOAR când clientul nu mai are intrări vii
    (`deleteEntry` o face singură pentru ultima intrare). */
export async function deleteClient(supabase: SupabaseClient, clientId: string): Promise<void> {
  const { error } = await supabase
    .from("vault_clients")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", clientId)
    .is("deleted_at", null);
  if (error) throw describeDbError(error);
}

export async function createEntry(
  supabase: SupabaseClient,
  dek: Uint8Array,
  clientId: string,
  payload: EntryPayload
): Promise<string> {
  const id = newId();
  const box = encryptJson(dek, payload, AD.entry(id));
  const { error } = await supabase.from("vault_entries").insert({
    id,
    client_id: clientId,
    encrypted_payload: toBytea(box.ciphertext),
    nonce: toBytea(box.nonce),
  });
  if (error) throw describeDbError(error);
  return id;
}

/** Cât trimitem într-un singur POST la import. PostgREST acceptă liste
    mari, dar un lot mic ține progresul vizibil și eroarea localizată. */
export const IMPORT_BATCH = 50;

/**
 * Import (faza 5): multe intrări, în loturi. Fiecare are id și nonce
 * propriu, criptată individual — exact ca una creată de mână. Întoarce
 * câte au intrat; la eroare, aruncă după loturile deja salvate (apelantul
 * raportează „N din M", nu reia de la zero — rândurile salvate ar deveni
 * duplicate).
 */
export async function createEntries(
  supabase: SupabaseClient,
  dek: Uint8Array,
  items: Array<{ clientId: string; payload: EntryPayload }>,
  onProgress?: (done: number) => void
): Promise<number> {
  let done = 0;
  for (let start = 0; start < items.length; start += IMPORT_BATCH) {
    const batch = items.slice(start, start + IMPORT_BATCH).map(({ clientId, payload }) => {
      const id = newId();
      const box = encryptJson(dek, payload, AD.entry(id));
      return {
        id,
        client_id: clientId,
        encrypted_payload: toBytea(box.ciphertext),
        nonce: toBytea(box.nonce),
      };
    });
    const { error } = await supabase.from("vault_entries").insert(batch);
    if (error) throw describeDbError(error);
    done += batch.length;
    onProgress?.(done);
  }
  return done;
}

/**
 * Clienți după nume, pentru import: cei existenți se refolosesc (după
 * nume normalizat — „Băcănia Verde" și „bacania verde" sunt același
 * client), cei lipsă se creează. Întoarce numele → id.
 */
export async function ensureClients(
  supabase: SupabaseClient,
  dek: Uint8Array,
  names: string[],
  existing: VaultClient[]
): Promise<Map<string, string>> {
  const byKey = new Map(existing.map((client) => [clientKey(client.name), client.id]));
  const result = new Map<string, string>();
  for (const name of names) {
    const key = clientKey(name);
    let id = byKey.get(key);
    if (!id) {
      id = await createClient(supabase, dek, name);
      byKey.set(key, id);
    }
    result.set(name, id);
  }
  return result;
}

function clientKey(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export async function updateEntry(
  supabase: SupabaseClient,
  dek: Uint8Array,
  target: { id: string; version: number },
  clientId: string,
  payload: EntryPayload
): Promise<void> {
  const box = encryptJson(dek, payload, AD.entry(target.id));
  const { data, error } = await supabase
    .from("vault_entries")
    .update({
      client_id: clientId,
      encrypted_payload: toBytea(box.ciphertext),
      nonce: toBytea(box.nonce),
    })
    .eq("id", target.id)
    .eq("version", target.version)
    .is("deleted_at", null)
    .select("id");
  if (error) throw describeDbError(error);
  if (!data || data.length === 0) throw conflict();
}

/**
 * Ștergere soft, cu aceeași verificare de versiune — o intrare pe care
 * altcineva tocmai a rescris-o nu se șterge orbește. `lastOfClient`:
 * apelantul știe din snapshot dacă era ultima intrare vie a clientului;
 * atunci dispare și clientul, ca lista de clienți să nu adune goale.
 */
export async function deleteEntry(
  supabase: SupabaseClient,
  target: { id: string; version: number; clientId: string },
  lastOfClient: boolean
): Promise<void> {
  const { data, error } = await supabase
    .from("vault_entries")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", target.id)
    .eq("version", target.version)
    .is("deleted_at", null)
    .select("id");
  if (error) throw describeDbError(error);
  if (!data || data.length === 0) throw conflict();
  if (lastOfClient) await deleteClient(supabase, target.clientId);
}

// ---------------------------------------------------------------------------
// Istoric și coș (faza 6)
// ---------------------------------------------------------------------------
// Istoricul e scris DOAR de triggerul `vault_stamp_entry`: la fiecare
// schimbare de payload, rândul vechi ajunge în `vault_entry_versions`,
// în forma lui criptată de atunci. AD-ul e cel al intrării (`vault_entries:
// <id>`), deci aceeași cheie deschide și versiunile vechi. Restaurarea nu
// „dă înapoi" nimic: scrie payload-ul vechi ca versiune nouă — cea de acum
// intră la rândul ei în istoric. Nimic nu se pierde, niciodată.

export interface EntryVersion {
  id: string;
  version: number;
  createdAt: string;
  createdBy: string | null;
  content: { status: "ok"; payload: EntryPayload } | { status: "unreadable"; reason: string };
}

interface VersionRow {
  id: string;
  encrypted_payload: string;
  nonce: string;
  version: number;
  created_at: string;
  created_by: string | null;
}

/** Versiunile anterioare ale unei intrări, cea mai nouă prima. */
export async function listVersions(
  supabase: SupabaseClient,
  dek: Uint8Array,
  entryId: string
): Promise<EntryVersion[]> {
  const { data, error } = await supabase
    .from("vault_entry_versions")
    .select("id, encrypted_payload, nonce, version, created_at, created_by")
    .eq("entry_id", entryId)
    .order("version", { ascending: false })
    .overrideTypes<VersionRow[], { merge: false }>();
  if (error) throw describeDbError(error);
  return (data ?? []).map((row) => ({
    id: row.id,
    version: row.version,
    createdAt: row.created_at,
    createdBy: row.created_by,
    content: decryptPayload(dek, entryId, row.encrypted_payload, row.nonce),
  }));
}

/**
 * Restaurarea unei versiuni = un update obișnuit cu payload-ul vechi,
 * cu aceeași verificare de versiune curentă (nu suprascrie ce a salvat
 * altcineva între timp). Clientul rămâne cel de acum.
 */
export async function restoreVersion(
  supabase: SupabaseClient,
  dek: Uint8Array,
  target: { id: string; version: number; clientId: string },
  payload: EntryPayload
): Promise<void> {
  await updateEntry(supabase, dek, { id: target.id, version: target.version }, target.clientId, payload);
}

/** O intrare din coș: la fel ca una vie, plus când a fost ștearsă (de
    cine — `updatedBy`, pus de trigger la ștergere) și numele clientului,
    chiar dacă și el e șters. */
export interface DeletedEntry {
  entry: VaultEntry;
  deletedAt: string;
  clientName: string;
  clientDeleted: boolean;
}

/** Coșul: intrările cu `deleted_at`, cu numele clienților rezolvate din
    TOȚI clienții (și cei șterși odată cu ultima lor intrare). */
export async function loadDeleted(supabase: SupabaseClient, dek: Uint8Array): Promise<DeletedEntry[]> {
  const [clientsResult, entriesResult] = await Promise.all([
    supabase
      .from("vault_clients")
      .select(`${CLIENT_COLUMNS}, deleted_at`)
      .overrideTypes<Array<ClientRow & { deleted_at: string | null }>, { merge: false }>(),
    supabase
      .from("vault_entries")
      .select(`${ENTRY_COLUMNS}, deleted_at`)
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false })
      .overrideTypes<Array<EntryRow & { deleted_at: string }>, { merge: false }>(),
  ]);
  if (clientsResult.error) throw describeDbError(clientsResult.error);
  if (entriesResult.error) throw describeDbError(entriesResult.error);

  const clients = new Map(
    (clientsResult.data ?? []).map((row) => [row.id, { ...decryptClientRow(dek, row), deleted: row.deleted_at !== null }])
  );
  return (entriesResult.data ?? []).map((row) => {
    const client = clients.get(row.client_id);
    return {
      entry: decryptEntryRow(dek, row),
      deletedAt: row.deleted_at,
      clientName: client?.name ?? unreadableClientName(row.client_id),
      clientDeleted: client?.deleted ?? false,
    };
  });
}

/** Scoate intrarea din coș; dacă și clientul ei era șters (a plecat
    odată cu ultima intrare), revine și el. Fără versiune nouă — doar
    `deleted_at` se schimbă, iar triggerul nu versionează asta. */
export async function restoreEntry(
  supabase: SupabaseClient,
  target: { id: string; clientId: string }
): Promise<void> {
  const { data, error } = await supabase
    .from("vault_entries")
    .update({ deleted_at: null })
    .eq("id", target.id)
    .not("deleted_at", "is", null)
    .select("id");
  if (error) throw describeDbError(error);
  if (!data || data.length === 0) {
    throw new VaultDataError("not_found", "Intrarea nu mai e în coș — poate a restaurat-o altcineva. Reîncarcă.");
  }
  const client = await supabase
    .from("vault_clients")
    .update({ deleted_at: null })
    .eq("id", target.clientId)
    .not("deleted_at", "is", null);
  if (client.error) throw describeDbError(client.error);
}
