import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getAdminUser, isAuthConfigured } from "@/lib/supabase/clients";
import { listClients } from "@/lib/firma/clienti";
import { PanouShell } from "@/components/panou/shell";
import { FirmaTopBar } from "@/components/firma/top-bar";
import { signOut } from "../login/actions";
import { SessionKeeper } from "../_components/session-keeper";
import { SetupNotice } from "../_components/setup-notice";
// Tema panoului (dark, lavandă), din portalul de reclame.
import "../ads/portal.css";

/**
 * Garda și cadrul adminului firmei. Aceeași autentificare ca lead-urile și
 * reclamele: `isAuthConfigured()` → `getAdminUser()` (Google + lista de
 * admini) → altfel /admin/login. Cadrul e cel comun al panoului: meniu în
 * stânga, bara de sus cu luna și clientul, apoi ecranul.
 */
export default async function FirmaLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  if (!isAuthConfigured()) return <SetupNotice />;
  const user = await getAdminUser();
  if (!user) redirect("/admin/login");

  const clients = await listClients();
  const barClients = clients.ok ? clients.data.map((client) => ({ id: client.id, nume: client.nume })) : [];

  return (
    <>
      <SessionKeeper />
      <PanouShell
        email={user.email}
        signOut={signOut}
        topBar={
          <Suspense fallback={<div className="h-[53px] border-b border-hair" />}>
            <FirmaTopBar clients={barClients} />
          </Suspense>
        }
      >
        {children}
      </PanouShell>
    </>
  );
}
