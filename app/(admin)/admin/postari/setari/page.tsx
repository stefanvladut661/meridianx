import type { Metadata } from "next";
import Link from "next/link";
import { readSettings } from "@/lib/postari/setari";
import { checkRoot, DRIVE_MISSING, driveMode, folderLink } from "@/lib/postari/drive";
import { listAccounts } from "@/lib/postari/conturi";
import { keyProblem } from "@/lib/postari/cripto";
import { AccountsPanel } from "@/components/postari/accounts-panel";
import { SettingsForm } from "@/components/postari/settings-form";
import { IconExternal } from "@/components/postari/icons";
import { Notice, PageHead, Tag } from "@/components/postari/ui";
import { saveSettingsAction } from "./actions";
import { connectInstagramAction, disconnectAction } from "./conturi-actions";

export const metadata: Metadata = { title: "Setări — MERIDIAN Postări", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * /admin/postari/setari — ce se alege din admin: folderul de pe Drive,
 * sloturile, plafoanele, alertele și conturile Instagram și TikTok. Cheile nu
 * se văd și nu se scriu aici; tokenurile conturilor nu se mai văd după salvare.
 */
export default async function SetariPage() {
  const settings = await readSettings();
  const mode = driveMode();
  // O citire la Google: folderul principal se vede cu contul legat?
  const root = settings.ok && settings.data.driveFolderId && mode ? await checkRoot(settings.data.driveFolderId) : null;
  const accounts = await listAccounts();
  const instagram = accounts.ok ? (accounts.data.find((account) => account.platforma === "instagram") ?? null) : null;

  return (
    <main className="px-4 pb-16 pt-6 sm:px-6">
      <PageHead title="Setări" subtitle="Ce se alege din admin. Cheile (Google, Anthropic, TikTok) stau doar în Vercel; tokenurile conturilor stau criptate în Supabase." />

      <section aria-labelledby="drive-stare" className="mt-5 max-w-3xl">
        <h2 id="drive-stare" className="text-[15px] font-semibold text-bone">
          Drive
        </h2>
        <ul className="mt-2 divide-y divide-hair rounded-xl border border-hair bg-white">
          <li className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-[14px]">
            <span className="font-medium text-bone">Legătura (aceeași ca la adminul firmei)</span>
            {mode ? <Tag tone="ok">{mode.kind === "oauth" ? "Legat, ca tine (OAuth)" : "Legat, cont de serviciu"}</Tag> : <span className="max-w-md text-[13px] text-dim">{DRIVE_MISSING}</span>}
          </li>
          <li className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-[14px]">
            <span className="font-medium text-bone">Folderul principal</span>
            {!settings.ok || !settings.data.driveFolderId ? (
              <span className="text-[13px] text-dim">Nu e ales încă.</span>
            ) : root?.ok ? (
              <a href={folderLink(settings.data.driveFolderId)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-[14px] font-medium text-[var(--md-a1)] underline-offset-2 hover:underline">
                {root.data.name}
                <IconExternal size={15} />
                <span className="sr-only">(se deschide în Drive, filă nouă)</span>
              </a>
            ) : root ? (
              <Tag tone="error" title={root.message}>
                Nu se vede
              </Tag>
            ) : (
              <span className="text-[13px] text-dim">{settings.data.driveFolderNume ?? "—"}</span>
            )}
          </li>
        </ul>
        {root && !root.ok ? (
          <Notice tone="error" className="mt-3">
            {root.message}
          </Notice>
        ) : null}
        {settings.ok && settings.data.driveFolderId && root?.ok ? (
          <p className="mt-2 text-[13px] text-dim">
            Vezi ce e în el la <Link href="/admin/postari/clipuri" className="font-medium text-[var(--md-a1)] underline underline-offset-2">Clipuri</Link>.
          </p>
        ) : null}
      </section>

      {!settings.ok ? (
        <Notice tone="error" className="mt-5 max-w-3xl">
          {settings.message}
        </Notice>
      ) : (
        <SettingsForm settings={settings.data} save={saveSettingsAction} />
      )}

      {!accounts.ok ? (
        <Notice tone="error" className="mt-8 max-w-3xl">
          {accounts.message}
        </Notice>
      ) : (
        <AccountsPanel instagram={instagram} keyProblem={keyProblem()} fus={settings.ok ? settings.data.sloturiFus : "Europe/Bucharest"} connectInstagram={connectInstagramAction} disconnect={disconnectAction} />
      )}
    </main>
  );
}
