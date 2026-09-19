import type { SupabaseClient } from "@supabase/supabase-js";
import { fromBytea } from "./bytea";
import { AD, decryptJson, VaultCryptoError } from "./crypto";
import { describeDbError } from "./members";

/**
 * Stratul de date al intrărilor (feat/vault, faza 3).
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
  const [clientsResult, entriesResult] = await Promise.all([
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
  ]);
  if (clientsResult.error) throw describeDbError(clientsResult.error);
  if (entriesResult.error) throw describeDbError(entriesResult.error);

  const t0 = performance.now();

  let unreadableClients = 0;
  const clients: VaultClient[] = (clientsResult.data ?? []).map((row) => {
    let name: string;
    try {
      name = parseClientPayload(
        decryptJson<unknown>(
          dek,
          { ciphertext: fromBytea(row.encrypted_name), nonce: fromBytea(row.nonce) },
          AD.client(row.id)
        )
      ).name;
    } catch {
      unreadableClients += 1;
      name = unreadableClientName(row.id);
    }
    return {
      id: row.id,
      name,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      updatedBy: row.updated_by,
    };
  });

  const entries: VaultEntry[] = (entriesResult.data ?? []).map((row) => {
    const meta: EntryMeta = {
      id: row.id,
      clientId: row.client_id,
      version: row.version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      updatedBy: row.updated_by,
    };
    try {
      const payload = parseEntryPayload(
        decryptJson<unknown>(
          dek,
          { ciphertext: fromBytea(row.encrypted_payload), nonce: fromBytea(row.nonce) },
          AD.entry(row.id)
        )
      );
      return { ...meta, status: "ok", payload };
    } catch (cause) {
      return {
        ...meta,
        status: "unreadable",
        reason:
          cause instanceof VaultCryptoError
            ? cause.message
            : "Rândul nu are formatul așteptat de la server.",
      };
    }
  });

  return {
    clients,
    entries,
    unreadableClients,
    decryptMs: performance.now() - t0,
    loadedAt: Date.now(),
  };
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
