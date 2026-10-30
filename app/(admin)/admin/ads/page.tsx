import type { Metadata } from "next";
import Link from "next/link";
import { Megaphone, Plus } from "lucide-react";
import { clientsForRequest, readClientView } from "@/lib/ads/model/read";
import { readSelection } from "@/lib/ads/model/selection.server";
import { CHANNEL_LABEL, PERIOD_LABEL, selectionQuery } from "@/lib/ads/model/selection";
import { callCountsByCampaign } from "@/lib/ads/model/calls";
import { rowFigures, totalsByCurrency } from "@/lib/ads/model/rows";
import { PLATFORM_LABEL } from "@/lib/ads/constants";
import { KpiTiles } from "@/components/panou/ads/kpi-tiles";
import { CampaignsScreen } from "@/components/panou/ads/campaigns-screen";
import { HouseRule } from "@/components/panou/ads/house-rule";
import { SyncBar } from "@/components/panou/ads/sync-bar";
import { PAGE_LEAD, PAGE_TITLE } from "@/components/panou/ads/tone";
import { Card, Pill, btnClass } from "@/components/panou/ui/primitives";
import { EmptyState, ErrorState } from "@/components/panou/ui/states";
import { InlineNote } from "@/components/panou/ui/actions";
import { syncClientAction } from "./clienti/actions";
import { entityDaysAction, pauseAction, setResultAction } from "./v2-actions";

