import { PAUSED } from "@/lib/ads/meta/paused";

/**
 * Statusul de livrare citit din platformă, spus în română.
 *
 * Doar AFIȘARE: portalul nu trimite niciodată alt status decât pauza. Cheile
 * sunt statusurile platformelor cu litere mici: Meta (`effective_status`) și
 * TikTok (`operation_status` / `secondary_status`, fără prefixul
 * `campaign_status_`). Ce nu e aici se arată ca atare.
 */
const LABEL: Record<string, string> = {
  paused: "Oprită",
  disable: "Oprită",
  active: "Pornită",
  enable: "Pornită",
  delivery_ok: "Pornită",
  in_process: "Se procesează",
  with_issues: "Cu probleme",
  archived: "Arhivată",
  deleted: "Ștearsă",
  delete: "Ștearsă",
  budget_exceed: "Buget epuizat",
};

function key(status: string): string {
  return status.toLowerCase().replace(/^campaign_status_/, "");
}

export function campaignStatusLabel(status: string): string {
  return LABEL[key(status)] ?? key(status).replace(/_/g, " ");
}

/** Oprită, pe oricare platformă. */
export function isPausedStatus(status: string): boolean {
  return status === PAUSED || key(status) === "paused" || key(status) === "disable";
}
