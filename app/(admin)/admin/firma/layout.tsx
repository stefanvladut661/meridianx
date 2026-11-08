import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getAdminUser, isAuthConfigured } from "@/lib/supabase/clients";
import { listClients } from "@/lib/firma/clienti";
import { FirmaTopBar } from "@/components/firma/top-bar";
import { SetupNotice } from "../_components/setup-notice";

/**
 * Garda adminului firmei (aceeași autentificare ca restul adminului) și bara cu
 * luna și clientul, deasupra ecranului. Cadrul e în layout-ul comun al adminului.
 */
export default async function FirmaLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  if (!isAuthConfigured()) return <SetupNotice />;
  const user = await getAdminUser();
  if (!user) redirect("/admin/login");

  const clients = await listClients();
  const barClients = clients.ok ? clients.data.map((client) => ({ id: client.id, nume: client.nume })) : [];

  return (
    <>
      <Suspense fallback={<div className="h-[53px] border-b border-hair" />}>
        <FirmaTopBar clients={barClients} />
      </Suspense>
      {children}
    </>
  );
}
