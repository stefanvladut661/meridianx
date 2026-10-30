import { redirect } from "next/navigation";
import { getAdminUser, isAuthConfigured } from "@/lib/supabase/clients";
import { currentWorkspaceId, listWorkspaces } from "@/lib/ads/workspaces.server";
import { clientsForRequest } from "@/lib/ads/model/read";
import { selectionFromCookie } from "@/lib/ads/model/selection.server";
import { PanouShell } from "@/components/panou/layout/shell";
import { HydrateWhenParsed } from "@/components/panou/ads/hydrate-when-parsed";
import { OnlyOnSearchTools } from "@/components/panou/ads/only-on-search-tools";
import { AdsSelectors, type AdsSelectorClient } from "@/components/panou/ads/selectors";
// Doar uneltele Google încă nerefăcute în noul design mai au nevoie de banda veche cu spațiul de lucru.
import { WorkspaceRail } from "@/components/ads/workspace-rail";
import { LegacyStrip } from "@/components/ads/legacy-strip";
import { signOut } from "../login/actions";
import { SessionKeeper } from "../_components/session-keeper";
import { SetupNotice } from "../_components/setup-notice";
import { chooseWorkspace } from "./actions";
import { rememberSelectionAction } from "./v2-actions";
import "./portal.css";

/**
 * Garda și cadrul portalului de reclame (v2).
 *
 * ACELAȘI mecanism de autentificare ca panoul de lead-uri: `isAuthConfigured()`
 * → `getAdminUser()` (sesiune Supabase deschisă cu Google + lista
 * `ADMIN_EMAILS`) → altfel /admin/login.
 *
 * Cadrul e cel comun al panoului (`PanouShell`): meniul de module în stânga și
 * bara de sus, în care stau selectoarele modulului — clientul, canalul și
 * perioada (`AdsSelectors`). Tot ce e dedesubt se schimbă după ele.
 */
export default async function AdsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  if (!isAuthConfigured()) return <SetupNotice />;

  const user = await getAdminUser();
  if (!user) redirect("/admin/login");

  const workspaces = listWorkspaces();
  const currentId = await currentWorkspaceId();
  const [clients, saved] = await Promise.all([clientsForRequest(), selectionFromCookie()]);

  const selectorClients: AdsSelectorClient[] = clients.ok
    ? clients.data.map((client) => ({
        id: client.id,
        name: client.name,
        owner: client.owner,
        platforms: [...new Set(client.accounts.map((account) => account.platform))],
      }))
    : [];

  return (
    // Hidratarea așteaptă sfârșitul citirii paginii — vezi hydrate-when-parsed.tsx.
    <HydrateWhenParsed>
      <SessionKeeper />
      <PanouShell
        email={user.email}
        signOut={signOut}
        selectors={<AdsSelectors clients={selectorClients} saved={saved} remember={rememberSelectionAction} />}
        banner={
          <OnlyOnSearchTools>
            <div className="mb-4 overflow-hidden rounded-[22px] border border-white/[0.07]">
              <LegacyStrip rail={<WorkspaceRail workspaces={workspaces} currentId={currentId} action={chooseWorkspace} />} />
            </div>
          </OnlyOnSearchTools>
        }
      >
        {children}
      </PanouShell>
    </HydrateWhenParsed>
  );
}
