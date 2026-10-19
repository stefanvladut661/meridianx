import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/supabase/clients";
import { currentWorkspaceId, listWorkspaces } from "@/lib/ads/workspaces.server";
import { findWorkspace } from "@/lib/ads/workspaces";
import { serviceAccountEmail } from "@/lib/ads/google/api";
import { describeGoogleError } from "@/lib/ads/google/errors";
import { findGoogleAccount, listGoogleAccounts } from "@/lib/ads/google/lookup";
import { accountHeader, readAccountCampaigns, readAudit, readNegativeLists } from "@/lib/ads/google/account/read";
import { listChanges } from "@/lib/ads/changes";
import { portalCampaignIds } from "@/lib/ads/store";
import { AccountCampaigns } from "@/components/ads/account-campaigns";
import { AccountNegatives } from "@/components/ads/account-negatives";
import { AccountAudit } from "@/components/ads/account-audit";
import { AccountJournal } from "@/components/ads/account-journal";
import { AccountChooser, formatCustomerId } from "@/components/ads/account-chooser";
import { cn } from "@/lib/utils";
import { addAccountNegatives, pauseAccountCampaigns, previewAccountNegatives } from "../actions";

export const metadata: Metadata = {
  title: "Contul Google — MERIDIAN Reclame",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const VIEWS = [
  { id: "campanii", label: "Campanii" },
  { id: "negative", label: "Negative" },
  { id: "audit", label: "Audit" },
] as const;
type View = (typeof VIEWS)[number]["id"];

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-8 max-w-2xl rounded-panel-lg border border-[#f0b429]/30 bg-[#f0b429]/[0.04] px-5 py-4 text-[14.5px] leading-relaxed text-bone/85">
      {children}
    </div>
  );
}

/**
 * /admin/ads/cont — întreținerea unui cont Google existent: campaniile lui în
 * toate stările (cu pauza), negativele pe campanii existente (și legarea
 * listelor comune), auditul (cine a schimbat ce, cine are acces, facturarea,
 * conversiile). Citirile sunt GAQL; scrierile trec prin gărzile din faza 9.
 */
