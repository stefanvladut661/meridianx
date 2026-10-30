import type { Metadata } from "next";
import { DIVISIONS } from "@/lib/division";
import { LEAD_STATUSES, leadListQuerySchema } from "@/lib/validations/lead";
import { getLead, getLeadFacts, getLeadStats, listLeads } from "@/lib/supabase/leads";
import { isWriteConfigured } from "@/lib/supabase/clients";
import type { LeadFacts } from "@/lib/supabase/types";
import { DeletedNotice } from "@/components/panou/leads/deleted-notice";
import { LeadsSetupCard } from "@/components/panou/leads/setup-card";
import { LeadsWorkspace } from "@/components/panou/leads/leads-workspace";
import type { LeadDetailData } from "@/components/panou/leads/types";
import { FILTER_KEYS, leadsHref, type LeadDetailNeighbors, type LeadFilterValues, type LeadSourcesSummary } from "@/components/panou/leads/urls";

export const metadata: Metadata = {
  title: "Lead-uri — MERIDIAN Admin",
  robots: { index: false, follow: false },
};

/** Panoul citește mereu date proaspete — nu are sens să cacheze lead-uri. */
export const dynamic = "force-dynamic";

/**
 * /admin — lead-urile, în designul din redesign (listă + fișă).
 *
 * Toată starea (filtre, pagină, lead deschis) stă în URL: refresh-ul nu pierde filtrul, un link
 * către un lead se poate trimite pe chat (și așa îl trimit emailurile de notificare:
 * `/admin?lead=<id>`), Înapoi face ce te aștepți, iar exportul CSV scoate exact ce vezi.
 * Pagina doar citește și pregătește datele; ecranul însuși e `LeadsWorkspace`.
 */

const PER_PAGE = 25;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type SearchParams = Record<string, string | string[] | undefined>;

/** Șirurile goale trebuie scoase; o valoare e cea dintâi, fără spații. */
function cleanParams(params: SearchParams): Record<string, string> {
  const cleaned: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) {
    const single = Array.isArray(value) ? value[0] : value;
    if (typeof single === "string" && single.trim() !== "") {
      cleaned[key] = single.trim();
    }
  }
  return cleaned;
}

/** Doar filtrele valide: ce nu se poate aplica nu apare nici în controale, ca ecranul să nu mintă. */
function readFilters(cleaned: Record<string, string>): LeadFilterValues {
  return {
    q: (cleaned.q ?? "").slice(0, 120),
    division: DIVISIONS.find((division) => division === cleaned.division) ?? "",
    status: LEAD_STATUSES.find((status) => status === cleaned.status) ?? "",
    from: DATE_ONLY.test(cleaned.from ?? "") ? cleaned.from : "",
    to: DATE_ONLY.test(cleaned.to ?? "") ? cleaned.to : "",
  };
}

/** `<input type="date">` dă `2026-08-14`; schema cere ISO datetime. */
function isoRange(filters: LeadFilterValues): { from?: string; to?: string } {
  return {
    from: filters.from ? `${filters.from}T00:00:00.000Z` : undefined,
    to: filters.to ? `${filters.to}T23:59:59.999Z` : undefined,
  };
}

function summarizeSources(facts: LeadFacts): LeadSourcesSummary {
  const rest = facts.groups.slice(5);
  return {
    total: facts.ids.length,
    top: facts.groups.slice(0, 5),
    othersGroups: rest.length,
    othersCount: rest.reduce((sum, group) => sum + group.count, 0),
    truncated: facts.truncated,
  };
}

/** Poziția lead-ului în lista filtrată (nu doar în pagina curentă) și vecinii lui. */
function neighborsOf(leadId: string, facts: LeadFacts | null, total: number, filterSearch: string): LeadDetailNeighbors {
  const ids = facts?.ids ?? [];
  const index = ids.indexOf(leadId);
  if (index < 0) return { position: null, total, prevHref: null, nextHref: null };
  // „Anterior” și „Următorul” duc și pagina listei la locul lor, ca rândul deschis să rămână vizibil.
  const hrefAt = (target: number) => leadsHref(filterSearch, { page: Math.floor(target / PER_PAGE) + 1, lead: ids[target] });
  return {
    position: index + 1,
    total,
    prevHref: index > 0 ? hrefAt(index - 1) : null,
    nextHref: index < ids.length - 1 ? hrefAt(index + 1) : null,
  };
}

