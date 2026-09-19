import { KIND_LABEL, type VaultClient, type VaultEntry } from "./entries";

/**
 * Căutarea în vault (feat/vault, faza 3). Pură, fără DOM, fără I/O.
 *
 * Rulează în memorie peste rândurile deja decriptate — serverul nu poate
 * căuta în ce nu poate citi. Regulile, în ordinea în care contează:
 *
 * 1. SECRETELE NU SE CAUTĂ. Un câmp `secret: true` nu intră în index:
 *    „caută după parolă" ar fi un canal prin care o parolă se ghicește
 *    literă cu literă din numărul de rezultate.
 * 2. Fără diacritice și fără majuscule: „Băcănia" și „bacania" sunt
 *    același client.
 * 3. Tokenii se leagă cu ȘI: fiecare cuvânt tastat trebuie să apară
 *    undeva în intrare (titlu, client, tip, etichete, câmpuri nesecrete,
 *    notițe). `#eticheta` restrânge tokenul la etichete.
 * 4. Rezultatele rămân GRUPATE PE CLIENT, ca lista fără căutare — omul
 *    caută „parolele de la X", nu „cel mai relevant rând din tot vault-ul".
 *    Înăuntrul grupului, potrivirea pe titlu urcă rândul.
 */

// ---------------------------------------------------------------------------
// Normalizare
// ---------------------------------------------------------------------------

/** Litere mici, fără diacritice (NFD + eliminarea semnelor combinate),
    spații comprimate. Aceeași funcție pentru index și pentru interogare. */
export function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

interface Token {
  text: string;
  /** `#x` — se potrivește doar cu etichetele. */
  tagOnly: boolean;
}

export function tokenize(query: string): Token[] {
  return normalize(query)
    .split(" ")
    .filter(Boolean)
    .map((raw) => {
      if (raw.startsWith("#") && raw.length > 1) return { text: raw.slice(1), tagOnly: true };
      return { text: raw, tagOnly: false };
    })
    .filter((token) => token.text.length > 0);
}

// ---------------------------------------------------------------------------
// Index — construit o dată per snapshot, nu la fiecare tastă
// ---------------------------------------------------------------------------

interface IndexedEntry {
  entry: VaultEntry;
  title: string;
  client: string;
  tags: string[];
  /** Tip, câmpuri nesecrete, notițe — restul haystack-ului. */
  rest: string;
}

export interface SearchIndex {
  clientsById: Map<string, VaultClient>;
  items: IndexedEntry[];
}

export function buildIndex(entries: VaultEntry[], clients: VaultClient[]): SearchIndex {
  const clientsById = new Map(clients.map((client) => [client.id, client]));
  const items: IndexedEntry[] = entries.map((entry) => {
    const client = clientsById.get(entry.clientId);
    const clientName = normalize(client?.name ?? "");
    if (entry.status !== "ok") {
      // Un rând ilizibil se găsește doar după client — n-are alt conținut.
      return { entry, title: "", client: clientName, tags: [], rest: "" };
    }
    const { payload } = entry;
    const rest = [
      KIND_LABEL[payload.kind],
      ...payload.fields.filter((field) => !field.secret).map((field) => `${field.label} ${field.value}`),
      payload.notes,
    ]
      .map(normalize)
      .join(" ");
    return {
      entry,
      title: normalize(payload.title),
      client: clientName,
      tags: payload.tags.map(normalize),
      rest,
    };
  });
  return { clientsById, items };
}

// ---------------------------------------------------------------------------
// Căutare
// ---------------------------------------------------------------------------

export interface SearchGroup {
  client: VaultClient | null;
  clientId: string;
  entries: VaultEntry[];
}

export interface SearchResult {
  groups: SearchGroup[];
  /** Câte intrări au trecut de filtru. */
  total: number;
}

/** Cât de bine se potrivește un token cu o intrare: 0 = deloc. Titlul
    contează mai mult decât restul, prefixul mai mult decât mijlocul. */
function scoreToken(item: IndexedEntry, token: Token): number {
  if (token.tagOnly) return item.tags.some((tag) => tag.includes(token.text)) ? 2 : 0;
  if (item.title.startsWith(token.text)) return 4;
  if (item.title.includes(token.text)) return 3;
  if (item.client.includes(token.text)) return 2;
  if (item.tags.some((tag) => tag === token.text || tag.includes(token.text))) return 2;
  if (item.rest.includes(token.text)) return 1;
  return 0;
}

function compareByTitle(a: VaultEntry, b: VaultEntry): number {
  const ta = a.status === "ok" ? a.payload.title : "";
  const tb = b.status === "ok" ? b.payload.title : "";
  return ta.localeCompare(tb, "ro");
}

function compareGroups(a: SearchGroup, b: SearchGroup): number {
  // Clienții necunoscuți (rând fără client vizibil) la coadă.
  if (!a.client && b.client) return 1;
  if (a.client && !b.client) return -1;
  return (a.client?.name ?? a.clientId).localeCompare(b.client?.name ?? b.clientId, "ro");
}

export function search(index: SearchIndex, query: string): SearchResult {
  const tokens = tokenize(query);
  const scored = new Map<string, { group: SearchGroup; scores: Map<string, number> }>();
  let total = 0;

  for (const item of index.items) {
    let score = 0;
    if (tokens.length > 0) {
      let all = true;
      for (const token of tokens) {
        const s = scoreToken(item, token);
        if (s === 0) {
          all = false;
          break;
        }
        score += s;
      }
      if (!all) continue;
    }

    const clientId = item.entry.clientId;
    let bucket = scored.get(clientId);
    if (!bucket) {
      bucket = {
        group: { client: index.clientsById.get(clientId) ?? null, clientId, entries: [] },
        scores: new Map(),
      };
      scored.set(clientId, bucket);
    }
    bucket.group.entries.push(item.entry);
    bucket.scores.set(item.entry.id, score);
    total += 1;
  }

  const groups = Array.from(scored.values()).map(({ group, scores }) => {
    group.entries.sort((a, b) => {
      const diff = (scores.get(b.id) ?? 0) - (scores.get(a.id) ?? 0);
      return diff !== 0 ? diff : compareByTitle(a, b);
    });
    return group;
  });
  groups.sort(compareGroups);

  return { groups, total };
}
