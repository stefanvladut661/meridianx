import type { Metadata } from "next";
import { listAccounts } from "@/lib/firma/accese";
import { todayIso } from "@/lib/firma/format";
import { AccountsScreen } from "@/components/firma/accounts-screen";
import { Notice, PageHead } from "@/components/firma/ui";
import { addStarterAction, deleteAccountAction, saveAccountAction } from "./actions";

export const metadata: Metadata = { title: "Accese — MERIDIAN Firmă", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** /admin/firma/accese — conturile firmei: cine are acces, 2FA, unde e parola, abonamentul, reînnoirea. */
export default async function AccesePage() {
  const accounts = await listAccounts();
  return (
    <main className="px-4 pb-16 pt-6 sm:px-6">
      <PageHead title="Accese" subtitle="Conturile firmei: cine are acces, dacă au 2FA, unde e parola și când se reînnoiesc. Parolele stau în managerul de parole — aici nu se scriu." />
      {!accounts.ok ? (
        <Notice tone="error" className="mt-5">
          {accounts.message}
        </Notice>
      ) : (
        <AccountsScreen accounts={accounts.data} today={todayIso()} actions={{ save: saveAccountAction, remove: deleteAccountAction, starter: addStarterAction }} />
      )}
    </main>
  );
}
