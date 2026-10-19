import type { Metadata } from "next";
import Link from "next/link";
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
import { AccountChooser, formatCustomerId } from "@/components/ads/account-chooser";
import { TermsView } from "@/components/ads/terms-view";
import { cn } from "@/lib/utils";
import { addTermNegatives, previewTermNegatives, saveTermRules, syncTermsNow } from "../actions";

export const metadata: Metadata = {
  title: "Termeni de căutare — MERIDIAN Reclame",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-8 max-w-2xl rounded-panel-lg border border-[#f0b429]/30 bg-[#f0b429]/[0.04] px-5 py-4 text-[14.5px] leading-relaxed text-bone/85">
      {children}
    </div>
  );
}

/**
 * /admin/ads/termeni — ce au căutat oamenii înainte să vadă anunțurile, pe
 * ultimele 7 sau 30 de zile, din sincronizarea zilnică (nu direct din Google).
 * Sus, propunerile de negative după regulile contului; omul bifează,
 * previzualizează (conflicte + `validateOnly`) și abia apoi adaugă.
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

  const header = (
    <>
      <p className="eyebrow">Reclame · Google</p>
      <h1 className="display mt-2 text-[2.25rem] text-bone sm:text-[2.75rem]">Termeni de căutare</h1>
      <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-bone/70">
        Ce au scris oamenii în Google înainte să vadă anunțurile. Portalul propune negative după regulile contului —
        cuvinte de exclus, cost fără conversii, căutări care țin de altă campanie — și nu adaugă nimic fără bifa ta.
      </p>
    </>
  );

  if (!workspace || workspace.platform !== "google" || !summary.tokenConfigured) {
    return (
      <main className="mx-auto max-w-[1400px] px-4 pb-24 pt-8 sm:px-8 sm:pt-10">
        {header}
        <Notice>
          {workspace?.platform === "google"
            ? `Spațiul ${summary.name} nu are cheie: setează ${summary.tokenEnv} în Vercel.`
            : `Lucrezi în ${summary.name}. Termenii de căutare sunt doar pe Google: treci în Meridian · Google sau Clienți · Google.`}
        </Notice>
      </main>
    );
  }

  let accounts: Array<{ id: string; name: string; currency: string }> = [];
  try {
    accounts = (await listGoogleAccounts(workspace)).map((item) => ({ id: item.info.id, name: item.info.name, currency: item.info.currency }));
  } catch {
    /* alegerea merge și scriind id-ul */
  }
  const chooser = <AccountChooser action="/admin/ads/termeni" value={accountParam} accounts={accounts} hidden={{ perioada: String(days) }} />;

  if (!accountParam) {
    return (
      <main className="mx-auto max-w-[1400px] px-4 pb-24 pt-8 sm:px-8 sm:pt-10">
        {header}
        {chooser}
      </main>
    );
  }

  const account = await findGoogleAccount(workspace, accountParam).catch(() => null);
  if (!account || account.manager) {
    return (
      <main className="mx-auto max-w-[1400px] px-4 pb-24 pt-8 sm:px-8 sm:pt-10">
        {header}
        {chooser}
        <Notice>{account?.manager ? `${account.info.name} e un cont manager; alege contul clientului.` : `Cheia spațiului nu vede contul ${accountParam}.`}</Notice>
      </main>
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
  const base = `/admin/ads/termeni?cont=${info.id}`;

  return (
    <main className="mx-auto max-w-[1400px] px-4 pb-24 pt-8 sm:px-8 sm:pt-10">
      {header}
      {chooser}

      <section aria-labelledby="termeni-cont" className="mt-8">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
          <h2 id="termeni-cont" className="font-md-display text-[1.625rem] font-semibold leading-tight text-bone">
            {info.name}
          </h2>
          <p className="font-md-mono text-[12px] text-dim">
            {formatCustomerId(info.id)} · {info.currency} ·{" "}
            <Link href={`/admin/ads/cont?cont=${info.id}`} className="underline underline-offset-4 hover:text-bone">
              Contul
            </Link>
          </p>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <span className="eyebrow !text-[11px]">Perioada</span>
          {[7, 30].map((value) => (
            <Link
              key={value}
              href={`${base}&perioada=${value}${campaignFilter ? `&campanie=${campaignFilter}` : ""}`}
              aria-current={days === value ? "page" : undefined}
              className={cn("rounded-full border px-3 py-1.5 text-[13px]", days === value ? "border-bone/60 bg-glass text-bone" : "border-hair text-dim hover:text-bone")}
            >
              ultimele {value} zile
            </Link>
          ))}
          <span className="mx-2 hidden h-4 w-px bg-hair-strong sm:block" aria-hidden />
          <span className="eyebrow !text-[11px]">Campania</span>
          <Link
            href={`${base}&perioada=${days}`}
            aria-current={!campaignFilter ? "page" : undefined}
            className={cn("rounded-full border px-3 py-1.5 text-[13px]", !campaignFilter ? "border-bone/60 bg-glass text-bone" : "border-hair text-dim hover:text-bone")}
          >
            toate
          </Link>
          {campaigns.map((item) => (
            <Link
              key={item.id}
              href={`${base}&perioada=${days}&campanie=${item.id}`}
              aria-current={campaignFilter === item.id ? "page" : undefined}
              className={cn(
                "max-w-[16rem] truncate rounded-full border px-3 py-1.5 text-[13px]",
                campaignFilter === item.id ? "border-bone/60 bg-glass text-bone" : "border-hair text-dim hover:text-bone"
              )}
            >
              {item.name}
            </Link>
          ))}
        </div>
      </section>

      {googleError ? <Notice>{googleError}</Notice> : null}
      {!terms.ok ? <Notice>{STORE_FAILURE_MESSAGE[terms.reason]}</Notice> : null}

      <div className="mt-8">
        <TermsView
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
    </main>
  );
}