export default async function AdminDashboardPage({ searchParams }: Readonly<{ searchParams: Promise<SearchParams> }>) {
  const raw = await searchParams;
  const cleaned = cleanParams(raw);
  // `sters` e semnul lăsat de acțiunea de ștergere; nu e filtru și nu trebuie să supraviețuiască următoarei navigări.
  const justDeleted = cleaned.sters !== undefined;
  const openLeadRaw = cleaned.lead ?? null;

  if (!isWriteConfigured()) {
    return <LeadsSetupCard />;
  }

  const filters = readFilters(cleaned);
  const pageNumber = Number.parseInt(cleaned.page ?? "1", 10);
  const page = Number.isFinite(pageNumber) && pageNumber >= 1 ? pageNumber : 1;
  const range = isoRange(filters);

  const filterQuery = {
    q: filters.q || undefined,
    division: filters.division || undefined,
    status: filters.status || undefined,
    ...range,
  };
  const parsed = leadListQuerySchema.safeParse({ ...filterQuery, page, perPage: PER_PAGE });
  const query = parsed.success ? parsed.data : leadListQuerySchema.parse({ page: 1, perPage: PER_PAGE });
  const { division, status, q, from, to } = query;

  const filterParams = new URLSearchParams();
  for (const key of FILTER_KEYS) {
    if (filters[key]) filterParams.set(key, filters[key]);
  }
  const filterSearch = filterParams.toString();
  const hasFilters = FILTER_KEYS.some((key) => Boolean(filters[key]));

  // Exportul primește intervalul deja normalizat, ca să filtreze la fel.
  const exportParams = new URLSearchParams();
  if (filters.q) exportParams.set("q", filters.q);
  if (filters.division) exportParams.set("division", filters.division);
  if (filters.status) exportParams.set("status", filters.status);
  if (range.from) exportParams.set("from", range.from);
  if (range.to) exportParams.set("to", range.to);

  const exportQuery = exportParams.toString();
  const exportHref = exportQuery ? `/api/leads/export?${exportQuery}` : "/api/leads/export";

  const openLeadId = openLeadRaw && UUID.test(openLeadRaw) ? openLeadRaw : null;

  const [listResult, statsResult, factsResult, detailResult] = await Promise.all([
    listLeads(query),
    getLeadStats(),
    getLeadFacts({ division, status, q, from, to }),
    openLeadId ? getLead(openLeadId) : Promise.resolve(null),
  ]);

  const facts = factsResult.ok ? factsResult.data : null;
  const total = listResult.ok ? listResult.data.total : 0;

  let detail: LeadDetailData | null = null;
  if (openLeadRaw) {
    if (!openLeadId) detail = { state: "missing" };
    else if (detailResult?.ok) detail = { state: "ok", lead: detailResult.data.lead, events: detailResult.data.events, neighbors: neighborsOf(openLeadId, facts, total, filterSearch) };
    else detail = { state: detailResult?.reason === "not_found" ? "missing" : "error" };
  }

  return (
    <>
      {justDeleted ? <DeletedNotice /> : null}
      <LeadsWorkspace
        now={Date.now()}
        items={listResult.ok ? listResult.data.items : []}
        total={total}
        page={listResult.ok ? listResult.data.page : page}
        perPage={PER_PAGE}
        listFailed={!listResult.ok}
        stats={statsResult.ok ? statsResult.data : null}
        sources={facts ? summarizeSources(facts) : null}
        filters={filters}
        hasFilters={hasFilters}
        filterSearch={filterSearch}
        exportHref={exportHref}
        openLeadId={openLeadId ?? openLeadRaw}
        detail={detail}
      />
    </>
  );
}
