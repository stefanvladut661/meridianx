import { redirect } from "next/navigation";
import { getAdminUser, isAuthConfigured } from "@/lib/supabase/clients";
import { readSettings } from "@/lib/postari/setari";
import { TopbarSelectors } from "@/components/panou/layout/shell-context";
import { dateTimeRo } from "@/components/panou/ui/format";
import { PostariSelectors } from "@/components/panou/postari/module-selectors";
import { QueueBanner } from "@/components/panou/postari/queue-actions";
import { SetupNotice } from "../_components/setup-notice";
import { setQueueAction } from "./actions";

/**
 * Garda modulului de postări (aceeași autentificare ca restul adminului), filtrul
 * de platformă în bara de sus și, pe orice ecran, bannerul cozii oprite cu
 * „Pornește coada”. Cadrul e în layout-ul comun al adminului.
 */
export default async function PostariLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  if (!isAuthConfigured()) return <SetupNotice />;
  const user = await getAdminUser();
  if (!user) redirect("/admin/login");

  const settings = await readSettings();
  const stopped = settings.ok && !settings.data.coadaPornita ? settings.data : null;

  return (
    <>
      <TopbarSelectors>
        <PostariSelectors />
      </TopbarSelectors>
      {stopped ? (
        <QueueBanner reason={stopped.coadaMotiv} by={stopped.coadaSchimbataDe} at={stopped.coadaSchimbataLa ? dateTimeRo(stopped.coadaSchimbataLa) : null} setQueue={setQueueAction} />
      ) : null}
      {children}
    </>
  );
}
