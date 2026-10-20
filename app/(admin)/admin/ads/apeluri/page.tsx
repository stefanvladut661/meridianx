import type { Metadata } from "next";
import Link from "next/link";
import { clientsForRequest } from "@/lib/ads/model/read";
import { readSelection } from "@/lib/ads/model/selection.server";
import { CHANNEL_LABEL, PERIOD_LABEL } from "@/lib/ads/model/selection";
import { CALLS_MIGRATION_MISSING, campaignChoices, readCalls } from "@/lib/ads/model/calls";
import { todayInBucharest } from "@/lib/ads/metrics";
import { CallsScreen, type CallCampaign } from "@/components/ads/calls-screen";
import { addCallAction, deleteCallAction } from "./actions";

export const metadata: Metadata = {
  title: "Apeluri — MERIDIAN Reclame",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * /admin/ads/apeluri — apelurile venite de pe reclame, notate de mână: ziua,
 * clientul, canalul, campania (dacă se știe) și ce a ieșit. Lista urmează
 * clientul, perioada și canalul din bara de sus; în Campanii, numărul lor stă
 * lângă „Rezultate”.
 */
export default async function CallsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const selection = await readSelection(params);
  const clients = await clientsForRequest();

  const header = (
    <div>
      <h1 className="text-[1.5rem] font-semibold tracking-tight text-bone">Apeluri</h1>
      <p className="mt-0.5 max-w-2xl text-[13.5px] text-dim">
        Apelurile venite de pe reclame, notate de mână. Platformele știu doar că cineva a apăsat „Sună”; ce a ieșit din apel știi tu.
      </p>
    </div>
  );

  if (!clients.ok || clients.data.length === 0) {
    return (
      <main className="px-4 pb-16 pt-6 sm:px-6">
        {header}
        <div role={clients.ok ? undefined : "alert"} className="mt-6 max-w-2xl rounded-xl border border-hair bg-[var(--ap-side)] px-5 py-4 text-[14px] text-bone/85">
          {clients.ok ? (
            <>
              <p className="text-[15px] font-semibold text-bone">Niciun client încă.</p>
              <p className="mt-1">Un apel se notează la un client. Adaugă-l întâi, cu conturile lui.</p>
              <Link href="/admin/ads/clienti" className="btn btn-light mt-4 !min-h-10 !px-4 !py-2 !text-[14px]">
                Adaugă primul client
              </Link>
            </>
          ) : (
            <p className="text-[var(--ap-error)]">{clients.message}</p>
          )}
        </div>
      </main>
    );
  }

  const client = clients.data.find((item) => item.id === selection.clientId) ?? clients.data[0];
  const platform = selection.channel === "toate" ? null : selection.channel;
  const accountOwner = new Map(clients.data.flatMap((item) => item.accounts.map((account) => [account.id, item.id] as const)));
  const [calls, campaigns] = await Promise.all([
    readCalls({ clientId: client.id, from: selection.range.from, to: selection.range.to, platform }),
    campaignChoices([...accountOwner.keys()]),
  ]);

  const missing = !calls.ok && calls.message === CALLS_MIGRATION_MISSING ? calls.message : null;
  const choices: CallCampaign[] = campaigns.ok
    ? campaigns.data.map((campaign) => ({ id: campaign.id, name: campaign.name, platform: campaign.platform, clientId: accountOwner.get(campaign.accountId) ?? "", removed: campaign.removed }))
    : [];

  return (
    <main className="px-4 pb-16 pt-6 sm:px-6">
      {header}
      {!calls.ok && !missing ? (
        <p role="alert" className="mt-4 max-w-2xl text-[14px] text-[var(--ap-error)]">
          Apelurile nu se pot citi. {calls.message}
        </p>
      ) : null}
      <CallsScreen
        key={client.id}
        clients={clients.data.map((item) => ({ id: item.id, name: item.name }))}
        campaigns={choices}
        calls={calls.ok ? calls.data : []}
        defaults={{ clientId: client.id, channel: platform, today: todayInBucharest() }}
        scope={{ client: client.name, period: PERIOD_LABEL[selection.period], channel: platform ? CHANNEL_LABEL[platform] : null }}
        missing={missing}
        actions={{ add: addCallAction, remove: deleteCallAction }}
      />
    </main>
  );
}
