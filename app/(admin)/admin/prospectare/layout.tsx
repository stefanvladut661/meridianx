import { redirect } from "next/navigation";
import { getAdminUser, isAuthConfigured } from "@/lib/supabase/clients";
import { PanouShell } from "@/components/panou/layout/shell";
import { signOut } from "../login/actions";
import { SessionKeeper } from "../_components/session-keeper";
import { SetupNotice } from "../_components/setup-notice";
// Tema veche a portalului: rădăcina cadrului mai poartă `ads-portal` pentru ecranele nerefăcute.
import "../ads/portal.css";

/**
 * Garda și cadrul modulului Prospectare: aceeași autentificare ca restul
 * adminului (`getAdminUser()`: Google + ADMIN_EMAILS), altfel /admin/login.
 * Datele se citesc pe server, cu cheia de service, doar după gardă.
 */
export default async function ProspectareLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  if (!isAuthConfigured()) return <SetupNotice />;
  const user = await getAdminUser();
  if (!user) redirect("/admin/login");

  return (
    <>
      <SessionKeeper />
      <PanouShell email={user.email} signOut={signOut}>
        {children}
      </PanouShell>
    </>
  );
}
