import {
  ENTRY_SCHEMA_VERSION,
  parseEntryPayload,
  type EntryField,
  type EntryPayload,
  type VaultClient,
  type VaultEntry,
} from "./entries";
import { normalize } from "./search";

/**
 * Importul (feat/vault, fazele 5 și 11): CSV, JSON Bitwarden și fișierul
 * propriu de export. Pur: fără DOM, fără I/O, fără
 * criptare — primește text, întoarce intrări gata de criptat. Criptarea
 * și insertul sunt în `entries.ts`; UI-ul în `import-panel.tsx`.
 *
 * DE CE CSV și nu formatele native ale fiecărui manager: Chrome, Edge,
 * Bitwarden, 1Password, LastPass și KeePass exportă toate CSV, cu
 * antete diferite dar cu aceleași roluri (titlu, URL, utilizator,
 * parolă, notițe, folder). Detectăm rolurile după sinonime; omul poate
 * corecta din UI. Coloanele pe care nu le recunoaștem devin câmpuri cu
 * numele coloanei — nimic nu se pierde la import.
 *
 * FOLDERUL DEVINE CLIENT: un export din Bitwarden are „folder", LastPass
 * „grouping", KeePass „Group". Pentru agenție, asta e clientul.
 *
 * DUPLICATE: aceeași intrare (client + titlu + utilizator, normalizate)
 * există deja → se sare implicit. Un import rulat de două ori nu
 * dublează vault-ul.
 */

// ---------------------------------------------------------------------------
// CSV — RFC 4180: ghilimele, ghilimele duble în interior, rânduri noi în
// celule, CRLF sau LF, separator virgolă sau punct-și-virgulă (Excel RO).
// ---------------------------------------------------------------------------

export interface CsvTable {
  headers: string[];
  rows: string[][];
  delimiter: "," | ";" | "\t";
}

function detectDelimiter(firstLine: string): CsvTable["delimiter"] {
  const counts: Array<[CsvTable["delimiter"], number]> = [
    [",", (firstLine.match(/,/g) ?? []).length],
    [";", (firstLine.match(/;/g) ?? []).length],
    ["\t", (firstLine.match(/\t/g) ?? []).length],
  ];
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0][1] > 0 ? counts[0][0] : ",";
}

export function parseCsv(text: string): CsvTable {
  // U+FEFF: BOM-ul pe care îl pune Excel în fața primului antet.
  const source = text.replace(/^\uFEFF/, "");
  const firstLineEnd = source.search(/\r?\n/);
  const delimiter = detectDelimiter(firstLineEnd < 0 ? source : source.slice(0, firstLineEnd));

  const records: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  let i = 0;
  while (i < source.length) {
    const ch = source[i];
    if (quoted) {
      if (ch === '"') {
        if (source[i + 1] === '"') {
          cell += '"';
          i += 2;
          continue;
        }
        quoted = false;
        i += 1;
        continue;
      }
      cell += ch;
      i += 1;
      continue;
    }
    if (ch === '"') {
      quoted = true;
      i += 1;
      continue;
    }
    if (ch === delimiter) {
      row.push(cell);
      cell = "";
      i += 1;
      continue;
    }
    if (ch === "\r" || ch === "\n") {
      row.push(cell);
      cell = "";
      records.push(row);
      row = [];
      if (ch === "\r" && source[i + 1] === "\n") i += 1;
      i += 1;
      continue;
    }
    cell += ch;
    i += 1;
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    records.push(row);
  }

  // Rândurile complet goale (de regulă ultimul) nu sunt date.
  const nonEmpty = records.filter((r) => r.some((c) => c.trim() !== ""));
  if (nonEmpty.length === 0) return { headers: [], rows: [], delimiter };
  const [headers, ...rows] = nonEmpty;
  return {
    headers: headers.map((h) => h.trim()),
    rows: rows.map((r) => {
      const padded = r.slice(0, headers.length);
      while (padded.length < headers.length) padded.push("");
      return padded;
    }),
    delimiter,
  };
}

// ---------------------------------------------------------------------------
// Roluri de coloane
// ---------------------------------------------------------------------------

export type ColumnRole = "title" | "url" | "username" | "password" | "notes" | "group" | "totp";

export const ROLES: readonly ColumnRole[] = ["title", "url", "username", "password", "notes", "group", "totp"];

export const ROLE_LABEL: Record<ColumnRole, string> = {
  title: "Titlu",
  url: "URL",
  username: "Utilizator",
  password: "Parolă",
  notes: "Notițe",
  group: "Client (folder)",
  totp: "TOTP",
};

