import type { Metadata } from "next";
import { readHistory } from "@/lib/ads/model/history";
import { clientsForRequest } from "@/lib/ads/model/read";
import { IstoricScreen, type IstoricFilter } from "@/components/panou/ads/istoric-screen";

export const metadata: Metadata = {
  title: "Istoric — MERIDIAN Reclame",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const FILTERS: IstoricFilter[] = ["toate", "create", "change", "sync"];

/**
 * /admin/ads/istoric — ce a făcut portalul: campaniile create pe pauză, pauzele
 * și modificările pe conturi, actualizările cifrelor (cu problemele lor).
 * Filtrul `?tip=` rămâne în adresă.
 */
export default async function HistoryPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const filter = FILTERS.find((item) => item === params.tip) ?? "toate";
  const [history, clients] = await Promise.all([readHistory(), clientsForRequest()]);

  const owners: Record<string, string> = {};
  if (clients.ok) for (const client of clients.data) for (const account of client.accounts) owners[account.adAccount] = `${client.name} · ${account.name ?? account.adAccount}`;

  const events = history.ok ? history.data.events.filter((event) => filter === "toate" || event.kind === filter) : [];

  return <IstoricScreen filter={filter} events={events} owners={owners} missing={history.ok ? history.data.missing : []} failure={history.ok ? null : history.message} />;
}
