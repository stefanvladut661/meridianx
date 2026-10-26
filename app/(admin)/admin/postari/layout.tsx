import { redirect } from "next/navigation";
import { getAdminUser, isAuthConfigured } from "@/lib/supabase/clients";
import { readSettings } from "@/lib/postari/setari";
import { PostariSidebar } from "@/components/postari/sidebar";
import { PostariMobileNav } from "@/components/postari/mobile-nav";
import { PostariTopBar } from "@/components/postari/top-bar";
import { signOut } from "../login/actions";
import { SessionKeeper } from "../_components/session-keeper";
import { SetupNotice } from "../_components/setup-notice";
// Tema albă a portalului de reclame, folosită așa cum e (clasa `.ads-portal`), ca la firmă.
import "../ads/portal.css";

/**
 * Garda și cadrul modulului de postări. Aceeași autentificare ca restul
 * adminului: `isAuthConfigured()` → `getAdminUser()` (Google + lista de
 * admini) → altfel /admin/login. Același cadru ca adminul firmei: meniu în
 * stânga, bara de sus (cu starea cozii), apoi ecranul.
 */
export default async function PostariLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  if (!isAuthConfigured()) return <SetupNotice />;
  const user = await getAdminUser();
  if (!user) redirect("/admin/login");

  const settings = await readSettings();
  const queue = settings.ok ? { running: settings.data.coadaPornita, reason: settings.data.coadaMotiv } : null;

  return (
    <div className="ads-portal relative min-h-dvh">
      <SessionKeeper />
      <a href="#continut" className="skip-link">
        Sari la conținut
      </a>
      <div className="lg:grid lg:min-h-dvh lg:grid-cols-[228px_minmax(0,1fr)]">
        <PostariSidebar email={user.email} signOut={signOut} />
        <div className="flex min-h-dvh min-w-0 flex-col">
          <PostariTopBar queue={queue} />
          <div id="continut" className="relative flex-1 pb-20 lg:pb-0">
            {children}
          </div>
        </div>
      </div>
      <PostariMobileNav signOut={signOut} />
    </div>
  );
}
