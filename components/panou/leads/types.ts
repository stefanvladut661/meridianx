import type { Lead, LeadEvent, LeadStats } from "@/lib/supabase/types";
import type { LeadDetailNeighbors, LeadFilterValues, LeadSourcesSummary } from "./urls";

/** Fișa lead-ului deschis, așa cum o pregătește pagina de server. */
export type LeadDetailData =
  | { state: "ok"; lead: Lead; events: LeadEvent[]; neighbors: LeadDetailNeighbors }
  | { state: "missing" }
  | { state: "error" };

export interface LeadsWorkspaceProps {
  /** Momentul randării pe server: „acum 3 min” se calculează la fel pe server și la hidratare. */
  now: number;
  items: Lead[];
  /** Câte lead-uri are filtrul curent (nu doar pagina). */
  total: number;
  page: number;
  perPage: number;
  /** Citirea listei a eșuat: se desenează starea de eroare, nu lista goală. */
  listFailed: boolean;
  /** `null` când indicatorii n-au putut fi citiți. */
  stats: LeadStats | null;
  sources: LeadSourcesSummary | null;
  filters: LeadFilterValues;
  hasFilters: boolean;
  /** Filtrele ca șir de interogare, fără pagină și fără lead. */
  filterSearch: string;
  exportHref: string;
  openLeadId: string | null;
  detail: LeadDetailData | null;
}
