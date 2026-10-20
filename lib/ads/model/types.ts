import type { Platform } from "../constants";

/**
 * Modelul comun al portalului v2 (migrarea 12): aceleași trei niveluri pe toate
 * platformele. Meta: campanie → ad set → reclamă; Google și TikTok: campanie →
 * ad group → reclamă. Portalul le numește Campanie → Grup → Reclamă.
 *
 * Fișier izomorf, doar tipuri: ce citesc platformele (`*Snapshot`), ce stă în
 * bază și ce ajunge în browser. Niciun token, nimic brut din răspunsuri în
 * afara câmpurilor alese aici.
 */

export type Level = "campaign" | "group" | "ad";

export const LEVELS: readonly Level[] = ["campaign", "group", "ad"];

/** Starea, aceeași pe toate platformele. Starea brută rămâne în `statusDetail`. */
export type NormalizedStatus =
  | "active"
  | "paused"
  | "review"
  | "rejected"
  | "removed"
  | "archived"
  | "issues"
  | "scheduled"
  | "ended"
  | "other";

/** Felul unui rezultat — ce numără, spus omului („4 apeluri”, „1 lead”). */
export type ResultKind = "call" | "lead" | "form" | "purchase" | "other";

/**
 * O conversie din catalogul contului. `key` e unică pe platformă și are
 * prefixul ei: `g:` (Google), `m:` (Meta), `t:` (TikTok).
 */
export interface ConversionType {
  key: string;
  label: string;
  kind: ResultKind;
  /** Pe Google: intră în „conversii” (principală). Pe Meta și TikTok: tipul pe care optimizează contul. */
  primary: boolean;
}

/** Ce spune platforma despre contul însuși, la o citire. */
export interface AccountSnapshot {
  name: string;
  currency: string;
  timezone: string | null;
  conversions: ConversionType[];
  /** Contul are măcar o conversie configurată. Fără ea, rezultatele sunt „nemăsurat”. */
  measured: boolean;
}

/**
 * Setările unui rând, doar pentru citit în panou. Lista păstrează ordinea (un
 * obiect jsonb nu o păstrează): ["Licitare", "Maximizează clicurile"].
 */
export interface EntitySettings {
  facts: Array<[string, string]>;
  /** Textele reclamei: titluri, texte principale, descrieri. */
  texts?: string[];
  /** Adresa finală a reclamei. */
  url?: string | null;
  /** Miniatura materialului, când platforma o dă. */
  thumbnail?: string | null;
}

/** O campanie, un grup sau o reclamă, cum o citește platforma acum. */
export interface EntitySnapshot {
  level: Level;
  platformId: string;
  campaignId: string;
  /** Grupul reclamei; null la campanii și grupuri. */
  groupId: string | null;
  name: string;
  status: NormalizedStatus;
  statusDetail: string | null;
  dailyBudget: number | null;
  lifetimeBudget: number | null;
  kind: string | null;
  /** Cheia conversiei numărate implicit; null = nemăsurat. Doar la campanii. */
  defaultResult: string | null;
  settings: EntitySettings;
  createdAt: string | null;
}

/** Cifrele unei zile, pentru un rând din structură. */
export interface DailySnapshot {
  level: Level;
  platformId: string;
  date: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: Record<string, number>;
  extra: Record<string, number>;
}

export interface StructureSnapshot {
  account: AccountSnapshot;
  entities: EntitySnapshot[];
}

/** Ce poate citi fiecare platformă, sub același contract. */
export interface StructureReader {
  platform: Platform;
  readStructure(adAccount: string): Promise<StructureSnapshot>;
  /**
   * Cifrele pe zi între `since` și `until` (inclusiv), pe toate nivelurile.
   * `knownIds` = id-urile din structură (o zi a unei campanii șterse între timp
   * vine și ea, iar sincronizarea îi citește apoi rândul).
   */
  readDaily(adAccount: string, since: string, until: string): Promise<DailySnapshot[]>;
  /** Rândurile pe care structura curentă nu le mai are, dar cifrele le pomenesc. */
  readMissing?(adAccount: string, ids: Array<{ level: Level; platformId: string }>): Promise<EntitySnapshot[]>;
}

// ---------------------------------------------------------------------------
// Ce ajunge în browser
// ---------------------------------------------------------------------------

export interface ClientSummary {
  id: string;
  name: string;
  owner: "agentie" | "clienti";
  accounts: AccountSummary[];
}

export interface AccountSummary {
  id: string;
  clientId: string;
  platform: Platform;
  workspace: string;
  adAccount: string;
  name: string | null;
  currency: string | null;
  measured: boolean | null;
  conversions: ConversionType[];
  syncEnabled: boolean;
  lastSyncedAt: string | null;
  lastSyncStatus: "ok" | "partial" | "failed" | null;
  lastSyncError: string | null;
}

/** Sumele unei perioade, pe un rând. Conversiile rămân pe tipuri. */
export interface Figures {
  spend: number;
  impressions: number;
  clicks: number;
  conversions: Record<string, number>;
  extra: Record<string, number>;
}

export interface EntityRow {
  id: string;
  accountId: string;
  platform: Platform;
  level: Level;
  platformId: string;
  campaignId: string;
  groupId: string | null;
  name: string;
  status: NormalizedStatus;
  statusDetail: string | null;
  dailyBudget: number | null;
  lifetimeBudget: number | null;
  kind: string | null;
  currency: string | null;
  /** Doar la campanii: cheia aleasă de om sau implicitul; null = nemăsurat. */
  resultKey: string | null;
  resultChosen: boolean;
  settings: EntitySettings;
  portalCampaignId: string | null;
  createdAt: string | null;
  lastSeenAt: string;
}
