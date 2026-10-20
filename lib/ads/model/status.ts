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

/** „ENABLED · LIMITED”, „PAUSED”, „ENABLED · DISAPPROVED” — starea brută, pentru panou. */
export function googleStatusDetail(parts: Array<string | null | undefined>): string | null {
  const seen = parts.filter((part): part is string => Boolean(part) && part !== "UNSPECIFIED" && part !== "UNKNOWN");
  const unique = [...new Set(seen)];
  return unique.length ? unique.join(" · ") : null;
}