/** Sinonime, normalizate (fără diacritice, litere mici). Ordinea din
    listă e ordinea de preferință când mai multe coloane se potrivesc. */
const SYNONYMS: Record<ColumnRole, string[]> = {
  title: ["name", "title", "titlu", "nume", "account", "account name", "site", "item"],
  url: ["url", "login_uri", "login uri", "uri", "website", "web site", "link", "hostname", "adresa"],
  username: ["username", "login_username", "user name", "user", "utilizator", "login", "email", "e-mail"],
  password: ["password", "login_password", "parola", "pass", "passwd", "secret"],
  notes: ["notes", "note", "notite", "extra", "comment", "comments", "observatii", "description"],
  group: ["folder", "grouping", "group", "collection", "collections", "category", "client", "vault", "tags"],
  totp: ["login_totp", "totp", "otpauth", "otp", "2fa"],
};

/** Coloane administrative din exporturi — nu devin câmpuri. */
const NOISE = new Set(["favorite", "fav", "reprompt", "type", "archived", "id", "modified", "created", "last_used", "last_modified", "fields"]);

export type ColumnMapping = Partial<Record<ColumnRole, number>>;

export function detectColumns(headers: string[]): ColumnMapping {
  const normalized = headers.map((h) => normalize(h).replace(/[_-]+/g, " "));
  const mapping: ColumnMapping = {};
  const taken = new Set<number>();
  for (const role of ROLES) {
    for (const synonym of SYNONYMS[role]) {
      const key = synonym.replace(/[_-]+/g, " ");
      const index = normalized.findIndex((h, i) => !taken.has(i) && h === key);
      if (index >= 0) {
        mapping[role] = index;
        taken.add(index);
        break;
      }
    }
  }
  return mapping;
}

// ---------------------------------------------------------------------------
// Rânduri → intrări
// ---------------------------------------------------------------------------

export interface ImportItem {
  /** Numărul rândului în fișier (1 = primul rând de date). */
  row: number;
  payload: EntryPayload;
  /** Numele grupului din fișier, dacă mapping-ul are `group`. */
  group: string | null;
  /** `true` = există deja o intrare cu același client, titlu, utilizator. */
  duplicate: boolean;
  /** Rând fără nimic de importat (fără titlu ȘI fără date). */
  empty: boolean;
}

export interface ImportPlan {
  items: ImportItem[];
  importable: number;
  duplicates: number;
  empty: number;
  /** Grupuri distincte din fișier, în ordinea apariției. */
  groups: string[];
}

function usernameOf(payload: EntryPayload): string {
  const field = payload.fields.find((f) => !f.secret && /utilizator|user|email/i.test(f.label));
  return field ? field.value : "";
}

/** Cheia de duplicat: client + titlu + utilizator, normalizate. */
export function duplicateKey(clientName: string, title: string, username: string): string {
  return `${normalize(clientName)}\u0000${normalize(title)}\u0000${normalize(username)}`;
}

/**
 * Din tabel + mapping → intrări, cu duplicatele marcate față de ce
 * există deja (`existing`, decriptat) și de rândurile de dinainte din
 * același fișier. `clientFor(group)` spune în ce client ajunge fiecare
 * rând — UI-ul decide (un singur client, sau clientul din coloană).
 */
