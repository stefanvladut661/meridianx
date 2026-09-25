import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminUser, isAuthConfigured } from "@/lib/supabase/clients";
import { currentWorkspaceId, listWorkspaces } from "@/lib/ads/workspaces.server";
import { Mark } from "@/components/site/mark";
import { WorkspaceRail } from "@/components/ads/workspace-rail";
import { AdsNav } from "@/components/ads/ads-nav";
import { HydrateWhenParsed } from "@/components/ads/hydrate-when-parsed";
import { signOut } from "../login/actions";
import { SessionKeeper } from "../_components/session-keeper";
import { SetupNotice } from "../_components/setup-notice";
import { chooseWorkspace } from "./actions";

/**
 * Garda și capul portalului de reclame.
 *
 * ACELAȘI mecanism de autentificare ca panoul de lead-uri, nu altul:
 * `isAuthConfigured()` → `getAdminUser()` (sesiune Supabase validată la
 * server + lista `ADMIN_EMAILS`) → redirect la /admin/login. Portalul stă
 * în afara grupului `(dash)` doar ca să aibă capul lui, cu selectorul de
 * spațiu de lucru mereu vizibil.
 *
 * Capul are două rânduri: marca și navigarea, apoi spațiul de lucru. Al
 * doilea rând e lipit sus împreună cu primul — oriunde ai derula, vezi în
 * ce portofoliu ești.
 */
export default async function AdsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  if (!isAuthConfigured()) return <SetupNotice />;

  const user = await getAdminUser();
  if (!user) redirect("/admin/login");

  const workspaces = listWorkspaces();
  const currentId = await currentWorkspaceId();

  return (
    // Hidratarea așteaptă sfârșitul citirii paginii — vezi hydrate-when-parsed.tsx.
    <HydrateWhenParsed>
      <div className="relative min-h-dvh">
        <SessionKeeper />

        <a href="#continut" className="skip-link">
          Sari la conținut
        </a>

        <header className="sticky top-0 z-30 border-b border-hair bg-ink/90 backdrop-blur-md">
          <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-2.5 px-4 sm:gap-4 sm:px-8">
            <Link href="/admin/ads" className="flex shrink-0 items-center gap-2.5 text-bone">
              <Mark size={22} />
              <span className="hidden font-md-display text-[15px] font-semibold tracking-[0.2em] min-[420px]:inline">
                MERIDIAN
              </span>
            </Link>

            <span aria-hidden className="hidden h-4 w-px shrink-0 bg-hair-strong sm:block" />
            <AdsNav />

            <div className="ml-auto flex shrink-0 items-center gap-4">
              <Link
                href="/admin"
                className="hidden text-[13px] text-dim underline-offset-4 hover:text-bone hover:underline md:inline"
              >
                Lead-uri
              </Link>
              <span className="hidden font-md-mono text-[11px] tracking-wide text-dim lg:inline">
                {user.email}
              </span>
              <form action={signOut}>
                <button type="submit" className="btn btn-ghost !min-h-9 !px-4 !py-2 !text-[12.5px]">
                  Ieși
                </button>
              </form>
            </div>
          </div>

          <div className="border-t border-hair bg-char/70">
            <div className="mx-auto max-w-[1400px] px-4 py-2.5 sm:px-8">
              <WorkspaceRail workspaces={workspaces} currentId={currentId} action={chooseWorkspace} />
            </div>
          </div>
        </header>

        <div id="continut" className="relative">
          {children}
        </div>
      </div>
    </HydrateWhenParsed>
  );
}
