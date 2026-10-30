import type { LeadSourceGroup } from "@/lib/supabase/types";

/**
 * Adresele ecranului de lead-uri. Contractul de URL e cel vechi și nu se
 * schimbă: `/admin?q=&division=&status=&from=&to=&page=` pentru listă și
 * `&lead=<id>` pentru fișa deschisă (emailurile de notificare trimit
 * `/admin?lead=<id>`).
 */

export const FILTER_KEYS = ["q", "division", "status", "from", "to"] as const;
export type FilterKey = (typeof FILTER_KEYS)[number];

export type LeadFilterValues = Record<FilterKey, string>;

/** Lista cu filtrele date (`filterSearch`, fără pagină și fără lead), opțional cu pagină și cu un lead deschis. */
export function leadsHref(filterSearch: string, { page, lead }: { page?: number; lead?: string } = {}): string {
  const params = new URLSearchParams(filterSearch);
  if (page && page > 1) params.set("page", String(page));
  if (lead) params.set("lead", lead);
  const query = params.toString();
  return query ? `/admin?${query}` : "/admin";
}

/** „1 lead”, „5 lead-uri”, „25 de lead-uri”: româna cere „de” de la 20 în sus. */
export function leadCount(n: number): string {
  if (n === 1) return "1 lead";
  const rest = n % 100;
  const de = n > 0 && (rest === 0 || rest >= 20) ? " de" : "";
  return `${new Intl.NumberFormat("ro-RO").format(n)}${de} lead-uri`;
}

export interface LeadDetailNeighbors {
  /** Poziția în lista filtrată (de la 1), `null` când lead-ul nu e în filtrul curent. */
  position: number | null;
  total: number;
  prevHref: string | null;
  nextHref: string | null;
}

/** „Surse” din zona de statistici: primele grupe, restul adunat într-o singură linie. */
export interface LeadSourcesSummary {
  total: number;
  top: LeadSourceGroup[];
  othersGroups: number;
  othersCount: number;
  truncated: boolean;
}