export const metadata: Metadata = {
  title: "Campanii — MERIDIAN Reclame",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";
// Pauza trimite o cerere la platformă din panou: câteva secunde, dar nu mai mult de un minut.
export const maxDuration = 60;

const AGAINST: Record<string, string> = {
  "7": "față de cele 7 zile dinainte",
  "30": "față de cele 30 de zile dinainte",
  "90": "față de cele 90 de zile dinainte",
  luna: "față de aceleași zile de dinainte",
  "luna-trecuta": "față de luna dinainte",
};

const PERIOD_SHORT: Record<string, string> = { "7": "7 zile", "30": "30 de zile", "90": "90 de zile", luna: "luna aceasta", "luna-trecuta": "luna trecută" };

/**
 * /admin/ads — ecranul principal, ca în Meta Ads Manager: patru cifre mari,
 * apoi filele Campanii / Grupuri / Reclame și tabelul, pe clientul, perioada și
 * canalul alese sus. Citește doar din bază (sincronizarea zilnică + „Sincronizează acum”).
 */
export default async function AdsCampaignsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const selection = await readSelection(params);
  const clients = await clientsForRequest();

  const header = (subtitle?: string, actions?: React.ReactNode) => (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <div className="flex items-center gap-2.5">
          <h1 className={PAGE_TITLE}>Campanii</h1>
          <Pill tone="apricot">doar pe pauză</Pill>
        </div>
        <p className={PAGE_LEAD}>Portalul creează campanii oprite. Pornirea, bugetul și licitarea se ating doar în platformă, de mână.</p>
        {subtitle ? <p className="mt-1.5 text-[11.5px] text-muted-foreground">{subtitle}</p> : null}
      </div>
      {actions}
    </div>
  );

  if (!clients.ok) {
    return (
      <div className="space-y-4">
        {header()}
        <Card className="p-0">
          <ErrorState title="Clienții nu se pot citi" text={clients.message} hint="Nu s-a schimbat nimic în conturi — doar citirea a eșuat." />
        </Card>
      </div>
    );
  }

  if (clients.data.length === 0) {
    return (
      <div className="space-y-4">
        {header()}
        <Card className="p-0">
          <EmptyState
            icon={Megaphone}
            title="Niciun client încă"
            text="Ecranul arată campaniile, grupurile și reclamele unui client, de pe Meta, Google și TikTok, în același tabel. Un client adună conturile lui: îl adaugi o dată, îi legi conturile, iar portalul îi aduce cifrele în fiecare dimineață."
            action={
              <Link href="/admin/ads/clienti" className={btnClass({ variant: "primary", size: "sm" })}>
                Adaugă primul client
              </Link>
            }
          />
        </Card>
      </div>
    );
  }

  const client = clients.data.find((item) => item.id === selection.clientId) ?? clients.data[0];
  const [view, calls] = await Promise.all([
    readClientView({ client, channel: selection.channel, range: selection.range }),
    callCountsByCampaign({ clientId: client.id, from: selection.range.from, to: selection.range.to }),
  ]);
  const subtitle = `${client.name} · ${PERIOD_LABEL[selection.period]} · ${CHANNEL_LABEL[selection.channel]}`;
  const query = selectionQuery({ ...selection, clientId: client.id });

  const actions = (
    <div className="flex flex-wrap items-center gap-2">
      <SyncBar
        clientId={client.id}
        lastSyncedAt={client.accounts.map((account) => account.lastSyncedAt).filter((value): value is string => Boolean(value)).sort().at(-1) ?? null}
        failedAccounts={client.accounts.filter((account) => account.syncEnabled && account.lastSyncStatus === "failed").length}
        hasAccounts={client.accounts.length > 0}
        sync={syncClientAction}
      />
      <Link href="/admin/ads/nou" className={btnClass({ variant: "outline", size: "sm" })}>
        Importă JSON
      </Link>
      <Link href={`/admin/ads/creeaza?${query}`} className={btnClass({ variant: "primary", size: "sm", className: "gap-1.5" })}>
        <Plus className="h-4 w-4" aria-hidden="true" />
        Creează
      </Link>
    </div>
  );

  if (!view.ok) {
    return (
      <div className="space-y-4">
        {header(subtitle, actions)}
        <Card className="p-0">
          <ErrorState title="Cifrele nu se pot citi" text={view.message} hint="Nu s-a schimbat nimic în conturi — doar citirea a eșuat." />
        </Card>
      </div>
    );
  }

  const { accounts, entities, totals, previous } = view.data;
  if (accounts.length === 0) {
    return (
      <div className="space-y-4">
        {header(subtitle, actions)}
        <Card className="p-0">
          <EmptyState
            icon={Megaphone}
            title={selection.channel === "toate" ? `${client.name} n-are încă niciun cont legat` : `${client.name} n-are cont ${PLATFORM_LABEL[selection.channel]}`}
            text="Leagă-i conturile din pagina Clienți: alegi contul din lista pe care o vede tokenul, apoi „Sincronizează acum”."
            action={
              <Link href="/admin/ads/clienti" className={btnClass({ variant: "primary", size: "sm" })}>
                Leagă un cont
              </Link>
            }
          />
        </Card>
      </div>
    );
  }

  const neverSynced = accounts.filter((account) => !account.lastSyncedAt);
  const failed = accounts.filter((account) => account.syncEnabled && account.lastSyncStatus === "failed");
  const catalog = new Map(accounts.map((account) => [account.id, account.conversions]));
  const campaigns = entities.filter((entity) => entity.level === "campaign");
  const current = totalsByCurrency(campaigns.map((entity) => ({ entity, figures: rowFigures(entity, totals[entity.id], catalog.get(entity.accountId) ?? []) })));
  const before = totalsByCurrency(campaigns.map((entity) => ({ entity, figures: rowFigures(entity, previous[entity.id], catalog.get(entity.accountId) ?? []) })));
  const noConversions = accounts.every((account) => account.measured === false);

  return (
    <div className="space-y-4">
      {header(subtitle, actions)}

      {neverSynced.length > 0 ? (
        <InlineNote tone="apricot">
          <p className="font-medium">
            {neverSynced.length === accounts.length
              ? "Conturile n-au fost citite încă."
              : `${neverSynced.length === 1 ? "Un cont n-a" : `${neverSynced.length} conturi n-au`} fost citit${neverSynced.length === 1 ? "" : "e"} încă.`}
          </p>
          <p className="mt-1">
            Apasă „Sincronizează acum”: portalul citește campaniile, grupurile, reclamele și cifrele pe ultimele 90 de zile. De mâine, se actualizează singur în fiecare dimineață.
          </p>
        </InlineNote>
      ) : null}
      {failed.length > 0 ? (
        <InlineNote tone="rose">
          <div role="alert">
            <p className="font-medium">{failed.length === 1 ? "Un cont n-a putut fi citit la ultima actualizare." : `${failed.length} conturi n-au putut fi citite la ultima actualizare.`}</p>
            <ul className="mt-1 list-disc pl-5">
              {failed.map((account) => (
                <li key={account.id}>
                  {PLATFORM_LABEL[account.platform]} · {account.name ?? account.adAccount}: {account.lastSyncError}
                </li>
              ))}
            </ul>
            <p className="mt-1.5">Cifrele de mai jos sunt cele de la ultima citire reușită.</p>
          </div>
        </InlineNote>
      ) : null}
      {calls.missing ? (
        <InlineNote tone="apricot">
          <p className="font-medium">Coloana „Apeluri notate” e goală.</p>
          <p className="mt-1">{calls.missing}</p>
        </InlineNote>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <KpiTiles
          current={current}
          previous={before}
          against={AGAINST[selection.period]}
          periodLabel={PERIOD_SHORT[selection.period]}
          emptyHint={
            noConversions
              ? "Conturile n-au conversii configurate, deci nimic nu se numără ca rezultat."
              : "Alege în panoul fiecărei campanii ce se numără ca rezultat (apel, lead sau formular)."
          }
        />
        <HouseRule>Din portal poți doar pune pe pauză, adăuga negative și acțiuni de conversie. Nu există buton de pornire, de ștergere sau de buget.</HouseRule>
      </div>

      <CampaignsScreen
        key={`${client.id}|${selection.channel}`}
        entities={entities}
        totals={totals}
        previous={previous}
        accounts={accounts}
        channel={selection.channel}
        range={selection.range}
        calls={calls.counts}
        callsHref={`/admin/ads/apeluri?${query}`}
        actions={{ pause: pauseAction, days: entityDaysAction, setResult: setResultAction }}
      />
    </div>
  );
}
