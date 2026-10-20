import type { NormalizedStatus } from "./types";

/**
 * Starea unei campanii, a unui grup sau a unei reclame, cu același nume pe
 * toate platformele. Doar AFIȘARE: portalul nu trimite niciodată alt status
 * decât pauza.
 *
 * Primele patru sunt cele din promptul v2 (Activă, Pe pauză, În verificare,
 * Respinsă); celelalte apar doar când platforma chiar le spune. Starea brută
 * rămâne lângă ea, în panou.
 */

export const STATUS_LABEL: Record<NormalizedStatus, string> = {
  active: "Activă",
  paused: "Pe pauză",
  review: "În verificare",
  rejected: "Respinsă",
  removed: "Ștearsă",
  archived: "Arhivată",
  issues: "Cu probleme",
  scheduled: "Programată",
  ended: "Încheiată",
  other: "Necunoscută",
};

/** Ordinea la sortarea pe stare: întâi ce cheltuie, apoi ce așteaptă, apoi restul. */
export const STATUS_ORDER: Record<NormalizedStatus, number> = {
  active: 0,
  issues: 1,
  review: 2,
  rejected: 3,
  scheduled: 4,
  paused: 5,
  ended: 6,
  archived: 7,
  removed: 8,
  other: 9,
};

/** Ce se mai poate pune pe pauză: doar ce poate cheltui acum sau curând. */
export function canPause(status: NormalizedStatus): boolean {
  return status === "active" || status === "issues" || status === "review" || status === "scheduled";
}

// ---------------------------------------------------------------------------
// Google Ads (v26): `status` (ENABLED / PAUSED / REMOVED) + `primary_status`,
// iar la reclame și `policy_summary` (aprobarea și verificarea).
// ---------------------------------------------------------------------------

export function googleStatus(input: {
  status?: string | null;
  primaryStatus?: string | null;
  approval?: string | null;
  review?: string | null;
}): NormalizedStatus {
  const status = input.status ?? "";
  if (status === "REMOVED") return "removed";
  if (input.approval === "DISAPPROVED") return "rejected";
  if (status === "PAUSED") return "paused";
  if (input.review === "REVIEW_IN_PROGRESS" || input.review === "UNDER_APPEAL") return "review";
  switch (input.primaryStatus) {
    case "ELIGIBLE":
    case "LIMITED":
    case "LEARNING":
      return "active";
    case "PAUSED":
      return "paused";
    case "REMOVED":
      return "removed";
    case "ENDED":
      return "ended";
    case "PENDING":
      return "scheduled";
    case "MISCONFIGURED":
    case "NOT_ELIGIBLE":
      return "issues";
    default:
      return status === "ENABLED" ? "active" : "other";
  }
}

// ---------------------------------------------------------------------------
// Meta (Marketing API v26): `effective_status` pe campanie, set și reclamă.
// Cheile obiectului sunt valorile Meta — scrise ca chei, nu ca text: garda
// (`verify-paused.mjs`) caută statusul de pornire scris ca text în cod.
// ---------------------------------------------------------------------------

const META_STATUS: Record<string, NormalizedStatus> = {
  ACTIVE: "active",
  PAUSED: "paused",
  CAMPAIGN_PAUSED: "paused",
  ADSET_PAUSED: "paused",
  PENDING_REVIEW: "review",
  IN_PROCESS: "review",
  PREAPPROVED: "review",
  DISAPPROVED: "rejected",
  WITH_ISSUES: "issues",
  PENDING_BILLING_INFO: "issues",
  ARCHIVED: "archived",
  DELETED: "removed",
};

export function metaStatus(effective: string | null | undefined): NormalizedStatus {
  return (effective && META_STATUS[effective]) || "other";
}

/**
 * Filtrul de citire pentru listele contului: fără el, Meta întoarce doar ce nu
 * e arhivat sau șters. DELETED nu intră: obiectele șterse se citesc doar după id.
 */
export const META_LISTED_STATUSES = Object.keys(META_STATUS).filter((status) => status !== "DELETED");

/** Pe Meta, ce poate fi pus pe pauză acum: starea configurată e cea de pornire. */
export function metaRunning(configured: string | null | undefined): boolean {
  return Boolean(configured) && META_STATUS[configured as string] === "active";
}

