"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Download, Inbox, Sparkles } from "lucide-react";
import type { Lead } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";
import { Btn, btnClass, Card } from "../ui/primitives";
import { EmptyState, ErrorState } from "../ui/states";
import { useQueryParams } from "../ui/use-query-params";
import { useToast } from "../ui/toast";
import { LeadDetail } from "./lead-detail";
import { LeadFiltersBar } from "./lead-filters-bar";
import { LeadStatsCard } from "./lead-stats";
import { LeadsHeader } from "./leads-header";
import { LeadsPagination } from "./leads-pagination";
import { LeadsTable } from "./leads-table";
import { LeadsNavProvider, NavLink } from "./nav-link";
import type { LeadsWorkspaceProps } from "./types";
import { leadCount, leadsHref, type LeadFilterValues } from "./urls";

/** La cât timp se recitește lista singură (și când revii în filă). */
const REFRESH_MS = 20_000;
/** Cât timp rămâne marcat „nou” un lead apărut între două reîmprospătări. */
const FRESH_MS = 12_000;
const EXPORT_CAP = 5000;

type FilterPatch = Partial<Record<keyof LeadFilterValues | "page", string>>;

/**
 * Ecranul de lead-uri, ca în `LeadsPage.jsx`: antet, indicatori, filtre, listă și, când e deschis un
 * lead, fișa lui alături. Datele vin de la pagina de server (filtrele și pagina stau în URL, deci
 * serverul le recitește la fiecare schimbare); aici trăiesc doar lucrurile de client:
 * reîmprospătarea de la 20 s, deschiderea instantanee a fișei și marcajul lead-urilor noi.
 */
