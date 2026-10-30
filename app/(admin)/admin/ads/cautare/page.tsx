import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Search as SearchIcon } from "lucide-react";
import { campaignUrl } from "@/lib/ads/links";
import { formatAmount } from "@/lib/ads/metrics";
import { clientsForRequest, readClientView } from "@/lib/ads/model/read";
import { PERIOD_LABEL } from "@/lib/ads/model/selection";
import { readSelection } from "@/lib/ads/model/selection.server";
import { STATUS_ORDER } from "@/lib/ads/model/status";
import { currentWorkspaceId, listWorkspaces } from "@/lib/ads/workspaces.server";
import { CautariHeader } from "@/components/panou/ads/cautari-shell";
import { CautariPlanEditor } from "@/components/panou/ads/cautari-plan-editor";
import { CautariCampaniiLista, type CautariCampanie } from "@/components/panou/ads/cautari-plan-campanii";
import { InlineNote } from "@/components/panou/ui/actions";
import { Card, SectionTitle, btnClass } from "@/components/panou/ui/primitives";
import { EmptyState, ErrorState } from "@/components/panou/ui/states";
import { checkSearchPlan, createSearchPlan } from "../actions";

export const metadata: Metadata = {
  title: "Căutări — MERIDIAN Reclame",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/** Verificarea întreabă contul, locațiile, conversiile și adresele, apoi trimite tot planul cu validateOnly. */
export const maxDuration = 60;

/** Câte campanii se arată pe card-uri; restul sunt în Campanii, cu filtrul pe Google. */
const SHOWN = 12;

/**
 * /admin/ads/cautare — filă „Campanii de căutare” din Căutări: campaniile de
 * căutare ale clientului din bara de sus, iar dedesubt planul de căutare
 * (`meridian-google-search/1`): campanii, grupuri, cuvinte cheie, negative,
 * anunțuri responsive și materiale, într-un singur cont Google Ads. Citit în
 * română, verificat cu `validateOnly`, creat într-o singură cerere — totul oprit.
 */
export default async function SearchPlanPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const workspaces = listWorkspaces();
  const currentId = await currentWorkspaceId();
  const current = workspaces.find((workspace) => workspace.id === currentId);

  const selection = await readSelection(params);
  const clients = await clientsForRequest();
  const client = clients.ok ? (clients.data.find((item) => item.id === selection.clientId) ?? clients.data[0] ?? null) : null;
  const view = client ? await readClientView({ client, channel: "google", range: selection.range }) : null;

  const items: CautariCampanie[] = [];
  if (client && view?.ok) {
    const rows = view.data.entities
      .filter((entity) => entity.level === "campaign" && entity.kind === "SEARCH" && entity.status !== "removed")
      .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.name.localeCompare(b.name, "ro"));
    for (const entity of rows) {
      const account = view.data.accounts.find((item) => item.id === entity.accountId);
      const figures = view.data.totals[entity.id];
      const currency = entity.currency ?? account?.currency ?? "";
      items.push({
        id: entity.id,
        name: entity.name,
        status: entity.status,
        statusDetail: entity.statusDetail,
        client: client.name,
        bidding: entity.settings.facts.find(([label]) => label === "Licitare")?.[1] ?? null,
        budget: entity.dailyBudget ? formatAmount(entity.dailyBudget, currency) : null,
        createdAt: entity.createdAt,
        spend: figures && (figures.spend > 0 || figures.clicks > 0) ? formatAmount(figures.spend, currency) : null,
        clicks: figures?.clicks ?? null,
        fromPortal: entity.portalCampaignId !== null,
        fisaHref: entity.portalCampaignId ? `/admin/ads/${entity.portalCampaignId}` : `/admin/ads?client=${client.id}&canal=google&rand=${entity.id}`,
        googleHref: account ? campaignUrl("google", account.adAccount, entity.platformId) : null,
      });
    }
  }
  const viewError = view && !view.ok ? view.message : null;
  const googleAccount = client?.accounts.find((account) => account.platform === "google");
  const hasGoogleAccount = Boolean(googleAccount);
  // Filele Termeni / Cont Google / Conversii se deschid direct pe contul clientului ales sus.
  const cont = googleAccount ? googleAccount.adAccount.replace(/\D/g, "") || undefined : undefined;
  const period = PERIOD_LABEL[selection.period].toLowerCase();

  return (
    <div className="space-y-4">
      <CautariHeader active="campanii" cont={cont} workspaces={workspaces} currentWorkspaceId={currentId} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[12px] text-muted-foreground">
          {client && view?.ok && hasGoogleAccount
            ? `${items.length === 1 ? "O campanie de căutare" : `${items.length} campanii de căutare`} · ${client.name} · portalul le creează pe pauză`
            : "Campaniile de căutare ale clientului ales sus · portalul le creează pe pauză"}
        </p>
        <div className="flex gap-2">
          <Link href="/admin/ads/lot" className={btnClass({ size: "sm", variant: "outline" })}>
            Lot de planuri
          </Link>
          <a href="#plan-de-cautare" className={btnClass({ size: "sm", variant: "primary" })}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Plan de căutare
          </a>
        </div>
      </div>

      {!clients.ok ? (
        <Card className="p-0">
          <ErrorState title="Clienții nu se pot citi" text={clients.message} />
        </Card>
      ) : !client ? (
        <Card className="p-0">
          <EmptyState
            icon={SearchIcon}
            title="Niciun client încă"
            text="Campaniile de căutare se leagă de un client și de contul lui Google. Adaugă clientul, apoi contul."
            action={
              <Link href="/admin/ads/clienti" className={btnClass({ size: "sm", variant: "outline" })}>
                Adaugă primul client
              </Link>
            }
          />
        </Card>
      ) : !hasGoogleAccount ? (
        <Card className="p-0">
          <EmptyState
            icon={SearchIcon}
            title={`${client.name} n-are cont Google`}
            text="Leagă contul Google Ads al clientului ca să-i vezi aici campaniile de căutare. Planul de căutare de mai jos merge și fără, pe contul scris în plan."
            action={
              <Link href="/admin/ads/clienti" className={btnClass({ size: "sm", variant: "outline" })}>
                Leagă un cont
              </Link>
            }
          />
        </Card>
      ) : viewError ? (
        <Card className="p-0">
          <ErrorState title="Campaniile nu se pot citi" text={viewError} hint="Planul de căutare de mai jos merge în continuare." />
        </Card>
      ) : items.length === 0 ? (
        <Card className="p-0">
          <EmptyState
            icon={SearchIcon}
            title="Nicio campanie de căutare"
            text="Lipește un plan cu cuvinte cheie, grupuri și anunțuri text. Îl verificăm pe cont înainte de creare."
            action={
              <a href="#plan-de-cautare" className={btnClass({ size: "sm", variant: "primary" })}>
                Lipește un plan
              </a>
            }
          />
        </Card>
      ) : (
        <>
          <CautariCampaniiLista items={items.slice(0, SHOWN)} period={period} />
          {items.length > SHOWN ? (
            <p className="px-1 text-[11.5px] text-muted-foreground">
              Se văd primele {SHOWN} din {items.length}.{" "}
              <Link href={`/admin/ads?client=${client.id}&canal=google`} className="underline underline-offset-4 hover:text-foreground">
                Toate, în Campanii
              </Link>
            </p>
          ) : null}
        </>
      )}

      <section id="plan-de-cautare" aria-labelledby="plan-de-cautare-titlu" className="scroll-mt-24 space-y-4 pt-4">
        <SectionTitle
          title={<span id="plan-de-cautare-titlu">Plan de căutare</span>}
          hint="Un plan = un cont Google Ads = mai multe campanii de căutare, cu grupurile, cuvintele cheie, negativele, anunțurile și materialele lor. Portalul le citește, găsește conflictele și le creează pe toate odată — oprite."
        />
        {current && current.platform !== "google" ? (
          <InlineNote tone="apricot" className="max-w-2xl">
            Lucrezi în {current.name}. Planurile de căutare se creează în Google Ads: treci în Meridian · Google sau Clienți · Google din selectorul „Spațiu” de sus.
          </InlineNote>
        ) : null}
        <CautariPlanEditor workspaces={workspaces} currentWorkspaceId={currentId} actions={{ checkPlan: checkSearchPlan, createPaused: createSearchPlan }} />
      </section>
    </div>
  );
}
