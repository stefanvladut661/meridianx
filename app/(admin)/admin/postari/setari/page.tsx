import type { Metadata } from "next";
import { readSettings } from "@/lib/postari/setari";
import { checkRoot, DRIVE_MISSING, driveMode, folderLink } from "@/lib/postari/drive";
import { isClaudeConfigured } from "@/lib/postari/claude-plan";
import { listAccounts } from "@/lib/postari/conturi";
import { lastCronRun } from "@/lib/postari/postari";
import { agoLabel } from "@/lib/postari/timp";
import { keyProblem } from "@/lib/postari/cripto";
import { redirectUri, tiktokConfigured, TIKTOK_MISSING } from "@/lib/postari/tiktok";
import { InlineNote } from "@/components/panou/ui/actions";
import { SettingsScreen, type DriveInfo, type StatusItem } from "@/components/panou/postari/settings-screen";
import { ScreenHead } from "@/components/panou/postari/shared";
import { checkDriveAction, saveSettingsAction } from "./actions";
import { connectInstagramAction, disconnectAction } from "./conturi-actions";

export const metadata: Metadata = { title: "Setări — MERIDIAN Postări", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** Ce spune adresa după întoarcerea din TikTok (`?tiktok=…`). */
const TIKTOK_RESULT: Record<string, { tone: "mint" | "apricot" | "rose"; text: string }> = {
  conectat: { tone: "mint", text: "TikTok e conectat. Clipurile TikTok din coadă pleacă în ciornele din aplicație la ora lor." },
  refuzat: { tone: "apricot", text: "Conectarea TikTok a fost anulată în TikTok. Nimic nu s-a schimbat; poți încerca din nou." },
  stare: { tone: "rose", text: "Întoarcerea din TikTok nu se potrivește cu cererea (link vechi sau deschis în alt browser). Apasă din nou „Conectează”, din același browser." },
  permisiune: { tone: "rose", text: "TikTok n-a dat permisiunea de urcare a clipurilor (video.upload). Conectează din nou și lasă bifată permisiunea." },
  neconfigurat: { tone: "apricot", text: TIKTOK_MISSING },
  eroare: { tone: "rose", text: "Conectarea TikTok n-a mers." },
};

/**
 * /admin/postari/setari — ce se alege din admin: folderul de pe Drive,
 * sloturile, plafoanele, alertele și conturile Instagram și TikTok. Cheile nu
 * se văd și nu se scriu aici; tokenurile conturilor nu se mai văd după salvare.
 * Pagina citește doar booleene despre ce e pus în Vercel, niciodată valorile.
 */
export default async function SetariPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const result = typeof params.tiktok === "string" ? (TIKTOK_RESULT[params.tiktok] ?? null) : null;
  const motiv = typeof params.motiv === "string" ? params.motiv.slice(0, 200) : null;
  const settings = await readSettings();
  const intro = "Drive, sloturi, plafoane, conturi și starea programării.";

  if (!settings.ok) {
    return (
      <div className="space-y-4">
        <ScreenHead title="Setări" text={intro} />
        <InlineNote tone="rose">{settings.message}</InlineNote>
      </div>
    );
  }

  const now = Date.now();
  const mode = driveMode();
  // O citire la Google: folderul principal se vede cu contul legat?
  const root = settings.data.driveFolderId && mode ? await checkRoot(settings.data.driveFolderId) : null;
  const [accounts, cronAt] = await Promise.all([listAccounts(), lastCronRun()]);
  const cronFresh = cronAt !== null && now - new Date(cronAt).getTime() < 15 * 60_000;
  const alertTo = settings.data.emailAlerte ? settings.data.emailAlerte : (process.env.ADMIN_EMAILS ?? "").split(",").map((item) => item.trim()).filter(Boolean).join(", ");
  const claudeOk = isClaudeConfigured();
  const status: StatusItem[] = [
    { label: "Secretul cozii (POSTARI_CRON_SECRET)", ok: Boolean(process.env.POSTARI_CRON_SECRET?.trim()), value: process.env.POSTARI_CRON_SECRET?.trim() ? "pus în Vercel" : "lipsește: fără el, endpoint-ul refuză Supabase Cron în producție" },
    { label: "Supabase Cron", ok: cronFresh, value: cronAt ? `ultima rulare ${agoLabel(cronAt)}${cronFresh ? "" : ": jobul nu pare să ruleze la 5 minute"}` : "n-a rulat încă: rulează lib/postari/supabase-cron.sql în Supabase" },
    { label: "Emailul alertelor (Resend)", ok: Boolean(process.env.RESEND_API_KEY), value: process.env.RESEND_API_KEY ? `pleacă la ${alertTo || "— (nicio adresă: pune una mai sus)"}` : "RESEND_API_KEY lipsește: alertele apar doar în ecran" },
    { label: "Descrierile scrise de Claude", ok: claudeOk, value: claudeOk ? "ANTHROPIC_API_KEY e pusă" : "ANTHROPIC_API_KEY lipsește: planul se scrie de mână" },
  ];

  const drive: DriveInfo = {
    linked: mode ? (mode.kind === "oauth" ? "Legat, ca tine (OAuth)" : "Legat, cont de serviciu") : null,
    missingText: DRIVE_MISSING,
    rootName: root?.ok ? root.data.name : (settings.data.driveFolderNume ?? null),
    rootLink: settings.data.driveFolderId ? folderLink(settings.data.driveFolderId) : null,
    rootState: !settings.data.driveFolderId ? "unset" : root === null ? "unchecked" : root.ok ? "ok" : "error",
    rootMessage: root && !root.ok ? root.message : null,
  };
  const find = (platform: "instagram" | "tiktok") => (accounts.ok ? (accounts.data.find((account) => account.platforma === platform) ?? null) : null);

  return (
    <div className="space-y-4">
      <SettingsScreen
        settings={settings.data}
        drive={drive}
        status={status}
        cron={{ lastAt: cronAt, fresh: cronFresh }}
        alertTo={alertTo}
        instagram={find("instagram")}
        tiktok={find("tiktok")}
        tiktokMissing={tiktokConfigured() ? null : TIKTOK_MISSING}
        redirectUri={redirectUri()}
        keyProblem={keyProblem()}
        notice={result ? { tone: result.tone, text: `${result.text}${motiv && params.tiktok === "eroare" ? ` Motivul: ${motiv}` : ""}` } : !accounts.ok ? { tone: "rose", text: accounts.message } : null}
        now={now}
        save={saveSettingsAction}
        checkDrive={checkDriveAction}
        connectInstagram={connectInstagramAction}
        disconnect={disconnectAction}
      />
    </div>
  );
}
