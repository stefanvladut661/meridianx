/**
 * Statusul de livrare citit din Meta (`effective_status`), spus în română.
 *
 * Doar AFIȘARE: portalul nu trimite niciodată alt status decât pauza. Cheile
 * sunt statusurile Meta cu litere mici; ce nu e aici se arată ca atare.
 */
const LABEL: Record<string, string> = {
  paused: "Oprită",
  active: "Pornită",
  in_process: "Se procesează",
  with_issues: "Cu probleme",
  archived: "Arhivată",
  deleted: "Ștearsă",
};

export function campaignStatusLabel(status: string): string {
  const key = status.toLowerCase();
  return LABEL[key] ?? key.replace(/_/g, " ");
}
