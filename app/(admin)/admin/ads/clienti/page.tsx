import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/supabase/clients";
import { listWorkspaces } from "@/lib/ads/workspaces.server";
import { listClients } from "@/lib/ads/model/store";
import { ClientsManager } from "@/components/ads/clients-manager";
import {
  addAccountAction,
  archiveClientAction,
  createClientAction,
  renameClientAction,
  setAccountSyncAction,
  syncClientAction,
  visibleAccountsAction,
} from "./actions";

export const metadata: Metadata = {
  title: "Clienți — MERIDIAN Reclame",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";
// „Actualizează acum” citește conturile clientului pe loc: până la un minut.
export const maxDuration = 60;

/**
 * /admin/ads/clienti — clienții portalului v2 și conturile lor de pe Meta,
 * Google și TikTok. Un client e doar un nume în Supabase care le adună; fiecare
 * cont trece în continuare prin spațiul lui de lucru (tokenul și plafonul).
 */
export default async function ClientsPage() {
  const user = await getAdminUser();
  if (!user) redirect("/admin/login");

  const clients = await listClients();
  const workspaces = listWorkspaces();

  return (
    <main className="mx-auto max-w-[1100px] px-4 pb-24 pt-8 sm:px-8 sm:pt-10">
      <p className="eyebrow">Reclame</p>
      <h1 className="display mt-2 text-[2.25rem] text-bone sm:text-[2.75rem]">Clienți</h1>
      <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-bone/70">
        Un client adună conturile lui de pe Meta, Google și TikTok. Portalul le citește în fiecare dimineață — campaniile,
        grupurile, reclamele și cifrele pe zi — și nu schimbă nimic în ele.
      </p>

      {clients.ok ? (
        <ClientsManager
          clients={clients.data}
          workspaces={workspaces}
          actions={{
            create: createClientAction,
            rename: renameClientAction,
            archive: archiveClientAction,
            visible: visibleAccountsAction,
            addAccount: addAccountAction,
            setSync: setAccountSyncAction,
            sync: syncClientAction,
          }}
        />
      ) : (
        <div role="alert" className="mt-8 max-w-2xl rounded-panel-lg border border-[#d93025]/35 bg-[#d93025]/[0.05] px-5 py-4">
          <p className="text-[15px] font-semibold text-[var(--ap-error)]">Clienții nu se pot citi.</p>
          <p className="mt-1.5 text-[14px] leading-relaxed text-bone/80">{clients.message}</p>
        </div>
      )}
    </main>
  );
}
