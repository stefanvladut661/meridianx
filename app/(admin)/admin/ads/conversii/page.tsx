import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/supabase/clients";
import { currentWorkspaceId, listWorkspaces } from "@/lib/ads/workspaces.server";
import { findWorkspace } from "@/lib/ads/workspaces";
import { describeGoogleError } from "@/lib/ads/google/errors";
import { findGoogleAccount, listGoogleAccounts } from "@/lib/ads/google/lookup";
import { accountHeader } from "@/lib/ads/google/account/read";
import { readConversionSetup } from "@/lib/ads/google/conversions/read";
import { LEAD_ACTIONS, LEAD_KINDS, type LeadKind } from "@/lib/ads/google/conversions/standard";
import type { ConversionSetup } from "@/lib/ads/google/conversions/types";
import { CopyButton, InlineNote } from "@/components/panou/ui/actions";
import { Pill } from "@/components/panou/ui/primitives";
import { CautariHeader, ContHeadline, ContPicker, formatCustomerId } from "@/components/panou/ads/cautari-shell";
import { ConversiiCreare } from "@/components/panou/ads/cautari-conversii";
import { ConversiiLista } from "@/components/panou/ads/cautari-conversii-lista";
import { ConversiiPasi } from "@/components/panou/ads/cautari-conversii-pasi";
import { GtmExport } from "@/components/panou/ads/cautari-gtm";
import { createConversionActions, previewConversionActions } from "../actions";

export const metadata: Metadata = {
  title: "Conversii — MERIDIAN Reclame",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const OWNER_LABEL: Record<ConversionSetup["owner"], string> = {
  self: "contul însuși",
  manager: "un cont manager",
  none: "nimeni încă — prima acțiune pornește urmărirea",
  unknown: "necunoscut",
};

/** Pe fel: o acțiune activă de același tip (și, la formular, aceeași categorie) deja în cont. */
function existingFor(setup: ConversionSetup): Record<LeadKind, string | null> {
  return Object.fromEntries(
    LEAD_KINDS.map((kind) => {
      const spec = LEAD_ACTIONS[kind];
      const twin = setup.actions.find(
        (action) => action.status === "ENABLED" && action.type === spec.type && (spec.type !== "WEBPAGE" || action.category === spec.defaultCategory)
      );
      return [kind, twin?.name ?? null];
    })
  ) as Record<LeadKind, string | null>;
}

/** O căsuță din rândul de sus al contului: eticheta mică și valoarea. */
function Tile({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-xl border border-white/[0.07] bg-white/[0.02] px-3.5 py-3">
      <p className="text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <div className="mt-1.5 text-[12.5px] leading-snug">{children}</div>
    </div>
  );
}

/**
 * /admin/ads/conversii — ce numără contul ca lead. Acțiunile din cont (cu
 * eticheta AW-…/… a fiecăreia), crearea celor standard care lipsesc (apel din
 * anunț, clic pe telefon, formular) și fișierul de import pentru Google Tag
 * Manager. Ce nu se poate face din API — raportarea apelurilor, publicarea în
 * GTM — e scris pe pagină, ca pași.
 */
export default async function ConversionsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await getAdminUser();
  if (!user) redirect("/admin/login");

  const params = await searchParams;
  const workspaces = listWorkspaces();
  const currentId = await currentWorkspaceId();
  const summary = workspaces.find((item) => item.id === currentId) ?? workspaces[0];
  const workspace = findWorkspace(currentId);
  const accountParam = typeof params.cont === "string" ? params.cont.replace(/[\s-]/g, "") : "";

  const header = <CautariHeader active="conversii" cont={accountParam || null} workspaces={workspaces} currentWorkspaceId={currentId} />;

  if (!workspace || workspace.platform !== "google" || !summary.tokenConfigured) {
    return (
      <div className="space-y-4">
        {header}
        <InlineNote className="max-w-2xl">
          {workspace?.platform === "google"
            ? `Spațiul ${summary.name} nu are cheie: setează ${summary.tokenEnv} în Vercel.`
            : `Lucrezi în ${summary.name}. Conversiile se fac aici doar pe Google: treci în Meridian · Google sau Clienți · Google.`}
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
  const picker = <ContPicker action="/admin/ads/conversii" value={accountParam} accounts={accounts} />;

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
  let setup: ConversionSetup | null = null;
  let googleError: string | null = null;
  try {
    setup = await readConversionSetup(workspace, account);
  } catch (error) {
    googleError = describeGoogleError(error, "acțiunile de conversie ale contului", workspace.tokenEnv);
  }
  const blocked = setup?.conversionAccount
    ? `Conversiile contului se gestionează în contul ${formatCustomerId(setup.conversionAccount)} (urmărirea conversiilor între conturi, din manager). Acolo se creează acțiunile noi, în Google Ads — portalul creează doar în contul clientului.`
    : null;
  const calls = setup?.actions.filter((action) => action.type === "AD_CALL" && action.status === "ENABLED") ?? [];
  const callReportingOn = Boolean(setup?.callReporting.enabled && setup?.callReporting.conversions);

  return (
    <div className="space-y-4">
      {header}
      {picker}

      <ContHeadline
        info={info}
        hint="cont existent · portalul creează doar acțiuni de conversie, nu schimbă bugete și nu șterge nimic"
      >
        {setup ? (
          <div className="grid gap-3 sm:grid-cols-3">
            <Tile label="Id-ul de urmărire">
              {setup.trackingId ? (
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[12.5px]">AW-{setup.trackingId}</span>
                  <CopyButton value={`AW-${setup.trackingId}`} label="Copiază" size="xs" variant="ghost" />
                </span>
              ) : (
                <span className="text-muted-foreground">apare după prima acțiune</span>
              )}
            </Tile>
            <Tile label="Conversiile le gestionează">
              <span className={setup.conversionAccount ? "text-[#FFC79C]" : undefined}>
                {setup.conversionAccount ? `contul ${formatCustomerId(setup.conversionAccount)} (între conturi)` : OWNER_LABEL[setup.owner]}
              </span>
            </Tile>
            <Tile label="Raportarea apelurilor">
              <span className="flex flex-wrap items-center gap-2">
                <Pill tone={callReportingOn ? "mint" : "apricot"} dot>
                  {setup.callReporting.enabled ? (setup.callReporting.conversions ? "pornită" : "pornită, fără conversii") : "oprită"}
                </Pill>
                <span className="text-[11px] text-muted-foreground">
                  {setup.callReporting.enabled
                    ? setup.callReporting.conversions
                      ? "cu conversii din apeluri"
                      : "apelurile nu se numără ca lead"
                    : "se pornește în Google Ads (pașii, jos)"}
                </span>
              </span>
            </Tile>
          </div>
        ) : null}
      </ContHeadline>

      {setup && !setup.actions.some((action) => action.status === "ENABLED" && action.primary) ? (
        <InlineNote tone="rose">Nicio acțiune principală activă: licitarea automată n-are după ce să se ghideze.</InlineNote>
      ) : null}
      {googleError ? <InlineNote className="max-w-2xl">{googleError}</InlineNote> : null}

      {setup ? (
        <>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
            <ConversiiLista actions={setup.actions} />
            <GtmExport trackingId={setup.trackingId} actions={setup.actions} />
          </div>

          <ConversiiCreare
            workspace={workspace.id}
            account={{ id: info.id, currency: info.currency }}
            existing={existingFor(setup)}
            blocked={blocked}
            actions={{ preview: previewConversionActions, create: createConversionActions }}
          />

          <ConversiiPasi setup={setup} calls={calls} />
        </>
      ) : null}
    </div>
  );
}
