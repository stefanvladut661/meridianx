import type { Metadata } from "next";
import { listClients } from "@/lib/firma/clienti";
import { currentMonth, isMonth } from "@/lib/firma/format";
import { isOblioConfigured } from "@/lib/firma/oblio/api";
import { clientsForRequest } from "@/lib/ads/model/read";
import { ClientsScreen } from "@/components/firma/clients-screen";
import { Notice, PageHead } from "@/components/firma/ui";
import { addContactAction, archiveClientAction, deleteContactAction, linkAdsAction, saveClientAction, saveContractAction, searchOblioAction } from "./actions";

export const metadata: Metadata = { title: "Clienți — MERIDIAN Firmă", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * /admin/firma/clienti — clienții firmei, cu persoanele de contact,
 * contractele (prețul pe perioade, emiterea, scadența) și legătura cu
 * clientul din portalul de reclame.
 */
export default async function ClientiPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const month = typeof params.luna === "string" && isMonth(params.luna) ? params.luna : currentMonth();
  const showArchived = params.arhiva === "1";
  const [clients, ads] = await Promise.all([listClients({ includeArchived: showArchived }), clientsForRequest()]);
  const adsClients = ads.ok ? ads.data.map((client) => ({ id: client.id, name: client.name })) : [];

  return (
    <main className="px-4 pb-16 pt-6 sm:px-6">
      <PageHead title="Clienți" subtitle="Datele firmei, persoanele de contact și contractele: abonamentul pe perioade, ziua emiterii și scadența. Bugetul de reclame e doar recomandat — nu se facturează." />
      {!clients.ok ? (
        <Notice tone="error" className="mt-5">
          {clients.message}
        </Notice>
      ) : (
        <ClientsScreen
          clients={clients.data}
          adsClients={adsClients}
          month={month}
          showArchived={showArchived}
          oblio={isOblioConfigured()}
          initialOpen={typeof params.rand === "string" ? params.rand : null}
          actions={{
            saveClient: saveClientAction,
            archiveClient: archiveClientAction,
            addContact: addContactAction,
            deleteContact: deleteContactAction,
            saveContract: saveContractAction,
            linkAds: linkAdsAction,
            searchOblio: searchOblioAction,
          }}
        />
      )}
    </main>
  );
}
