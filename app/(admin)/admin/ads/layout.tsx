import { redirect } from "next/navigation";
import { getAdminUser, isAuthConfigured } from "@/lib/supabase/clients";
import { currentWorkspaceId, listWorkspaces } from "@/lib/ads/workspaces.server";
import { clientsForRequest } from "@/lib/ads/model/read";
import { selectionFromCookie } from "@/lib/ads/model/selection.server";
import { WorkspaceRail } from "@/components/ads/workspace-rail";
import { HydrateWhenParsed } from "@/components/ads/hydrate-when-parsed";
import { Sidebar } from "@/components/ads/sidebar";
import { MobileNav } from "@/components/ads/mobile-nav";
import { TopBar, type TopBarClient } from "@/components/ads/top-bar";
import { LegacyStrip } from "@/components/ads/legacy-strip";
import { signOut } from "../login/actions";
import { SessionKeeper } from "../_components/session-keeper";
import { SetupNotice } from "../_components/setup-notice";
import { chooseWorkspace } from "./actions";
import { rememberSelectionAction } from "./v2-actions";
import { syncClientAction } from "./clienti/actions";
import "./portal.css";

/**
 * Garda și cadrul portalului de reclame (v2).
 *
 * ACELAȘI mecanism de autentificare ca panoul de lead-uri: `isAuthConfigured()`
 * → `getAdminUser()` (sesiune Supabase deschisă cu Google + lista
 * `ADMIN_EMAILS`) → altfel /admin/login.
 *
 * Cadrul, ca în Meta Ads Manager: meniul îngust în stânga, bara de sus cu
 * clientul, perioada și canalul, apoi ecranul. Tema albă vine din `portal.css`
 * (variabilele sistemului de design, doar sub `.ads-portal`).
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

  const barClients: TopBarClient[] = clients.ok
    ? clients.data.map((client) => ({
        id: client.id,
        name: client.name,
        owner: client.owner,
        platforms: [...new Set(client.accounts.map((account) => account.platform))],
        lastSyncedAt: client.accounts.map((account) => account.lastSyncedAt).filter((value): value is string => Boolean(value)).sort().at(-1) ?? null,
        failedAccounts: client.accounts.filter((account) => account.syncEnabled && account.lastSyncStatus === "failed").length,
      }))
    : [];
  const current = barClients.find((client) => client.id === saved.clientId) ?? barClients[0] ?? null;
  // „Căutări” e doar pe Google: apare când clientul are un cont Google și canalul îl include.
  const googleTools = (saved.channel === "toate" || saved.channel === "google") && (current ? current.platforms.includes("google") : true);

  return (
    // Hidratarea așteaptă sfârșitul citirii paginii — vezi hydrate-when-parsed.tsx.
    <HydrateWhenParsed>
      <div className="ads-portal relative min-h-dvh">
        <SessionKeeper />
        <a href="#continut" className="skip-link">
          Sari la conținut
        </a>

        <div className="lg:grid lg:min-h-dvh lg:grid-cols-[228px_minmax(0,1fr)]">
          <Sidebar email={user.email} googleTools={googleTools} signOut={signOut} />
          <div className="flex min-h-dvh min-w-0 flex-col">
            <TopBar clients={barClients} saved={saved} remember={rememberSelectionAction} sync={syncClientAction} />
            <LegacyStrip rail={<WorkspaceRail workspaces={workspaces} currentId={currentId} action={chooseWorkspace} />} />
            <div id="continut" className="relative flex-1 pb-20 lg:pb-0">
              {children}
            </div>
          </div>
        </div>

        <MobileNav googleTools={googleTools} signOut={signOut} />
      </div>
    </HydrateWhenParsed>
  );
}