export function planImport(
  table: CsvTable,
  mapping: ColumnMapping,
  existing: { entries: VaultEntry[]; clients: VaultClient[] },
  clientNameFor: (group: string | null) => string
): ImportPlan {
  const roleByIndex = new Map<number, ColumnRole>();
  for (const role of ROLES) {
    const index = mapping[role];
    if (index !== undefined) roleByIndex.set(index, role);
  }

  const raw: RawItem[] = table.rows.map((cells, rowIndex) => {
    const at = (role: ColumnRole) => {
      const index = mapping[role];
      return index === undefined ? "" : (cells[index] ?? "").trim();
    };
    const group = mapping.group !== undefined ? at("group") || null : null;

    const url = at("url");
    const username = at("username");
    const password = at("password");
    const totp = at("totp");
    const notes = at("notes");

    const fields: EntryField[] = [];
    if (url) fields.push({ label: "URL", value: url, secret: false, kind: "url" });
    if (username) fields.push({ label: "Utilizator", value: username, secret: false, kind: "text" });
    if (password) fields.push({ label: "Parolă", value: password, secret: true, kind: "text" });
    if (totp) fields.push({ label: "Cod 2FA", value: totp, secret: true, kind: "totp" });
    // Coloanele nerecunoscute, cu valoare, devin câmpuri — cu numele coloanei.
    cells.forEach((value, index) => {
      if (roleByIndex.has(index)) return;
      const header = table.headers[index] ?? "";
      if (!header || NOISE.has(normalize(header)) || !value.trim()) return;
      fields.push({ label: header, value: value.trim(), secret: false, kind: "text" });
    });

    let title = at("title");
    if (!title && url) title = url.replace(/^https?:\/\//i, "").replace(/\/.*$/, "");
    if (!title && username) title = username;

    const hasData = fields.length > 0 || notes.length > 0;
    const payload: EntryPayload = {
      v: ENTRY_SCHEMA_VERSION,
      kind: password || url || username ? "login" : "note",
      title: title || "Fără titlu",
      fields,
      tags: [],
      notes,
    };

    return { row: rowIndex + 1, payload, group, hasData };
  });

  return finishPlan(raw, existing, clientNameFor);
}

/** O intrare candidată, înainte de marcarea duplicatelor. */
export interface RawItem {
  row: number;
  payload: EntryPayload;
  group: string | null;
  hasData: boolean;
}

/**
 * Din intrări candidate (din orice sursă) → planul: duplicatele marcate
 * față de vault ȘI față de rândurile de dinainte, grupurile în ordinea
 * apariției. `clientNameFor(group)` spune în ce client ajunge fiecare —
 * UI-ul decide (un singur client sau clientul din sursă).
 */
export function finishPlan(
  raw: RawItem[],
  existing: { entries: VaultEntry[]; clients: VaultClient[] },
  clientNameFor: (group: string | null) => string
): ImportPlan {
  const clientsById = new Map(existing.clients.map((c) => [c.id, c]));
  const seen = new Set<string>();
  for (const entry of existing.entries) {
    if (entry.status !== "ok") continue;
    const client = clientsById.get(entry.clientId);
    seen.add(duplicateKey(client?.name ?? "", entry.payload.title, usernameOf(entry.payload)));
  }
  const groups: string[] = [];
  const items: ImportItem[] = raw.map((item) => {
    if (item.group && !groups.includes(item.group)) groups.push(item.group);
    const key = duplicateKey(clientNameFor(item.group), item.payload.title, usernameOf(item.payload));
    const duplicate = item.hasData && seen.has(key);
    if (item.hasData) seen.add(key);
    return { row: item.row, payload: item.payload, group: item.group, duplicate, empty: !item.hasData };
  });
  return {
    items,
    importable: items.filter((item) => !item.empty && !item.duplicate).length,
    duplicates: items.filter((item) => !item.empty && item.duplicate).length,
    empty: items.filter((item) => item.empty).length,
    groups,
  };
}

// ---------------------------------------------------------------------------
// Bitwarden — exportul JSON necriptat (faza 11)
// ---------------------------------------------------------------------------
// Aduce ce CSV-ul pierde: câmpurile personalizate (cu „hidden" = secret),
// mai multe URL-uri, cardurile și identitățile cu câmpurile lor. Exportul
// CRIPTAT al Bitwarden (`encrypted: true`) nu se poate citi — omul exportă
// varianta în clar și o șterge după import.

interface BitwardenJson {
  encrypted?: boolean;
  folders?: Array<{ id: string; name: string }>;
  collections?: Array<{ id: string; name: string }>;
  items?: BitwardenItem[];
}

interface BitwardenItem {
  type: number;
  name?: string;
  notes?: string | null;
  folderId?: string | null;
  collectionIds?: string[] | null;
  fields?: Array<{ name?: string | null; value?: string | null; type?: number }> | null;
  login?: {
    username?: string | null;
    password?: string | null;
    totp?: string | null;
    uris?: Array<{ uri?: string | null }> | null;
  } | null;
  card?: {
    cardholderName?: string | null;
    brand?: string | null;
    number?: string | null;
    expMonth?: string | null;
    expYear?: string | null;
    code?: string | null;
  } | null;
  identity?: Record<string, string | null | undefined> | null;
  secureNote?: unknown;
}

function isBitwardenJson(value: unknown): value is BitwardenJson {
  return (
    typeof value === "object" &&
    value !== null &&
    Array.isArray((value as BitwardenJson).items) &&
    (value as BitwardenJson).items!.every((item) => typeof item === "object" && item !== null && "type" in item)
  );
}

export type JsonSource =
  | { kind: "bitwarden"; items: RawItem[] }
  | { kind: "bitwarden-encrypted" }
  | { kind: "meridian-export"; file: unknown }
  | { kind: "unknown" };

/** Ce fel de JSON e: Bitwarden în clar, Bitwarden criptat (nu se poate),
    exportul nostru (cere parola de export), sau altceva. */
export function classifyJson(text: string): JsonSource {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { kind: "unknown" };
  }
  if (typeof parsed === "object" && parsed !== null && (parsed as { format?: unknown }).format === "meridian-vault-export") {
    return { kind: "meridian-export", file: parsed };
  }
  if (!isBitwardenJson(parsed)) return { kind: "unknown" };
  if (parsed.encrypted) return { kind: "bitwarden-encrypted" };
  return { kind: "bitwarden", items: bitwardenItems(parsed) };
}

