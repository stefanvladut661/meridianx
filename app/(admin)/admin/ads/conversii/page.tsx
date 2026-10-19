import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/supabase/clients";
import { currentWorkspaceId, listWorkspaces } from "@/lib/ads/workspaces.server";
import { findWorkspace } from "@/lib/ads/workspaces";
import { describeGoogleError } from "@/lib/ads/google/errors";
import { findGoogleAccount, listGoogleAccounts } from "@/lib/ads/google/lookup";
import { accountHeader } from "@/lib/ads/google/account/read";
import { readConversionSetup } from "@/lib/ads/google/conversions/read";
import {
  CATEGORY_LABEL,
  CONVERSION_TYPE_LABEL,
  COUNTING_LABEL,
  LEAD_ACTIONS,
  LEAD_KINDS,
  sendToText,
  type LeadKind,
} from "@/lib/ads/google/conversions/standard";
import type { ConversionSetup } from "@/lib/ads/google/conversions/types";
import { AccountChooser, formatCustomerId } from "@/components/ads/account-chooser";
import { ConversionsView, CopyButton } from "@/components/ads/conversions-view";
import { GtmExport } from "@/components/ads/gtm-export";
import { ERROR_TEXT, OK_TEXT, WARNING_TEXT } from "@/components/ads/tone";
import { cn } from "@/lib/utils";
import { createConversionActions, previewConversionActions } from "../actions";

