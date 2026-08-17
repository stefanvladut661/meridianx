import type { Metadata } from "next";
import Link from "next/link";
import { leadListQuerySchema } from "@/lib/validations/lead";
import { getLead, getLeadStats, listLeads } from "@/lib/supabase/leads";
import { isWriteConfigured } from "@/lib/supabase/clients";
import { StatsStrip } from "../_components/stats-strip";
import { Filters } from "../_components/filters";
import { LeadTable } from "../_components/lead-table";
import { LeadPanel } from "../_components/lead-panel";
import { SetupNotice } from "../_components/setup-notice";

export const metadata: Metadata = {
  title: "Lead-uri — MERIDIAN Admin",
  robots: { index: false, follow: false },
};

/** Panoul citește mereu date proaspete — nu are sens să cacheze lead-uri. */
export const dynamic = "force-dynamic";

/**
 * /admin — dashboard-ul de lead-uri (FAZA 6).
 *
 * Toată starea (filtre, pagină, lead deschis) stă în URL. Consecințele
 * sunt cele care contează într-o unealtă de lucru zilnic: se poate da
 * refresh fără să pierzi filtrul, se poate trimite un link către un lead
 * pe chat, butonul Înapoi face ce te aștepți, iar exportul CSV scoate
 * exact ce vezi pe ecran.
 */

type SearchParams = Record<string, string | string[] | undefined>;

/** Șirurile goale trebuie scoase: `z.enum().optional()` respinge `""`. */
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

/** `<input type="date">` dă `2026-08-14`; schema cere ISO datetime. */
function toIsoRange(cleaned: Record<string, string>) {
  const query: Record<string, string> = { ...cleaned };
  if (query.from && /^\d{4}-\d{2}-\d{2}$/.test(query.from)) {
    query.from = `${query.from}T00:00:00.000Z`;
  }
  if (query.to && /^\d{4}-\d{2}-\d{2}$/.test(query.to)) {
    query.to = `${query.to}T23:59:59.999Z`;
  }
  return query;
}

/** URL-ul listei cu filtrele curente, opțional cu un lead deschis. */
function buildHref(cleaned: Record<string, string>, leadId?: string): string {
  const search = new URLSearchParams();
  for (const key of ["q", "division", "status", "from", "to", "page"] as const) {
    if (cleaned[key]) search.set(key, cleaned[key]);
  }
  if (leadId) search.set("lead", leadId);
  const query = search.toString();
  return query ? `/admin?${query}` : "/admin";
}

export default async function AdminDashboardPage({
  searchParams,
}: Readonly<{ searchParams: Promise<SearchParams> }>) {
  const raw = await searchParams;
  const cleaned = cleanParams(raw);
  const { lead: openLeadId, ...filterParams } = cleaned;

  if (!isWriteConfigured()) {
    return <SetupNotice />;
  }

  const parsed = leadListQuerySchema.safeParse(toIsoRange(filterParams));
  const query = parsed.success
    ? parsed.data
    : leadListQuerySchema.parse({ page: 1, perPage: 25 });

  const [listResult, statsResult] = await Promise.all([
    listLeads(query),
    getLeadStats(),
  ]);

  const detail = openLeadId ? await getLead(openLeadId) : null;

  if (!listResult.ok) {
    return (
      <main className="px-4 py-16 sm:px-6">
        <h1 className="font-display text-xl font-semibold tracking-tight">
          Nu putem citi lead-urile
        </h1>
        <p className="mt-2 max-w-lg text-sm leading-relaxed text-fg/70">
          Conexiunea la Supabase a eșuat. Verifică variabilele de mediu și
          starea proiectului în consola Supabase, apoi reîncarcă pagina.
        </p>
      </main>
    );
  }

  const { items, total, page, perPage } = listResult.data;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const hasFilters = Object.keys(filterParams).some((key) => key !== "page");

  const exportSearch = new URLSearchParams();
  for (const key of ["q", "division", "status", "from", "to"] as const) {
    if (filterParams[key]) exportSearch.set(key, filterParams[key]);
  }
  // Exportul primește intervalul deja normalizat, ca să filtreze la fel.
  const isoRange = toIsoRange(filterParams);
  if (isoRange.from) exportSearch.set("from", isoRange.from);
  if (isoRange.to) exportSearch.set("to", isoRange.to);

  return (
    <main className="px-4 pb-20 pt-6 sm:px-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="font-display text-xl font-semibold tracking-tight">
          Lead-uri
        </h1>
        <p className="font-mono text-[11px] tabular-nums tracking-[0.16em] text-muted">
          {total === 0
            ? "niciun rezultat"
            : `${(page - 1) * perPage + 1}–${Math.min(page * perPage, total)} din ${total}`}
        </p>
      </div>

      {statsResult.ok ? (
        <div className="mt-5">
          <StatsStrip stats={statsResult.data} />
        </div>
      ) : null}

      <Filters
        values={filterParams}
        exportHref={`/api/leads/export?${exportSearch.toString()}`}
        hasFilters={hasFilters}
      />

      <LeadTable
        leads={items}
        selectedId={openLeadId ?? null}
        hrefFor={(leadId) => buildHref(filterParams, leadId)}
        emptyState={
          hasFilters
            ? {
                title: "Niciun lead nu se potrivește filtrului",
                body: "Lărgește intervalul de timp sau șterge filtrele. Dacă abia ai schimbat statusul cuiva, s-ar putea să fi ieșit din selecție.",
              }
            : {
                title: "Încă nu a venit niciun lead",
                body: "Când cineva completează un formular pe site, apare aici în secunda următoare și primești și un email. Până atunci, verifică dacă formularele trimit corect: deschide /video/contact și trimite o cerere de test.",
              }
        }
      />

      {totalPages > 1 ? (
        <nav
          aria-label="Paginare"
          className="mt-6 flex items-center justify-between gap-4"
        >
          {page > 1 ? (
            <Link
              href={buildHref({ ...filterParams, page: String(page - 1) })}
              className="font-mono text-[11px] uppercase tracking-[0.16em] text-fg/80 underline-offset-4 hover:underline"
            >
              ← Pagina anterioară
            </Link>
          ) : (
            <span />
          )}
          <span className="font-mono text-[11px] tabular-nums tracking-[0.16em] text-muted">
            {page} / {totalPages}
          </span>
          {page < totalPages ? (
            <Link
              href={buildHref({ ...filterParams, page: String(page + 1) })}
              className="font-mono text-[11px] uppercase tracking-[0.16em] text-fg/80 underline-offset-4 hover:underline"
            >
              Pagina următoare →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}

      {detail?.ok ? (
        <LeadPanel
          lead={detail.data.lead}
          events={detail.data.events}
          closeHref={buildHref(filterParams)}
        />
      ) : null}
    </main>
  );
}