const IDENTITY_LABELS: Record<string, string> = {
  title: "Titlu",
  firstName: "Prenume",
  middleName: "Al doilea prenume",
  lastName: "Nume",
  company: "Companie",
  email: "Email",
  phone: "Telefon",
  username: "Utilizator",
  address1: "Adresă",
  address2: "Adresă 2",
  address3: "Adresă 3",
  city: "Oraș",
  state: "Județ",
  postalCode: "Cod poștal",
  country: "Țară",
  ssn: "CNP",
  passportNumber: "Pașaport",
  licenseNumber: "Permis",
};

function bitwardenItems(json: BitwardenJson): RawItem[] {
  const folderName = new Map<string, string>();
  for (const folder of json.folders ?? []) folderName.set(folder.id, folder.name);
  for (const collection of json.collections ?? []) folderName.set(collection.id, collection.name);

  return (json.items ?? []).map((item, index) => {
    const fields: EntryField[] = [];
    const push = (label: string, value: string | null | undefined, secret = false, kind: EntryField["kind"] = "text") => {
      if (value && value.trim()) fields.push({ label, value: value.trim(), secret, kind });
    };
    let kind: EntryPayload["kind"] = "other";

    if (item.type === 1 && item.login) {
      kind = "login";
      const uris = (item.login.uris ?? []).map((u) => u.uri).filter((u): u is string => Boolean(u && u.trim()));
      uris.forEach((uri, i) => push(i === 0 ? "URL" : `URL ${i + 1}`, uri, false, "url"));
      push("Utilizator", item.login.username);
      push("Parolă", item.login.password, true);
      push("Cod 2FA", item.login.totp, true, "totp");
    } else if (item.type === 2) {
      kind = "note";
    } else if (item.type === 3 && item.card) {
      kind = "card";
      push("Titular", item.card.cardholderName);
      push("Brand", item.card.brand);
      push("Număr", item.card.number, true);
      const exp = [item.card.expMonth, item.card.expYear].filter(Boolean).join("/");
      push("Expiră", exp);
      push("CVV", item.card.code, true);
    } else if (item.type === 4 && item.identity) {
      kind = "other";
      for (const [key, label] of Object.entries(IDENTITY_LABELS)) {
        push(label, item.identity[key], key === "ssn" || key === "passportNumber" || key === "licenseNumber");
      }
    }

    for (const field of item.fields ?? []) {
      if (!field || field.type === 3) continue; // linked: doar o referință
      const label = (field.name ?? "").trim() || "Câmp";
      const value = field.type === 2 ? (field.value === "true" ? "da" : "nu") : (field.value ?? "");
      push(label, value, field.type === 1);
    }

    const groupId = item.folderId ?? item.collectionIds?.[0] ?? null;
    const group = groupId ? (folderName.get(groupId) ?? null) : null;
    const notes = (item.notes ?? "").trim();
    const title = (item.name ?? "").trim() || fields.find((f) => f.label === "URL")?.value || "Fără titlu";
    const hasData = fields.length > 0 || notes.length > 0;
    return {
      row: index + 1,
      group,
      hasData,
      payload: { v: ENTRY_SCHEMA_VERSION, kind, title, fields, tags: [], notes },
    };
  });
}

/** Exportul propriu, deja decriptat (`export.ts`), ca intrări candidate. */
export function itemsFromExport(plain: {
  clients: Array<{ id: string; name: string }>;
  entries: Array<{ clientId: string; payload: EntryPayload }>;
}): RawItem[] {
  const names = new Map(plain.clients.map((client) => [client.id, client.name]));
  return plain.entries.map((entry, index) => {
    // Fișierul e al nostru, dar tot se validează: forma contractului, nu încrederea.
    let payload: EntryPayload | null = null;
    try {
      payload = parseEntryPayload(entry.payload);
    } catch {
      payload = null;
    }
    return {
      row: index + 1,
      group: names.get(entry.clientId) ?? null,
      hasData: payload !== null,
      payload: payload ?? { v: ENTRY_SCHEMA_VERSION, kind: "other", title: "Intrare nevalidă", fields: [], tags: [], notes: "" },
    };
  });
}
