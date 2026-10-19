import type { MatchType } from "../search/limits";

/**
 * Ce ajunge în browser din citirile pe un cont Google existent
 * (`/admin/ads/cont`). Izomorf, doar tipuri.
 */

export interface AccountCampaign {
  id: string;
  name: string;
  /** ENABLED, PAUSED, REMOVED — cum le dă Google. */
  status: string;
  /** SEARCH, DISPLAY, PERFORMANCE_MAX… */
  type: string;
  bidding: string | null;
  startDate: string | null;
  primaryStatus: string | null;
  /** Bugetul zilnic, în moneda contului. */
  budget: number | null;
  cost30: number;
  clicks30: number;
  conversions30: number;
  costAll: number;
  clicksAll: number;
  conversionsAll: number;
  /** Rândul din portal, dacă a fost creată din portal. */
  portalRecordId: string | null;
}

export interface AccountHeader {
  id: string;
  name: string;
  currency: string;
  state: string;
  usable: boolean;
  /** Contul manager prin care îl vede cheia; null = direct. */
  manager: string | null;
}

export interface NegativeListInfo {
  id: string;
  resourceName: string;
  name: string;
  /** Câte cuvinte are (din `member_count`). */
  count: number;
  /** Campaniile de care e legată (id-uri). */
  campaigns: string[];
}

export interface ParsedKeyword {
  line: number;
  raw: string;
  text: string | null;
  match: MatchType | null;
  /** Ce e greșit pe rând (caractere nepermise, prea lung) — null = bun. */
  problem: string | null;
}

export interface NegativesPreview {
  ok: boolean;
  fingerprint: string;
  /** Cuvintele citite din listă, cu problemele pe rând. */
  keywords: ParsedKeyword[];
  /** Ce se adaugă efectiv, pe destinație. */
  additions: Array<{ where: string; keywords: string[]; skipped: string[] }>;
  /** Cuvinte pozitive existente pe care noile negative le-ar bloca. */
  conflicts: Array<{ campaign: string; keyword: string; negative: string; group: string | null }>;
  operations: number;
  errors: string[];
  warnings: string[];
}

export type NegativesResponse = { ok: true; preview: NegativesPreview } | { ok: false; message: string };

export interface AuditChange {
  at: string;
  user: string | null;
  client: string;
  resource: string;
  operation: string;
  campaign: string | null;
  fields: string | null;
}

export interface AuditUser {
  email: string;
  role: string;
  since: string | null;
  inviter: string | null;
  pending: boolean;
}

export interface AuditConversion {
  id: string;
  name: string;
  type: string;
  category: string;
  status: string;
  primary: boolean;
  conversions30: number;
}

export interface AuditBilling {
  setups: Array<{ id: string; status: string; account: string | null; profile: string | null; start: string | null; end: string | null }>;
  budgets: Array<{ status: string; limit: string; start: string | null; end: string | null; served: number | null }>;
}

/** Fiecare bloc al auditului se citește separat: unul care nu merge nu le oprește pe celelalte. */
export type AuditBlock<T> = { ok: true; data: T } | { ok: false; message: string };

export interface AuditSignal {
  tone: "error" | "warning";
  message: string;
}

export interface AccountAudit {
  changes: AuditBlock<{ items: AuditChange[]; from: string; to: string; truncated: boolean }>;
  users: AuditBlock<AuditUser[]>;
  billing: AuditBlock<AuditBilling>;
  conversions: AuditBlock<AuditConversion[]>;
  signals: AuditSignal[];
}

export type PauseResponse =
  | { ok: true; paused: Array<{ id: string; name: string }>; skipped: Array<{ id: string; name: string; why: string }>; journalWarning: string | null }
  | { ok: false; message: string };
