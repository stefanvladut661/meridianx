import { redirect } from "next/navigation";
import { getAdminUser, isAuthConfigured } from "@/lib/supabase/clients";
import { clientsForRequest } from "@/lib/ads/model/read";
import { selectionFromCookie } from "@/lib/ads/model/selection.server";
import { TopbarSelectors } from "@/components/panou/layout/shell-context";
import { HydrateWhenParsed } from "@/components/panou/ads/hydrate-when-parsed";
import { AdsSelectors, type AdsSelectorClient } from "@/components/panou/ads/selectors";
import { SetupNotice } from "../_components/setup-notice";
import { rememberSelectionAction } from "./v2-actions";

/**
 * Garda portalului de reclame și selectoarele lui din bara de sus.
 *
 * ACELAȘI mecanism de autentificare ca restul adminului: `isAuthConfigured()`
 * → `getAdminUser()` (sesiune Supabase deschisă cu Google + lista
 * `ADMIN_EMAILS`) → altfel /admin/login.
 *
 * Selectoarele — clientul, canalul și perioada (`AdsSelectors`) — ajung în bara
 * de sus a cadrului comun printr-un portal. Tot ce e dedesubt se schimbă după
 * ele. Spațiul de lucru al uneltelor Google (Meridian / Clienți) se alege în
 * capul filelor Căutări, nu aici.
 */
export default async function AdsLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  if (!isAuthConfigured()) return <SetupNotice />;

  const user = await getAdminUser();
  if (!user) redirect("/admin/login");

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
      <TopbarSelectors>
        <AdsSelectors clients={selectorClients} saved={saved} remember={rememberSelectionAction} />
      </TopbarSelectors>
      {children}
    </HydrateWhenParsed>
  );
}
