import type { Metadata } from "next";
import Link from "next/link";
import { leadListQuerySchema } from "@/lib/validations/lead";
import { getLead, getLeadStats, listLeads } from "@/lib/supabase/leads";
import { isWriteConfigured } from "@/lib/supabase/clients";
import { StatsStrip } from "../_components/stats-strip";
import { Filters } from "../_components/filters";
import { LeadWorkspace } from "../_components/lead-workspace";
import { SetupNotice } from "../_components/setup-notice";
import { LiveRefresh } from "../_components/live-refresh";

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
      <main className="mx-auto max-w-[1400px] px-5 py-20 sm:px-8">
        <p className="eyebrow">Eroare de conexiune</p>
        <h1 className="display mt-3 text-[2rem] text-bone">
          Nu putem citi lead-urile
        </h1>
        <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-dim">
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

  const pageLink =
    "btn btn-ghost !min-h-9 !px-4 !py-2 !text-[12.5px]";

  return (
    <main className="relative mx-auto max-w-[1400px] px-5 pb-24 pt-8 sm:px-8 sm:pt-10">
      <LiveRefresh />

      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div>
          <p className="eyebrow">Panou</p>
          <h1 className="display mt-2 text-[2.5rem] text-bone sm:text-[3rem]">
            Lead-uri
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Punctul pulsează cât timp lista se reîmprospătează singură
              (LiveRefresh, la 20 s) — e o citire, nu un ornament. */}
          <span className="pill !py-2 !text-[13px] text-bone/80">
            <span className="rec-dot" aria-hidden />
            Live · la 20 s
          </span>
          <p className="font-md-mono text-[12.5px] tabular-nums tracking-[0.12em] text-dim">
            {total === 0
              ? "niciun rezultat"
              : `${(page - 1) * perPage + 1}–${Math.min(page * perPage, total)} din ${total}`}
          </p>
        </div>
      </div>

      {statsResult.ok ? (
        <div className="mt-8">
          <StatsStrip stats={statsResult.data} />
        </div>
      ) : null}

      <Filters
        values={filterParams}
        exportHref={`/api/leads/export?${exportSearch.toString()}`}
        hasFilters={hasFilters}
      />

      <LeadWorkspace
        leads={items}
        selectedId={openLeadId ?? null}
        detail={detail?.ok ? detail.data : null}
        listHref={buildHref(filterParams)}
        emptyState={
          hasFilters
            ? {
                title: "Niciun lead nu se potrivește filtrului",
                body: "Lărgește intervalul de timp sau șterge filtrele. Dacă abia ai schimbat statusul cuiva, s-ar putea să fi ieșit din selecție.",
              }
            : {
                title: "Încă nu a venit niciun lead",
                body: "Când cineva completează un formular pe site, apare aici în secunda următoare și primești și un email. Până atunci, verifică dacă formularele trimit corect: deschide /video și trimite o cerere de test din formularul de jos.",
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
              className={pageLink}
            >
              ← Anterioară
            </Link>
          ) : (
            <span />
          )}
          <span className="font-md-mono text-[11px] tabular-nums tracking-[0.16em] text-dim">
            {page} / {totalPages}
          </span>
          {page < totalPages ? (
            <Link
              href={buildHref({ ...filterParams, page: String(page + 1) })}
              className={pageLink}
            >
              Următoarea →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </main>
  );
}
