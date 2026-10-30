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
import { accountMoney } from "@/lib/ads/google/account/labels";
import { listChanges } from "@/lib/ads/changes";
import { portalCampaignIds } from "@/lib/ads/store";
import { CautariContAudit } from "@/components/panou/ads/cautari-cont-audit";
import { CautariContCampanii } from "@/components/panou/ads/cautari-cont-campanii";
import { CautariContJurnal } from "@/components/panou/ads/cautari-cont-jurnal";
import { CautariContNegative } from "@/components/panou/ads/cautari-cont-negative";
import { CautariHeader, ContHeadline, ContPicker, formatCustomerId } from "@/components/panou/ads/cautari-shell";
import { InlineNote } from "@/components/panou/ui/actions";
import { Stat } from "@/components/panou/ui/primitives";
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

/**
 * /admin/ads/cont — întreținerea unui cont Google existent: campaniile lui în
 * toate stările (cu pauza), negativele pe campanii existente (și legarea
 * listelor comune), auditul (cine a schimbat ce, cine are acces, facturarea,
 * conversiile). Citirile sunt GAQL; scrierile trec prin gărzile din faza 9.
 * Pe un cont existent portalul face doar pauză, negative și acțiuni de
 * conversie: niciun buton nu pornește, nu șterge și nu schimbă bugete.
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
  const campaignParam = typeof params.campanie === "string" && /^\d+$/.test(params.campanie) ? params.campanie : null;

  const header = <CautariHeader active="cont" cont={accountParam || null} workspaces={workspaces} currentWorkspaceId={currentId} />;

  if (!workspace || workspace.platform !== "google") {
    return (
      <div className="space-y-4">
        {header}
        <InlineNote className="max-w-2xl">
          Lucrezi în {summary.name}. Contul se întreține doar în spațiile Google: treci în Meridian · Google sau Clienți · Google din selectorul „Spațiu” de mai sus.
        </InlineNote>
      </div>
    );
  }
  if (!summary.tokenConfigured) {
    return (
      <div className="space-y-4">
        {header}
        <InlineNote className="max-w-2xl">
          Spațiul {summary.name} nu are cheie: setează {summary.tokenEnv} în Vercel și fă redeploy. Pașii: lib/ads/README.md → „Google — contul de serviciu”.
        </InlineNote>
      </div>
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

  const picker = <ContPicker action="/admin/ads/cont" value={accountParam} accounts={accounts} hidden={{ vedere: view }} />;

  if (!accountParam) {
    return (
      <div className="space-y-4">
        {header}
        {picker}
        {accountsError ? <InlineNote className="max-w-2xl">{accountsError}</InlineNote> : null}
        {accounts.length > 0 ? (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {accounts.map((item) => (
              <li key={item.id}>
                <Link href={`/admin/ads/cont?cont=${item.id}`} className="block h-full rounded-[22px] border border-white/[0.07] bg-card p-4 transition-colors hover:border-white/[0.16] hover:bg-white/[0.03]">
                  <span className="block text-[13.5px] font-medium">{item.name}</span>
                  <span className="mt-1 block font-mono text-[11px] text-muted-foreground">
                    {formatCustomerId(item.id)} · {item.currency} · {item.state}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : !accountsError ? (
          <InlineNote className="max-w-2xl">
            Cheia nu vede încă niciun cont. Adaugă contul de serviciu {serviceAccountEmail(workspace) ?? ""} ca utilizator în contul clientului sau în MCC-ul agenției (README → „Faza 11”), apoi revino aici.
          </InlineNote>
        ) : null}
      </div>
    );
  }

  const account = await findGoogleAccount(workspace, accountParam).catch(() => null);
  if (!account || account.manager) {
    return (
      <div className="space-y-4">
        {header}
        {picker}
        <InlineNote className="max-w-2xl">
          {account?.manager
            ? `${account.info.name} e un cont manager (MCC). Alege contul clientului de sub el.`
            : `Cheia spațiului nu vede contul ${accountParam}. Adaugă contul de serviciu ${serviceAccountEmail(workspace) ?? ""} în contul clientului sau în MCC-ul de deasupra lui (Admin → Acces și securitate).`}
        </InlineNote>
      </div>
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

  const searchCampaigns = campaigns.filter((item) => item.type === "SEARCH" && item.status !== "REMOVED");
  const active = campaigns.filter((item) => item.status === "ENABLED");
  const dailyBudget = active.reduce((sum, item) => sum + (item.budget ?? 0), 0);

  return (
    <div className="space-y-4">
      {header}
      {picker}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
        <div className="min-w-0 space-y-4">
          <ContHeadline
            info={info}
            hint={`Audit · cont existent, doar citire + pauză · ${info.state} · ${info.manager ? `văzut prin managerul ${formatCustomerId(info.manager)}` : "văzut direct"}`}
          >
            <div className="grid grid-cols-3 gap-3">
              <Stat label="Campanii" value={campaigns.length} />
              {audit ? <Stat label="Probleme" value={audit.signals.length} tone="dim" /> : <Stat label="Active" value={active.length} tone="dim" />}
              <Stat label="Buget / zi" value={accountMoney(dailyBudget, info.currency)} tone="dim" hint={active.length > 0 ? "doar campaniile active" : undefined} />
            </div>
          </ContHeadline>

          <nav aria-label="Vederile contului" className="pu-no-scrollbar inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-full border border-white/[0.07] bg-white/[0.03] p-1">
            {VIEWS.map((item) => (
              <Link
                key={item.id}
                href={`/admin/ads/cont?cont=${info.id}&vedere=${item.id}`}
                aria-current={view === item.id ? "page" : undefined}
                className={cn(
                  "shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-[11.5px] font-medium transition-colors",
                  view === item.id ? "bg-white/[0.11] text-foreground shadow-[0_1px_0_rgba(255,255,255,0.07)_inset]" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {campaignsError ? <InlineNote className="max-w-2xl">{campaignsError}</InlineNote> : null}

          {view === "campanii" ? <CautariContCampanii workspace={workspace.id} account={info} campaigns={campaigns} pause={pauseAccountCampaigns} /> : null}
          {view === "negative" ? (
            <CautariContNegative
              workspace={workspace.id}
              account={info}
              campaigns={searchCampaigns}
              lists={lists}
              initialCampaign={campaignParam}
              preview={previewAccountNegatives}
              add={addAccountNegatives}
            />
          ) : null}
          {view === "audit" && audit ? <CautariContAudit audit={audit} currency={info.currency} campaigns={campaigns} /> : null}
        </div>

        <CautariContJurnal journal={journal} />
      </div>
    </div>
  );
}
