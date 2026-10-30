import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/supabase/clients";
import { currentWorkspaceId, listWorkspaces } from "@/lib/ads/workspaces.server";
import { findWorkspace } from "@/lib/ads/workspaces";
import { addDays, todayInBucharest } from "@/lib/ads/metrics";
import { describeGoogleError } from "@/lib/ads/google/errors";
import { findGoogleAccount, listGoogleAccounts } from "@/lib/ads/google/lookup";
import { accountHeader, readAccountCampaigns, readNegativeLists, readPositiveKeywords } from "@/lib/ads/google/account/read";
import { buildProposals } from "@/lib/ads/google/terms/proposals";
import { DEFAULT_COST_THRESHOLD } from "@/lib/ads/google/terms/defaults";
import { STORE_FAILURE_MESSAGE, portalCampaignIds } from "@/lib/ads/store";
import { readRules, readTerms } from "@/lib/ads/terms-store";
import { CautariHeader, ContHeadline, ContPicker } from "@/components/panou/ads/cautari-shell";
import { CautariTermeni } from "@/components/panou/ads/cautari-termeni";
import { CautariTermeniFiltre } from "@/components/panou/ads/cautari-termeni-filtre";
import { InlineNote } from "@/components/panou/ui/actions";
import { addTermNegatives, previewTermNegatives, saveTermRules, syncTermsNow } from "../actions";

export const metadata: Metadata = {
  title: "Termeni de căutare — MERIDIAN Reclame",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * /admin/ads/termeni — ce au căutat oamenii înainte să vadă anunțurile, pe
 * ultimele 7 sau 30 de zile, din sincronizarea zilnică (nu direct din Google).
 * Sus, propunerile de negative după regulile contului; omul bifează (sau
 * marchează un termen din tabel), previzualizează (conflicte + `validateOnly`)
 * și abia apoi adaugă.
 */
export default async function TermsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await getAdminUser();
  if (!user) redirect("/admin/login");

  const params = await searchParams;
  const workspaces = listWorkspaces();
  const currentId = await currentWorkspaceId();
  const summary = workspaces.find((item) => item.id === currentId) ?? workspaces[0];
  const workspace = findWorkspace(currentId);
  const accountParam = typeof params.cont === "string" ? params.cont.replace(/[\s-]/g, "") : "";
  const days = params.perioada === "30" ? 30 : 7;
  const campaignFilter = typeof params.campanie === "string" && /^\d+$/.test(params.campanie) ? params.campanie : null;

  const header = <CautariHeader active="termeni" cont={accountParam || null} workspaces={workspaces} currentWorkspaceId={currentId} />;

  if (!workspace || workspace.platform !== "google" || !summary.tokenConfigured) {
    return (
      <div className="space-y-4">
        {header}
        <InlineNote className="max-w-2xl">
          {workspace?.platform === "google"
            ? `Spațiul ${summary.name} nu are cheie: setează ${summary.tokenEnv} în Vercel.`
            : `Lucrezi în ${summary.name}. Termenii de căutare sunt doar pe Google: treci în Meridian · Google sau Clienți · Google din selectorul „Spațiu” de mai sus.`}
        </InlineNote>
      </div>
    );
  }

  let accounts: Array<{ id: string; name: string; currency: string }> = [];
  try {
    accounts = (await listGoogleAccounts(workspace)).map((item) => ({ id: item.info.id, name: item.info.name, currency: item.info.currency }));
  } catch {
    /* alegerea merge și scriind id-ul */
  }
  const picker = <ContPicker action="/admin/ads/termeni" value={accountParam} accounts={accounts} hidden={{ perioada: String(days) }} />;

  if (!accountParam) {
    return (
      <div className="space-y-4">
        {header}
        {picker}
      </div>
    );
  }

  const account = await findGoogleAccount(workspace, accountParam).catch(() => null);
  if (!account || account.manager) {
    return (
      <div className="space-y-4">
        {header}
        {picker}
        <InlineNote className="max-w-2xl">{account?.manager ? `${account.info.name} e un cont manager; alege contul clientului.` : `Cheia spațiului nu vede contul ${accountParam}.`}</InlineNote>
      </div>
    );
  }

  const info = accountHeader(account);
  const to = todayInBucharest();
  const from = addDays(to, -(days - 1));
  const [terms, rules] = await Promise.all([readTerms(info.id, from, to), readRules(info.id)]);

  let googleError: string | null = null;
  let campaigns: Awaited<ReturnType<typeof readAccountCampaigns>> = [];
  let lists: Awaited<ReturnType<typeof readNegativeLists>> = [];
  let positives = new Map<string, Array<{ text: string; match: "broad" | "phrase" | "exact" }>>();
  try {
    campaigns = (await readAccountCampaigns(workspace, account, await portalCampaignIds(info.id))).filter((item) => item.type === "SEARCH" && item.status !== "REMOVED");
    [lists, positives] = await Promise.all([readNegativeLists(workspace, account), readPositiveKeywords(workspace, account, campaigns.map((item) => item.id))]);
  } catch (error) {
    googleError = describeGoogleError(error, "campaniile și cuvintele cheie ale contului", workspace.tokenEnv);
  }

  const termRows = terms.ok ? terms.data.filter((row) => !campaignFilter || row.campaignId === campaignFilter) : [];
  const excludeWords = rules.ok ? (rules.data?.excludeWords ?? []) : [];
  const costThreshold = rules.ok && rules.data ? rules.data.costThreshold : (DEFAULT_COST_THRESHOLD[info.currency] ?? 20);
  const proposals = buildProposals({
    terms: termRows,
    excludeWords,
    costThreshold,
    positives: Object.fromEntries([...positives.entries()].map(([id, list]) => [id, list.map((item) => ({ text: item.text, match: item.match }))])),
    campaignNames: Object.fromEntries(campaigns.map((item) => [item.id, item.name])),
  });

  return (
    <div className="space-y-4">
      {header}
      {picker}

      <ContHeadline
        info={info}
        hint="Ce au scris oamenii în Google înainte să vadă anunțurile. Portalul propune negative după regulile contului și nu adaugă nimic fără bifa ta."
      >
        <CautariTermeniFiltre
          base={`/admin/ads/termeni?cont=${info.id}`}
          days={days}
          campaignId={campaignFilter}
          campaigns={campaigns.map((item) => ({ id: item.id, name: item.name }))}
        />
      </ContHeadline>

      {googleError ? <InlineNote className="max-w-2xl">{googleError}</InlineNote> : null}
      {!terms.ok ? <InlineNote className="max-w-2xl">{STORE_FAILURE_MESSAGE[terms.reason]}</InlineNote> : null}

      <CautariTermeni
        workspace={workspace.id}
        account={info}
        period={{ from, to, days }}
        terms={termRows}
        proposals={proposals}
        lists={lists}
        rules={{
          excludeWords,
          costThreshold,
          syncEnabled: rules.ok ? (rules.data?.syncEnabled ?? true) : true,
          lastSyncedAt: rules.ok ? (rules.data?.lastSyncedAt ?? null) : null,
          lastSyncError: rules.ok ? (rules.data?.lastSyncError ?? null) : null,
          updatedByEmail: rules.ok ? (rules.data?.updatedByEmail ?? null) : null,
          exists: rules.ok && rules.data !== null,
        }}
        actions={{ sync: syncTermsNow, saveRules: saveTermRules, preview: previewTermNegatives, add: addTermNegatives }}
      />
    </div>
  );
}
