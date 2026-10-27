import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getAdminUser, isAuthConfigured } from "@/lib/supabase/clients";
import { listClients } from "@/lib/firma/clienti";
import { FirmaSidebar } from "@/components/firma/sidebar";
import { FirmaMobileNav } from "@/components/firma/mobile-nav";
import { FirmaTopBar } from "@/components/firma/top-bar";
import { signOut } from "../login/actions";
import { SessionKeeper } from "../_components/session-keeper";
import { SetupNotice } from "../_components/setup-notice";
// Tema albă a portalului de reclame, folosită așa cum e (clasa `.ads-portal`).
import "../ads/portal.css";

/**
 * Garda și cadrul adminului firmei. Aceeași autentificare ca lead-urile și
 * reclamele: `isAuthConfigured()` → `getAdminUser()` (Google + lista de
 * admini) → altfel /admin/login. Același cadru ca portalul de reclame: meniu
 * în stânga, bara de sus cu luna și clientul, apoi ecranul.
 */
export default async function FirmaLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  if (!isAuthConfigured()) return <SetupNotice />;
  const user = await getAdminUser();
  if (!user) redirect("/admin/login");

  const clients = await listClients();
  const barClients = clients.ok ? clients.data.map((client) => ({ id: client.id, nume: client.nume })) : [];

  return (
    <div className="ads-portal relative min-h-dvh">
      <SessionKeeper />
      <a href="#continut" className="skip-link">
        Sari la conținut
      </a>
      <div className="lg:grid lg:min-h-dvh lg:grid-cols-[228px_minmax(0,1fr)]">
        <FirmaSidebar email={user.email} signOut={signOut} />
        <div className="flex min-h-dvh min-w-0 flex-col">
          <Suspense fallback={<div className="h-[53px] border-b border-hair" />}>
            <FirmaTopBar clients={barClients} />
          </Suspense>
          <div id="continut" className="relative flex-1 pb-20 lg:pb-0">
            {children}
          </div>
        </div>
      </div>
      <FirmaMobileNav signOut={signOut} />
    </div>
  );
}
