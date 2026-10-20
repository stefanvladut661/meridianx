import type { Metadata } from "next";
import Link from "next/link";
import { clientsForRequest, readClientView } from "@/lib/ads/model/read";
import { readSelection } from "@/lib/ads/model/selection.server";
import { CHANNEL_LABEL, PERIOD_LABEL, selectionQuery } from "@/lib/ads/model/selection";
import { callCountsByCampaign } from "@/lib/ads/model/calls";
import { rowFigures, totalsByCurrency } from "@/lib/ads/model/rows";
import { PLATFORM_LABEL } from "@/lib/ads/constants";
import { KpiTiles } from "@/components/ads/kpi-tiles";
import { CampaignsScreen } from "@/components/ads/campaigns-screen";
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

function Notice({ title, children, tone = "info" }: { title: string; children: React.ReactNode; tone?: "info" | "error" }) {
  return (
    <div
      role={tone === "error" ? "alert" : undefined}
      className={
        tone === "error"
          ? "mt-6 max-w-2xl rounded-xl border border-[var(--ap-error)]/30 bg-[var(--ap-error-soft)] px-5 py-4"
          : "mt-6 max-w-2xl rounded-xl border border-hair bg-[var(--ap-side)] px-5 py-4"
      }
    >
      <p className={tone === "error" ? "text-[15px] font-semibold text-[var(--ap-error)]" : "text-[15px] font-semibold text-bone"}>{title}</p>
      <div className="mt-1.5 text-[14px] leading-relaxed text-bone/80">{children}</div>
    </div>
  );
}

/**
 * /admin/ads — ecranul principal v2, ca în Meta Ads Manager: patru cifre mari,
 * apoi filele Campanii / Grupuri / Reclame și tabelul, pe clientul, perioada și
 * canalul alese sus. Citește doar din bază (sincronizarea zilnică + „Actualizează”).
 */
export default async function AdsCampaignsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const selection = await readSelection(params);
  const clients = await clientsForRequest();

  const header = (subtitle?: string) => (
    <div className="flex flex-wrap items-end justify-between gap-2">
      <div>
        <h1 className="text-[1.5rem] font-semibold tracking-tight text-bone">Campanii</h1>
        {subtitle ? <p className="mt-0.5 text-[13.5px] text-dim">{subtitle}</p> : null}
      </div>
    </div>
  );

  if (!clients.ok) {
    return (
      <main className="px-4 pb-16 pt-6 sm:px-6">
        {header()}
        <Notice title="Clienții nu se pot citi." tone="error">
          {clients.message}
        </Notice>
      </main>
    );
  }

  if (clients.data.length === 0) {
    return (
      <main className="px-4 pb-16 pt-6 sm:px-6">
        {header()}
        <Notice title="Niciun client încă.">
          <p>
            Ecranul arată campaniile, grupurile și reclamele unui client, de pe Meta, Google și TikTok, în același tabel. Un client
            adună conturile lui: îl adaugi o dată, îi legi conturile, iar portalul îi aduce cifrele în fiecare dimineață.
          </p>
          <Link href="/admin/ads/clienti" className="btn btn-light mt-4 !min-h-10 !px-4 !py-2 !text-[14px]">
            Adaugă primul client
          </Link>
        </Notice>
      </main>
    );
  }

  const client = clients.data.find((item) => item.id === selection.clientId) ?? clients.data[0];
  const [view, calls] = await Promise.all([
    readClientView({ client, channel: selection.channel, range: selection.range }),
    callCountsByCampaign({ clientId: client.id, from: selection.range.from, to: selection.range.to }),
  ]);
  const subtitle = `${client.name} · ${PERIOD_LABEL[selection.period]} · ${CHANNEL_LABEL[selection.channel]}`;

  if (!view.ok) {
    return (
      <main className="px-4 pb-16 pt-6 sm:px-6">
        {header(subtitle)}
        <Notice title="Cifrele nu se pot citi." tone="error">
          {view.message}
        </Notice>
      </main>
    );
  }

  const { accounts, entities, totals, previous } = view.data;
  if (accounts.length === 0) {
    return (
      <main className="px-4 pb-16 pt-6 sm:px-6">
        {header(subtitle)}
        <Notice title={selection.channel === "toate" ? `${client.name} n-are încă niciun cont legat.` : `${client.name} n-are cont ${PLATFORM_LABEL[selection.channel]}.`}>
          <p>Leagă-i conturile din pagina Clienți: alegi contul din lista pe care o vede tokenul, apoi „Actualizează”.</p>
          <Link href="/admin/ads/clienti" className="btn btn-light mt-4 !min-h-10 !px-4 !py-2 !text-[14px]">
            Leagă un cont
          </Link>
        </Notice>
      </main>
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
    <main className="px-4 pb-16 pt-6 sm:px-6">
      {header(subtitle)}

      {neverSynced.length > 0 ? (
        <Notice title={neverSynced.length === accounts.length ? "Conturile n-au fost citite încă." : `${neverSynced.length === 1 ? "Un cont n-a" : `${neverSynced.length} conturi n-au`} fost citit${neverSynced.length === 1 ? "" : "e"} încă.`}>
          Apasă „Actualizează” în bara de sus: portalul citește campaniile, grupurile, reclamele și cifrele pe ultimele 90 de zile.
          De mâine, se actualizează singur în fiecare dimineață.
        </Notice>
      ) : null}
      {failed.length > 0 ? (
        <Notice title={failed.length === 1 ? "Un cont n-a putut fi citit la ultima actualizare." : `${failed.length} conturi n-au putut fi citite la ultima actualizare.`} tone="error">
          <ul className="list-disc pl-5">
            {failed.map((account) => (
              <li key={account.id}>
                {PLATFORM_LABEL[account.platform]} · {account.name ?? account.adAccount}: {account.lastSyncError}
              </li>
            ))}
          </ul>
          <p className="mt-1.5">Cifrele de mai jos sunt cele de la ultima citire reușită.</p>
        </Notice>
      ) : null}

      {calls.missing ? <Notice title="Coloana „Apeluri notate” e goală.">{calls.missing}</Notice> : null}

      <div className="mt-5">
        <KpiTiles
          current={current}
          previous={before}
          against={AGAINST[selection.period]}
          emptyHint={
            noConversions
              ? "Conturile n-au conversii configurate, deci nimic nu se numără ca rezultat."
              : "Alege în panoul fiecărei campanii ce se numără ca rezultat (apel, lead sau formular)."
          }
        />
      </div>

      <CampaignsScreen
        key={`${client.id}|${selection.channel}`}
        entities={entities}
        totals={totals}
        previous={previous}
        accounts={accounts}
        channel={selection.channel}
        range={selection.range}
        importHref="/admin/ads/nou"
        createHref={`/admin/ads/creeaza?${selectionQuery({ ...selection, clientId: client.id })}`}
        calls={calls.counts}
        callsHref={`/admin/ads/apeluri?${selectionQuery({ ...selection, clientId: client.id })}`}
        actions={{ pause: pauseAction, days: entityDaysAction, setResult: setResultAction }}
      />
    </main>
  );
}
