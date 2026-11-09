import type { Metadata } from "next";
import Link from "next/link";
import { Megaphone, Plus } from "lucide-react";
import { clientsForRequest, readClientView } from "@/lib/ads/model/read";
import { readSelection } from "@/lib/ads/model/selection.server";
import { selectionQuery } from "@/lib/ads/model/selection";
import { callCountsByCampaign } from "@/lib/ads/model/calls";
import { rowFigures, totalsByCurrency } from "@/lib/ads/model/rows";
import { PLATFORM_LABEL } from "@/lib/ads/constants";
import { KpiTiles } from "@/components/panou/ads/kpi-tiles";
import { CampaignsScreen } from "@/components/panou/ads/campaigns-screen";
import { HouseRule } from "@/components/panou/ads/house-rule";
import { SyncBar } from "@/components/panou/ads/sync-bar";
import { PAGE_TITLE } from "@/components/panou/ads/tone";
import { Card, Pill, btnClass } from "@/components/panou/ui/primitives";
import { EmptyState, ErrorState } from "@/components/panou/ui/states";
import { InlineNote } from "@/components/panou/ui/actions";
import { syncClientAction } from "./clienti/actions";
import { entityDaysAction, pauseAction, setResultAction } from "./v2-actions";
import { requireAdmin } from "../_components/require-admin";

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

/**
 * /admin/ads — ecranul principal, ca în Meta Ads Manager: patru cifre mari,
 * apoi filele Campanii / Grupuri / Reclame și tabelul, pe clientul, perioada și
 * canalul alese sus. Citește doar din bază (sincronizarea zilnică + „Sincronizează”).
 */
export default async function AdsCampaignsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const params = await searchParams;
  const selection = await readSelection(params);
  const clients = await clientsForRequest();

  const header = (actions?: React.ReactNode) => (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="flex items-center gap-2.5">
        <h1 className={PAGE_TITLE}>Campanii</h1>
        <Pill tone="apricot">doar pe pauză</Pill>
      </div>
      {actions}
    </div>
  );

  if (!clients.ok) {
    return (
      <div className="space-y-4">
        {header()}
        <Card padded={false}>
          <ErrorState title="Clienții nu se pot citi" text={clients.message} />
        </Card>
      </div>
    );
  }

  if (clients.data.length === 0) {
    return (
      <div className="space-y-4">
        {header()}
        <Card padded={false}>
          <EmptyState
            icon={Megaphone}
            title="Niciun client încă"
            action={
              <Link href="/admin/ads/clienti" className={btnClass({ variant: "primary", size: "sm" })}>
                Adaugă client
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
        {header(actions)}
        <Card padded={false}>
          <ErrorState title="Cifrele nu se pot citi" text={view.message} />
        </Card>
      </div>
    );
  }

  const { accounts, entities, totals, previous } = view.data;
  if (accounts.length === 0) {
    return (
      <div className="space-y-4">
        {header(actions)}
        <Card padded={false}>
          <EmptyState
            icon={Megaphone}
            title={selection.channel === "toate" ? `${client.name} n-are încă niciun cont legat` : `${client.name} n-are cont ${PLATFORM_LABEL[selection.channel]}`}
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
      {header(actions)}

      {neverSynced.length > 0 ? (
        <InlineNote tone="apricot">
          <p>
            <span className="font-medium">
              {neverSynced.length === accounts.length
                ? "Conturile n-au fost citite încă."
                : `${neverSynced.length === 1 ? "Un cont n-a" : `${neverSynced.length} conturi n-au`} fost citit${neverSynced.length === 1 ? "" : "e"} încă.`}
            </span>{" "}
            Apasă „Sincronizează”.
          </p>
        </InlineNote>
      ) : null}
      {failed.length > 0 ? (
        <InlineNote tone="rose">
          <div role="alert">
            <p className="font-medium">{failed.length === 1 ? "Un cont n-a putut fi citit." : `${failed.length} conturi n-au putut fi citite.`}</p>
            <ul className="mt-1 list-disc pl-5">
              {failed.map((account) => (
                <li key={account.id}>
                  {PLATFORM_LABEL[account.platform]} · {account.name ?? account.adAccount}: {account.lastSyncError}
                </li>
              ))}
            </ul>
            <p className="mt-1.5">Cifrele sunt de la ultima citire reușită.</p>
          </div>
        </InlineNote>
      ) : null}
      {calls.missing ? (
        <InlineNote tone="apricot">
          <p className="font-medium">Coloana „Apeluri” e goală.</p>
          <p className="mt-1">{calls.missing}</p>
        </InlineNote>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <KpiTiles
          current={current}
          previous={before}
          against={AGAINST[selection.period]}
          emptyHint={noConversions ? "Conturile n-au conversii configurate." : "Alege rezultatul în panoul fiecărei campanii."}
        />
        <HouseRule>Doar pauză, negative și conversii. Fără pornire, ștergere sau buget.</HouseRule>
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