export const metadata: Metadata = {
  title: "Conversii — MERIDIAN Reclame",
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

const days = (value: number | null) => (value === null ? null : `${value} ${value === 1 ? "zi" : "zile"}`);

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

  const header = (
    <>
      <p className="eyebrow">Reclame · Google</p>
      <h1 className="display mt-2 text-[2.25rem] text-bone sm:text-[2.75rem]">Conversii</h1>
      <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-bone/70">
        Ce numără contul ca lead: apelul din anunț, clicul pe telefon, formularul trimis. Portalul creează acțiunile care lipsesc și îți dă
        fișierul de import pentru Google Tag Manager. Publicarea în GTM rămâne la tine.
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
            : `Lucrezi în ${summary.name}. Conversiile se fac aici doar pe Google: treci în Meridian · Google sau Clienți · Google.`}
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
  const chooser = <AccountChooser action="/admin/ads/conversii" value={accountParam} accounts={accounts} />;

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

  return (
    <main className="mx-auto max-w-[1400px] px-4 pb-24 pt-8 sm:px-8 sm:pt-10">
      {header}
      {chooser}

      <section aria-labelledby="conversii-cont" className="mt-8">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
          <h2 id="conversii-cont" className="font-md-display text-[1.625rem] font-semibold leading-tight text-bone">
            {info.name}
          </h2>
          <p className="font-md-mono text-[12px] text-dim">
            {formatCustomerId(info.id)} · {info.currency} ·{" "}
            <Link href={`/admin/ads/cont?cont=${info.id}`} className="underline underline-offset-4 hover:text-bone">
              Contul
            </Link>{" "}
            ·{" "}
            <Link href={`/admin/ads/termeni?cont=${info.id}`} className="underline underline-offset-4 hover:text-bone">
              Termeni
            </Link>
          </p>
        </div>

        {setup ? (
          <dl className="mt-5 grid gap-px overflow-hidden rounded-panel-lg border border-hair bg-hair sm:grid-cols-3">
            <div className="bg-ink px-4 py-3.5">
              <dt className="eyebrow !text-[11px]">Id-ul de urmărire</dt>
              <dd className="mt-1.5 flex flex-wrap items-center gap-2 font-md-mono text-[15px] text-bone">
                {setup.trackingId ? (
                  <>
                    AW-{setup.trackingId}
                    <CopyButton value={`AW-${setup.trackingId}`} label="id-ul de urmărire" />
                  </>
                ) : (
                  <span className="text-dim">apare după prima acțiune</span>
                )}
              </dd>
            </div>
            <div className="bg-ink px-4 py-3.5">
              <dt className="eyebrow !text-[11px]">Conversiile le gestionează</dt>
              <dd className={cn("mt-1.5 text-[14px] leading-snug", setup.conversionAccount ? WARNING_TEXT : "text-bone")}>
                {setup.conversionAccount ? `contul ${formatCustomerId(setup.conversionAccount)} (între conturi)` : OWNER_LABEL[setup.owner]}
              </dd>
            </div>
            <div className="bg-ink px-4 py-3.5">
              <dt className="eyebrow !text-[11px]">Raportarea apelurilor</dt>
              <dd className={cn("mt-1.5 text-[14px] leading-snug", setup.callReporting.enabled && setup.callReporting.conversions ? OK_TEXT : WARNING_TEXT)}>
                {setup.callReporting.enabled
                  ? setup.callReporting.conversions
                    ? "pornită, cu conversii din apeluri"
                    : "pornită, dar fără conversii din apeluri"
                  : "oprită — se pornește în Google Ads (pașii, jos)"}
              </dd>
            </div>
          </dl>
        ) : null}
        {setup && !setup.actions.some((action) => action.status === "ENABLED" && action.primary) ? (
          <p className={cn("mt-3 text-[14px]", ERROR_TEXT)}>Nicio acțiune principală activă: licitarea automată n-are după ce să se ghideze.</p>
        ) : null}
      </section>

      {googleError ? <Notice>{googleError}</Notice> : null}

      {setup ? (
        <>
          <section aria-labelledby="actiuni-cont" className="mt-10">
            <h2 id="actiuni-cont" className="eyebrow">
              Acțiunile din cont · {setup.actions.length}
            </h2>
            {setup.actions.length === 0 ? (
              <p className="mt-3 max-w-2xl text-[14.5px] leading-relaxed text-bone/75">
                Contul n-are încă nicio acțiune de conversie: campaniile n-au după ce să se optimizeze. Creează-le pe cele standard, mai jos.
              </p>
            ) : (
              <div className="relative mt-3 overflow-x-auto rounded-panel-lg border border-hair">
                <table className="w-full min-w-[880px] border-collapse text-left text-[13px]">
                  <caption className="sr-only">Acțiunile de conversie din cont, cu eticheta fiecăreia</caption>
                  <thead className="bg-char font-md-mono text-[11px] uppercase tracking-[0.12em] text-dim">
                    <tr>
                      <th scope="col" className="px-3 py-2.5 font-normal">Acțiunea</th>
                      <th scope="col" className="px-3 py-2.5 font-normal">Tipul · categoria</th>
                      <th scope="col" className="px-3 py-2.5 font-normal">Numără</th>
                      <th scope="col" className="px-3 py-2.5 font-normal">Fereastra</th>
                      <th scope="col" className="px-3 py-2.5 font-normal">Eticheta / id-ul</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-hair">
                    {setup.actions.map((action) => (
                      <tr key={action.id} className={cn(action.status !== "ENABLED" && "opacity-60")}>
                        <th scope="row" className="px-3 py-2.5 font-normal">
                          <span className="block text-bone [overflow-wrap:anywhere]">{action.name}</span>
                          <span className={cn("block text-[12px]", action.primary ? "text-bone/70" : "text-dim")}>
                            {action.primary ? "principală" : "secundară"}
                            {action.status !== "ENABLED" ? ` · ${action.status === "HIDDEN" ? "ascunsă" : action.status}` : ""}
                          </span>
                        </th>
                        <td className="px-3 py-2.5 text-bone/80">
                          {CONVERSION_TYPE_LABEL[action.type] ?? action.type}
                          <span className="block text-[12px] text-dim">{CATEGORY_LABEL[action.category] ?? action.category}</span>
                        </td>
                        <td className="px-3 py-2.5 text-bone/80">
                          {action.counting ? (COUNTING_LABEL[action.counting] ?? action.counting) : "—"}
                          {action.callSeconds !== null ? <span className="block text-[12px] text-dim">apel ≥ {action.callSeconds} s</span> : null}
                        </td>
                        <td className="px-3 py-2.5 text-bone/80">
                          {days(action.clickWindowDays) ?? "—"} după clic
                          {action.viewWindowDays !== null ? <span className="block text-[12px] text-dim">{days(action.viewWindowDays)} după afișare</span> : null}
                        </td>
                        <td className="px-3 py-2.5">
                          {action.sendTo ? (
                            <span className="flex flex-wrap items-center gap-2">
                              <code className="font-md-mono text-[12px] text-bone/90">{sendToText(action.sendTo)}</code>
                              <CopyButton value={sendToText(action.sendTo)} label={`eticheta pentru ${action.name}`} />
                            </span>
                          ) : (
                            <span className="flex flex-wrap items-center gap-2 font-md-mono text-[12px] text-dim">
                              id {action.id}
                              {action.type === "AD_CALL" ? <CopyButton value={action.id} label={`id-ul pentru ${action.name}`} /> : null}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <div className="mt-12">
            <ConversionsView
              workspace={workspace.id}
              account={{ id: info.id, currency: info.currency }}
              existing={existingFor(setup)}
              blocked={blocked}
              actions={{ preview: previewConversionActions, create: createConversionActions }}
            />
          </div>

          <section aria-labelledby="import-gtm" className="mt-14">
            <h2 id="import-gtm" className="eyebrow">
              Importul în Google Tag Manager
            </h2>
            <p className="mt-2 max-w-2xl text-[13.5px] leading-relaxed text-dim">
              Un fișier cu Conversion Linker-ul, tag-ul Google (dacă lipsește) și conversiile alese, cu declanșatoarele lor. Nu atinge nimic din
              containerul clientului: totul e nou și începe cu „Google Ads ·”.
            </p>
            <GtmExport trackingId={setup.trackingId} actions={setup.actions} />
          </section>

          <section aria-labelledby="pasi-gtm" className="mt-14 grid gap-10 lg:grid-cols-2">
            <div>
              <h2 id="pasi-gtm" className="eyebrow !text-bone">
                În GTM, după descărcare
              </h2>
              <ol className="mt-4 list-decimal space-y-2.5 pl-5 text-[14px] leading-relaxed text-bone/85 marker:font-md-mono marker:text-dim">
                <li>Administrator → Importă containerul → alege fișierul.</li>
                <li>Spațiul de lucru: cel existent (sau unul nou, dacă altcineva lucrează în container).</li>
                <li>
                  Opțiunea: <strong className="font-semibold text-bone">Combinare</strong>, cu{" "}
                  <strong className="font-semibold text-bone">Redenumește etichetele, declanșatoarele și variabilele în conflict</strong>. Niciodată
                  „Suprascrie” sau „Înlocuiește”: ar schimba ce are deja clientul.
                </li>
                <li>Citește rezumatul importului: trebuie să apară doar elemente adăugate. Dacă apare ceva modificat sau șters, renunță.</li>
                <li>Previzualizare pe site: atinge un număr de telefon, trimite formularul de test — etichetele „Google Ads · conversie · …” trebuie să apară ca declanșate.</li>
                <li>Trimite → Publică. Portalul nu publică nimic în GTM.</li>
                <li>În Google Ads → Obiective → Conversii, acțiunea trece pe „Înregistrează conversii” după prima conversie (până la câteva ore).</li>
              </ol>
            </div>
            <div>
              <h2 className="eyebrow !text-bone">De mână, în Google Ads</h2>
              <ul className="mt-4 space-y-3 text-[14px] leading-relaxed text-bone/85">
                <li>
                  <strong className="font-semibold text-bone">Raportarea apelurilor</strong> — Administrator → Setările contului → Raportarea
                  apelurilor: pornită, cu „Conversii din apeluri”. E o setare de cont; portalul doar o citește (singura modificare pe care o face pe un
                  cont existent e pauza).
                  {setup.callReporting.enabled && setup.callReporting.conversions ? (
                    <span className={cn("block text-[13px]", OK_TEXT)}>Contul ăsta o are pornită.</span>
                  ) : (
                    <span className={cn("block text-[13px]", WARNING_TEXT)}>Contul ăsta n-o are pornită: apelurile din anunțuri nu se numără.</span>
                  )}
                </li>
                <li>
                  <strong className="font-semibold text-bone">Butonul de apel din planul de căutare</strong> — pune id-ul acțiunii „apel din anunț” la{" "}
                  <code className="font-md-mono text-[12.5px]">assets.call.conversion_action_id</code>
                  {calls.length > 0 ? (
                    <>
                      : <span className="font-md-mono text-[12.5px]">{calls.map((action) => `${action.id} (${action.name})`).join(", ")}</span>.
                    </>
                  ) : (
                    "; contul n-are încă una — creeaz-o mai sus."
                  )}
                </li>
                <li>
                  <strong className="font-semibold text-bone">Obiectivele campaniilor</strong> — o campanie cu obiective proprii (nu cele ale contului)
                  nu ia singură acțiunile noi: adaugă-le în setările ei.
                </li>
                <li>
                  <strong className="font-semibold text-bone">Consimțământul</strong> — pe un site cu banner de cookie-uri, etichetele Google din GTM
                  numără corect doar dacă bannerul trimite semnalele Consent Mode (implicit refuzat, apoi alegerea omului).
                </li>
                <li>
                  <strong className="font-semibold text-bone">Fără dubluri</strong> — dacă site-ul trimite deja conversia din cod (gtag), nu importa
                  eticheta GTM pentru aceeași acțiune: s-ar număra de două ori.
                </li>
              </ul>
            </div>
          </section>
        </>
      ) : null}
    </main>
  );
}