export default async function AccountPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await getAdminUser();
  if (!user) redirect("/admin/login");

  const params = await searchParams;
  const workspaces = listWorkspaces();
  const currentId = await currentWorkspaceId();
  const summary = workspaces.find((item) => item.id === currentId) ?? workspaces[0];
  const workspace = findWorkspace(currentId);
  const accountParam = typeof params.cont === "string" ? params.cont.replace(/[\s-]/g, "") : "";
  const view: View = VIEWS.some((item) => item.id === params.vedere) ? (params.vedere as View) : "campanii";

  const header = (
    <>
      <p className="eyebrow">Reclame · Google</p>
      <h1 className="display mt-2 text-[2.25rem] text-bone sm:text-[2.75rem]">Contul</h1>
      <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-bone/70">
        Un cont Google Ads existent, cum e azi: toate campaniile, cu ce au cheltuit; pauza; negativele pe campaniile
        care rulează; cine a schimbat ce și cine are acces. Portalul nu pornește nimic și nu modifică bugete.
      </p>
    </>
  );

  if (!workspace || workspace.platform !== "google") {
    return (
      <main className="mx-auto max-w-[1400px] px-4 pb-24 pt-8 sm:px-8 sm:pt-10">
        {header}
        <Notice>Lucrezi în {summary.name}. Contul se întreține doar în spațiile Google: treci în Meridian · Google sau Clienți · Google din selectorul de sus.</Notice>
      </main>
    );
  }
  if (!summary.tokenConfigured) {
    return (
      <main className="mx-auto max-w-[1400px] px-4 pb-24 pt-8 sm:px-8 sm:pt-10">
        {header}
        <Notice>
          Spațiul {summary.name} nu are cheie: setează {summary.tokenEnv} în Vercel și fă redeploy. Pașii: lib/ads/README.md → „Google — contul de serviciu”.
        </Notice>
      </main>
    );
  }

  // Conturile pe care le vede cheia — pentru alegere.
  let accounts: Array<{ id: string; name: string; currency: string; state: string }> = [];
  let accountsError: string | null = null;
  try {
    accounts = (await listGoogleAccounts(workspace)).map((item) => ({ id: item.info.id, name: item.info.name, currency: item.info.currency, state: item.info.state }));
  } catch (error) {
    accountsError = describeGoogleError(error, "lista de conturi", workspace.tokenEnv);
  }

  const chooser = <AccountChooser action="/admin/ads/cont" value={accountParam} accounts={accounts} hidden={{ vedere: view }} />;

  if (!accountParam) {
    return (
      <main className="mx-auto max-w-[1400px] px-4 pb-24 pt-8 sm:px-8 sm:pt-10">
        {header}
        {chooser}
        {accountsError ? <Notice>{accountsError}</Notice> : null}
        {accounts.length > 0 ? (
          <ul className="mt-6 grid gap-px overflow-hidden rounded-panel-lg border border-hair bg-hair sm:grid-cols-2 xl:grid-cols-3">
            {accounts.map((item) => (
              <li key={item.id} className="bg-char">
                <Link href={`/admin/ads/cont?cont=${item.id}`} className="block px-5 py-4 hover:bg-glass">
                  <span className="block text-[15px] font-semibold text-bone">{item.name}</span>
                  <span className="mt-1 block font-md-mono text-[12px] text-dim">
                    {formatCustomerId(item.id)} · {item.currency} · {item.state}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : !accountsError ? (
          <Notice>
            Cheia nu vede încă niciun cont. Adaugă contul de serviciu {serviceAccountEmail(workspace) ?? ""} ca utilizator în contul clientului sau
            în MCC-ul agenției (README → „Faza 11”), apoi revino aici.
          </Notice>
        ) : null}
      </main>
    );
  }

  const account = await findGoogleAccount(workspace, accountParam).catch(() => null);
  if (!account || account.manager) {
    return (
      <main className="mx-auto max-w-[1400px] px-4 pb-24 pt-8 sm:px-8 sm:pt-10">
        {header}
        {chooser}
        <Notice>
          {account?.manager
            ? `${account.info.name} e un cont manager (MCC). Alege contul clientului de sub el.`
            : `Cheia spațiului nu vede contul ${accountParam}. Adaugă contul de serviciu ${serviceAccountEmail(workspace) ?? ""} în contul clientului sau în MCC-ul de deasupra lui (Admin → Acces și securitate).`}
        </Notice>
      </main>
    );
  }

  const info = accountHeader(account);
  const portalIds = await portalCampaignIds(account.info.id);
  let campaigns: Awaited<ReturnType<typeof readAccountCampaigns>> = [];
  let campaignsError: string | null = null;
  try {
    campaigns = await readAccountCampaigns(workspace, account, portalIds);
  } catch (error) {
    campaignsError = describeGoogleError(error, "campaniile contului", workspace.tokenEnv);
  }
  const knownAdmins = [...(process.env.ADMIN_EMAILS ?? "").split(","), serviceAccountEmail(workspace) ?? ""].map((item) => item.trim()).filter(Boolean);
  const [audit, lists, journal] = await Promise.all([
    view === "audit" ? readAudit(workspace, account, { knownAdmins, campaigns, currency: info.currency }) : Promise.resolve(null),
    view === "negative" ? readNegativeLists(workspace, account).catch(() => []) : Promise.resolve([]),
    listChanges(account.info.id, 20),
  ]);

  return (
    <main className="mx-auto max-w-[1400px] px-4 pb-24 pt-8 sm:px-8 sm:pt-10">
      {header}
      {chooser}

      <section aria-labelledby="cont-titlu" className="mt-8">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
          <h2 id="cont-titlu" className="font-md-display text-[1.625rem] font-semibold leading-tight text-bone">
            {info.name}
          </h2>
          <p className="font-md-mono text-[12px] text-dim">
            {formatCustomerId(info.id)} · {info.currency} · {info.state} ·{" "}
            {info.manager ? `văzut prin managerul ${formatCustomerId(info.manager)}` : "văzut direct"}
          </p>
        </div>

        <nav aria-label="Vederile contului" className="mt-5 flex gap-1 overflow-x-auto border-b border-hair [scrollbar-width:none]">
          {VIEWS.map((item) => (
            <Link
              key={item.id}
              href={`/admin/ads/cont?cont=${info.id}&vedere=${item.id}`}
              aria-current={view === item.id ? "page" : undefined}
              className={cn(
                "-mb-px shrink-0 whitespace-nowrap border-b-2 px-3 py-2.5 text-[14px] font-medium transition-colors duration-150",
                view === item.id ? "border-bone text-bone" : "border-transparent text-dim hover:text-bone"
              )}
            >
              {item.label}
            </Link>
          ))}
          {[
            { href: `/admin/ads/termeni?cont=${info.id}`, label: "Termeni" },
            { href: `/admin/ads/conversii?cont=${info.id}`, label: "Conversii" },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="-mb-px shrink-0 whitespace-nowrap border-b-2 border-transparent px-3 py-2.5 text-[14px] font-medium text-dim hover:text-bone"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </section>

      {campaignsError ? <Notice>{campaignsError}</Notice> : null}

      <div className="mt-8">
        {view === "campanii" ? (
          <AccountCampaigns
            workspace={workspace.id}
            account={info}
            campaigns={campaigns}
            pause={pauseAccountCampaigns}
          />
        ) : null}
        {view === "negative" ? (
          <AccountNegatives
            workspace={workspace.id}
            account={info}
            campaigns={campaigns.filter((item) => item.type === "SEARCH" && item.status !== "REMOVED")}
            lists={lists}
            preview={previewAccountNegatives}
            add={addAccountNegatives}
          />
        ) : null}
        {view === "audit" && audit ? <AccountAudit audit={audit} currency={info.currency} campaigns={campaigns} /> : null}
      </div>

      <div className="mt-14">
        <AccountJournal journal={journal} />
      </div>
    </main>
  );
}
