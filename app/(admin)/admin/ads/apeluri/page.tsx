import type { Metadata } from "next";
import Link from "next/link";
import { Building2 } from "lucide-react";
import { clientsForRequest } from "@/lib/ads/model/read";
import { readSelection } from "@/lib/ads/model/selection.server";
import { CHANNEL_LABEL, PERIOD_LABEL } from "@/lib/ads/model/selection";
import { CALLS_MIGRATION_MISSING, campaignChoices, readCalls } from "@/lib/ads/model/calls";
import { todayInBucharest } from "@/lib/ads/metrics";
import { ApeluriScreen, type CallCampaign } from "@/components/panou/ads/apeluri-screen";
import { btnClass, Card } from "@/components/panou/ui/primitives";
import { EmptyState, ErrorState } from "@/components/panou/ui/states";
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

  if (!clients.ok || clients.data.length === 0) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-[22px] font-semibold leading-none sm:text-[26px]">Apeluri</h1>
          <p className="mt-2 max-w-2xl text-[12.5px] text-muted-foreground">
            Apelurile venite de pe reclame, notate de mână. Platformele știu doar că cineva a apăsat „Sună”; ce a ieșit din apel știi tu.
          </p>
        </div>
        <Card className="p-0">
          {clients.ok ? (
            <EmptyState
              icon={Building2}
              title="Niciun client încă"
              text="Un apel se notează la un client. Adaugă-l întâi, cu conturile lui."
              action={
                <Link href="/admin/ads/clienti" className={btnClass({ variant: "primary", size: "sm" })}>
                  Adaugă primul client
                </Link>
              }
            />
          ) : (
            <ErrorState title="Clienții nu se pot citi" text={clients.message} />
          )}
        </Card>
      </div>
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
    <div className="space-y-4">
      {!calls.ok && !missing ? <ErrorState title="Apelurile nu se pot citi" text={calls.message} className="rounded-[22px] border border-rose/20" /> : null}
      <ApeluriScreen
        key={client.id}
        clients={clients.data.map((item) => ({ id: item.id, name: item.name }))}
        campaigns={choices}
        calls={calls.ok ? calls.data : []}
        defaults={{ clientId: client.id, channel: platform, today: todayInBucharest() }}
        scope={{ client: client.name, period: PERIOD_LABEL[selection.period], channel: platform ? CHANNEL_LABEL[platform] : null }}
        missing={missing}
        actions={{ add: addCallAction, remove: deleteCallAction }}
      />
    </div>
  );
}