// ---------------------------------------------------------------------------
// TikTok (API for Business v1.3): `secondary_status` (spune și de ce nu
// livrează), cu prefixul nivelului (`CAMPAIGN_STATUS_`, `ADGROUP_STATUS_`,
// `AD_STATUS_`); altfel `operation_status`. Valorile, din enumerarea v1.3 și
// SDK-ul oficial. Tot chei, nu text — vezi garda de mai sus.
// ---------------------------------------------------------------------------

const TIKTOK_STATUS: Record<string, NormalizedStatus> = {
  DELIVERY_OK: "active",
  ENABLE: "active",
  PARTIAL_AUDIT_DELIVERY_OK: "active",
  REVIEW_PARTIALLY_APPROVED: "active",
  DISABLE: "paused",
  CAMPAIGN_DISABLE: "paused",
  ADGROUP_DISABLE: "paused",
  AUDIT: "review",
  REAUDIT: "review",
  SHADOW_ADGROUP_REAUDIT: "review",
  ADVERTISER_AUDIT: "review",
  AD_PRE_ONLINE: "review",
  ADGROUP_PRE_ONLINE: "review",
  CREATE: "review",
  PROCESS_AUDIO: "review",
  AWAITING_RELEASE: "review",
  SEARCH_KEYWORDS_IN_REVIEW: "review",
  AUDIT_DENY: "rejected",
  ADGROUP_AUDIT_DENY: "rejected",
  ADVERTISER_AUDIT_DENY: "rejected",
  REVIEW_DISAPPROVED: "rejected",
  PARTIAL_AUDIT_NO_DELIVERY: "rejected",
  ADGROUP_PARTIAL_AUDIT_NO_DELIVERY: "rejected",
  PROMOTE_AD_NOT_APPROVED: "rejected",
  DELETE: "removed",
  CAMPAIGN_DELETE: "removed",
  ADGROUP_DELETE: "removed",
  NOT_START: "scheduled",
  LIVE_NOT_START: "scheduled",
  TIME_DONE: "ended",
  DONE: "ended",
  BUDGET_EXCEED: "issues",
  BALANCE_EXCEED: "issues",
  CAMPAIGN_EXCEED: "issues",
  FROZEN: "issues",
  PIXEL_UNBIND: "issues",
  TRANSCODING_FAIL: "issues",
  ASSET_AUTHORIZATION_LOST: "issues",
  ADGROUP_ASSET_AUTHORIZATION_LOST: "issues",
  MUSIC_AUTHORIZATION_MISSING: "issues",
  INDUSTRY_QUALIFICATION_MISSING: "issues",
  INDUSTRY_QUALIFICATION_EXPIRED: "issues",
  INDUSTRY_QUALIFICATION_DENY: "issues",
  ADGROUP_INDUSTRY_QUALIFICATION_MISSING: "issues",
  ADGROUP_INDUSTRY_QUALIFICATION_EXPIRED: "issues",
  ADGROUP_INDUSTRY_QUALIFICATION_DENY: "issues",
  ADVERTISER_CONTRACT_PENDING: "issues",
  ADVERTISER_ACCOUNT_PUNISH: "issues",
  ADVERTISER_ACCOUNT_INVALID: "issues",
};

export function tiktokStatus(secondary: string | null | undefined, operation: string | null | undefined): NormalizedStatus {
  const suffix = (secondary ?? "").replace(/^(CAMPAIGN|ADGROUP|AD)_STA?TUS_/, "");
  if (suffix && TIKTOK_STATUS[suffix]) return TIKTOK_STATUS[suffix];
  if (operation && TIKTOK_STATUS[operation]) return TIKTOK_STATUS[operation];
  return "other";
}

/** Pe TikTok, ce poate fi pus pe pauză acum: starea de operare nu e deja „oprit”. */
export function tiktokRunning(operation: string | null | undefined): boolean {
  return Boolean(operation) && TIKTOK_STATUS[operation as string] === "active";
}

/** „ENABLED · LIMITED”, „PAUSED”, „ENABLED · DISAPPROVED” — starea brută, pentru panou. */
export function googleStatusDetail(parts: Array<string | null | undefined>): string | null {
  const seen = parts.filter((part): part is string => Boolean(part) && part !== "UNSPECIFIED" && part !== "UNKNOWN");
  const unique = [...new Set(seen)];
  return unique.length ? unique.join(" · ") : null;
}
