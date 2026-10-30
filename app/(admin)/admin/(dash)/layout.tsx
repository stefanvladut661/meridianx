import { redirect } from "next/navigation";
import { getAdminUser, isAuthConfigured } from "@/lib/supabase/clients";
import { PanouShell } from "@/components/panou/layout/shell";
import { signOut } from "../login/actions";
import { SessionKeeper } from "../_components/session-keeper";
import { LeadsSetupScreen } from "@/components/panou/leads/setup-card";
// Tema panoului (dark, lavandă), din portalul de reclame.
import "../ads/portal.css";

/**
 * Garda zonei protejate (FAZA 6).
 *
 * Grupul `(dash)` nu apare în URL, deci `/admin` rămâne `/admin`, dar tot
 * ce e sub el trece pe aici. `/admin/login` stă în afara grupului, deci nu
 * se autoredirectează.
 *
 * `getAdminUser()` folosește `getUser()`, care validează tokenul la
 * Supabase — nu are încredere în cookie-ul local.
 *
 * Ordinea contează: fără Supabase configurat, redirectul spre login ar
 * duce la un formular care nu are cum să reușească. Un drum înfundat cu
 * un câmp de parolă e mai rău decât o eroare — deci arătăm instrucțiunile
 * de instalare, nu login-ul.
 *
 * Cadrul e cel comun al panoului (redesign): meniul de module în stânga,
 * în loc de bara de sus cu linkuri pe care o avea panoul de lead-uri.
 * Lead-urile nu au selectoare în bara de sus: filtrele sunt în ecran, în URL.
 */
export default async function AdminDashLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  if (!isAuthConfigured()) return <LeadsSetupScreen />;

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
