import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/supabase/clients";
import { listWorkspaces } from "@/lib/ads/workspaces.server";
import { listClients } from "@/lib/ads/model/store";
import { ClientiScreen } from "@/components/panou/ads/clienti-screen";
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
    <ClientiScreen
      clients={clients.ok ? clients.data : []}
      failure={clients.ok ? null : clients.message}
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
  );
}