export function LeadsWorkspace({ now, items, total, page, perPage, listFailed, stats, sources, filters, hasFilters, filterSearch, exportHref, openLeadId, detail }: LeadsWorkspaceProps) {
  const router = useRouter();
  const { setMany } = useQueryParams();
  const { notify } = useToast();
  const [navPending, startNav] = useTransition();
  const [refreshing, startRefresh] = useTransition();
  const [optimistic, setOptimistic] = useState<Lead | null>(null);
  const [freshIds, setFreshIds] = useState<ReadonlySet<string>>(() => new Set());

  const pageCount = Math.max(1, Math.ceil(total / perPage));
  const listHref = leadsHref(filterSearch, { page });
  const hrefFor = useCallback((leadId: string) => leadsHref(filterSearch, { page, lead: leadId }), [filterSearch, page]);
  const pageHref = useCallback((n: number) => leadsHref(filterSearch, { page: n, lead: openLeadId ?? undefined }), [filterSearch, openLeadId]);

  const go = useCallback(
    (href: string) =>
      startNav(() => {
        router.push(href, { scroll: false });
      }),
    [router]
  );

  // Fără useCallback: `setMany` se leagă de adresa de la randarea curentă.
  const patchFilters = (patch: FilterPatch) =>
    startNav(() => {
      setMany(patch);
    });

  // Reîmprospătarea: punctul „Live” pulsează doar cât timp se recitește lista.
  const refresh = useCallback(() => {
    startRefresh(() => {
      router.refresh();
    });
  }, [router]);

  useEffect(() => {
    const interval = window.setInterval(refresh, REFRESH_MS);
    // Revenirea în filă după o pauză lungă nu așteaptă intervalul.
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  // Lead nou între două reîmprospătări: marcaj „nou” și o notificare. Se compară cu lista de dinainte
  // doar pe aceeași pagină și același filtru, ca schimbarea paginii să nu pară un lead nou.
  const seen = useRef<{ key: string; ids: Set<string>; newest: number } | null>(null);
  const freshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listKey = `${filterSearch}|${page}`;
  useEffect(() => {
    if (listFailed) return;
    const previous = seen.current;
    const ids = new Set(items.map((lead) => lead.id));
    const newest = items.reduce((max, lead) => Math.max(max, new Date(lead.createdAt).getTime()), 0);
    seen.current = { key: listKey, ids, newest };
    if (!previous || previous.key !== listKey) return;
    const added = items.filter((lead) => !previous.ids.has(lead.id) && new Date(lead.createdAt).getTime() > previous.newest);
    if (added.length === 0) return;
    setFreshIds(new Set(added.map((lead) => lead.id)));
    if (freshTimer.current) clearTimeout(freshTimer.current);
    freshTimer.current = setTimeout(() => setFreshIds(new Set()), FRESH_MS);
    const first = added[0];
    notify(added.length === 1 ? `Lead nou: ${first.name}${first.company ? ` · ${first.company}` : ""}` : `${added.length} lead-uri noi în listă.`);
  }, [items, listKey, listFailed, notify]);
  useEffect(
    () => () => {
      if (freshTimer.current) clearTimeout(freshTimer.current);
    },
    []
  );

  // Fișa se deschide pe loc, cu datele din rând; istoricul și pozițiile vin când răspunde serverul.
  const openLead = useCallback(
    (lead: Lead, href: string) => {
      setOptimistic(lead);
      go(href);
    },
    [go]
  );
  useEffect(() => {
    if (navPending || !optimistic) return;
    // Serverul a livrat fișa cerută, a spus că nu mai există sau URL-ul nu mai are lead.
    if (!openLeadId || detail?.state !== undefined) setOptimistic(null);
  }, [navPending, optimistic, openLeadId, detail]);

  const serverOk = detail?.state === "ok" ? detail : null;
  const showOptimistic = optimistic !== null && serverOk?.lead.id !== optimistic.id;
  const activeId = optimistic?.id ?? openLeadId;
  const open = activeId !== null;

  // La închidere, focusul se întoarce pe rândul care fusese deschis.
  const closedId = useRef<string | null>(null);
  useEffect(() => {
    if (activeId) {
      closedId.current = activeId;
      return;
    }
    const id = closedId.current;
    closedId.current = null;
    if (!id) return;
    const links = Array.from(document.querySelectorAll<HTMLElement>(`[data-lead-link="${id}"]`));
    links.find((link) => link.offsetParent !== null)?.focus({ preventScroll: true });
  }, [activeId]);

  const navValue = useMemo(() => ({ go, pending: navPending }), [go, navPending]);

  const clearFilters = () => patchFilters({ q: "", division: "", status: "", from: "", to: "", page: "" });

  let listBody: ReactNode;
  if (listFailed) {
    listBody = (
      <ErrorState
        title="Nu am putut citi lead-urile"
        text="Conexiunea la Supabase a eșuat. Verifică variabilele de mediu și starea proiectului în consola Supabase, apoi încearcă din nou. Datele tale nu s-au pierdut."
        onRetry={refresh}
        hint="Lista se reîncearcă singură la 20 de secunde. Dacă eroarea rămâne și după ce baza răspunde, conexiunea are nevoie de verificare."
      />
    );
  } else if (items.length === 0 && total === 0 && !hasFilters) {
    listBody = (
      <EmptyState
        icon={Sparkles}
        title="Încă nu a venit niciun lead"
        text="Lead-ul apare aici în secunda în care cineva completează un formular pe site. Îți trimitem și un email, ca să nu-l ratezi."
        action={
          <a href="/video" target="_blank" rel="noopener noreferrer" className={btnClass({ variant: "outline", size: "sm" })}>
            Deschide formularul de pe site
          </a>
        }
        hint="Vrei să verifici că merge? Trimite o cerere de test din formularul de pe /video. Lista se reîmprospătează singură, nu trebuie să reîncarci pagina."
      />
    );
  } else if (items.length === 0 && total === 0) {
    listBody = (
      <EmptyState
        icon={Inbox}
        title="Niciun lead nu se potrivește filtrului"
        text="Filtrul e prea strâns. Șterge data de la/până la sau caută doar numele firmei. Dacă abia ai schimbat statusul cuiva, s-ar putea să fi ieșit din selecție."
        action={
          <Btn variant="outline" size="sm" onClick={clearFilters}>
            Șterge filtrele
          </Btn>
        }
      />
    );
  } else if (items.length === 0) {
    listBody = (
      <EmptyState
        icon={Inbox}
        title={`Pagina ${page} e goală`}
        text={`Filtrul curent are ${leadCount(total)}, în ${pageCount} ${pageCount === 1 ? "pagină" : "pagini"}.`}
        action={
          <NavLink href={leadsHref(filterSearch, { page: pageCount })} className={btnClass({ variant: "outline", size: "sm" })}>
            Mergi la ultima pagină
          </NavLink>
        }
      />
    );
  } else {
    listBody = (
      <>
        <LeadsTable rows={items} activeId={activeId} hrefFor={hrefFor} onOpen={openLead} freshIds={freshIds} now={now} compact={open} />
        <LeadsPagination page={page} perPage={perPage} total={total} totalAll={stats?.total ?? null} pageCount={pageCount} hrefFor={pageHref} />
      </>
    );
  }

  let detailBody: ReactNode = null;
  if (showOptimistic && optimistic) {
    detailBody = <LeadDetail key={optimistic.id} lead={optimistic} events={null} neighbors={null} listHref={listHref} now={now} />;
  } else if (serverOk) {
    detailBody = <LeadDetail key={serverOk.lead.id} lead={serverOk.lead} events={serverOk.events} neighbors={serverOk.neighbors} listHref={listHref} now={now} />;
  } else if (openLeadId && detail?.state === "error") {
    detailBody = (
      <Card className="p-0">
        <ErrorState
          title="Nu am putut citi lead-ul"
          text="Conexiunea la bază a eșuat în timp ce deschideam fișa. Datele nu s-au pierdut: încearcă din nou sau întoarce-te la listă."
          onRetry={refresh}
        />
      </Card>
    );
  } else if (openLeadId && detail?.state === "missing") {
    detailBody = (
      <Card className="p-0">
        <EmptyState
          icon={Inbox}
          title="Lead-ul nu mai există"
          text="Poate a fost șters de un coleg. Lista din stânga are lead-urile rămase."
          action={
            <NavLink href={listHref} className={btnClass({ variant: "primary", size: "sm" })}>
              Vezi lista
            </NavLink>
          }
        />
      </Card>
    );
  }

  return (
    <LeadsNavProvider value={navValue}>
      <div className="space-y-4">
        {!open ? (
          <>
            <LeadsHeader refreshing={refreshing} onRefresh={refresh} />
            {stats ? <LeadStatsCard stats={stats} sources={sources} hasFilters={hasFilters} /> : null}
          </>
        ) : null}

        <div className={cn("grid grid-cols-[minmax(0,1fr)] gap-4", open && "xl:grid-cols-[minmax(0,1fr)_460px]")}>
          <div className={cn("space-y-3", open && "hidden xl:block")}>
            <LeadFiltersBar compact={open} filters={filters} hasFilters={hasFilters} filtered={total} totalAll={stats?.total ?? null} exportHref={exportHref} pending={navPending} onChange={patchFilters} />

            <Card className={cn("overflow-hidden p-0 transition-opacity", navPending && "opacity-60")} aria-busy={navPending || undefined}>
              {listBody}
            </Card>

            <p className="flex items-center gap-1.5 px-1 text-[11px] text-muted-foreground/60">
              <Download className="h-3 w-3 shrink-0" aria-hidden="true" />
              Exportul CSV conține exact rândurile filtrate, nu toată baza.
              {total > EXPORT_CAP ? ` La peste 5.000 de rânduri se exportă cele mai noi 5.000.` : ""}
            </p>
          </div>

          {open && detailBody ? <div className="min-w-0">{detailBody}</div> : null}
        </div>
      </div>
    </LeadsNavProvider>
  );
}
