import { redirect } from "next/navigation";
import { getAdminUser, isAuthConfigured } from "@/lib/supabase/clients";
import { readSettings } from "@/lib/postari/setari";
import { PanouShell } from "@/components/panou/layout/shell";
import { dateTimeRo } from "@/components/panou/ui/format";
import { PostariSelectors } from "@/components/panou/postari/module-selectors";
import { QueueBanner } from "@/components/panou/postari/queue-actions";
import { signOut } from "../login/actions";
import { SessionKeeper } from "../_components/session-keeper";
import { SetupNotice } from "../_components/setup-notice";
import { setQueueAction } from "./actions";
// Tema veche a portalului: rădăcina cadrului mai poartă `ads-portal` pentru ecranele nerefăcute.
import "../ads/portal.css";

/**
 * Garda și cadrul modulului de postări. Aceeași autentificare ca restul
 * adminului: `isAuthConfigured()` → `getAdminUser()` (Google + lista de
 * admini) → altfel /admin/login. Cadrul e cel comun al panoului: meniu în
 * stânga, bara de sus cu filtrul de platformă, iar coada oprită se vede de pe
 * orice ecran, într-un banner cu „Pornește coada”.
 */
export default async function PostariLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  if (!isAuthConfigured()) return <SetupNotice />;
  const user = await getAdminUser();
  if (!user) redirect("/admin/login");

  const settings = await readSettings();
  const stopped = settings.ok && !settings.data.coadaPornita ? settings.data : null;

  return (
    <>
      <SessionKeeper />
      <PanouShell
        email={user.email}
        signOut={signOut}
        selectors={<PostariSelectors />}
        banner={
          stopped ? (
            <QueueBanner reason={stopped.coadaMotiv} by={stopped.coadaSchimbataDe} at={stopped.coadaSchimbataLa ? dateTimeRo(stopped.coadaSchimbataLa) : null} setQueue={setQueueAction} />
          ) : null
        }
      >
        {children}
      </PanouShell>
    </>
  );
}
