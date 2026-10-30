import { redirect } from "next/navigation";
import { getAdminUser, isAuthConfigured } from "@/lib/supabase/clients";
import { readSettings } from "@/lib/postari/setari";
import { PanouShell } from "@/components/panou/shell";
import { PostariTopBar } from "@/components/postari/top-bar";
import { signOut } from "../login/actions";
import { SessionKeeper } from "../_components/session-keeper";
import { SetupNotice } from "../_components/setup-notice";
// Tema panoului (dark, lavandă), din portalul de reclame.
import "../ads/portal.css";

/**
 * Garda și cadrul modulului de postări. Aceeași autentificare ca restul
 * adminului: `isAuthConfigured()` → `getAdminUser()` (Google + lista de
 * admini) → altfel /admin/login. Cadrul e cel comun al panoului: meniu în
 * stânga, bara de sus (cu starea cozii), apoi ecranul.
 */
export default async function PostariLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  if (!isAuthConfigured()) return <SetupNotice />;
  const user = await getAdminUser();
  if (!user) redirect("/admin/login");

  const settings = await readSettings();
  const queue = settings.ok ? { running: settings.data.coadaPornita, reason: settings.data.coadaMotiv } : null;

  return (
    <>
      <SessionKeeper />
      <PanouShell email={user.email} signOut={signOut} topBar={<PostariTopBar queue={queue} />}>
        {children}
      </PanouShell>
    </>
  );
}
