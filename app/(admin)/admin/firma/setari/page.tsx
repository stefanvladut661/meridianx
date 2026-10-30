import type { Metadata } from "next";
import { readSettings } from "@/lib/firma/setari";
import { isOblioConfigured, oblioSeries, OblioError } from "@/lib/firma/oblio/api";
import { isEmailConfigured } from "@/lib/email/send";
import { SettingsForm } from "@/components/firma/settings-form";
import { Notice, PageHead, Tag } from "@/components/firma/ui";
import { DriveStatusCard } from "@/components/firma/drive-status";
import { driveStatus, monthFolderName } from "@/lib/firma/drive";
import { currentMonth } from "@/lib/firma/format";
import { createMonthFolderAction, saveSettingsAction } from "./actions";

export const metadata: Metadata = { title: "Setări — MERIDIAN Firmă", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * /admin/firma/setari — ce se setează din admin (seria, emailul contabilului,
 * folderul de pe Drive) și starea legăturilor care stau în Vercel. Cheile nu
 * se văd și nu se scriu aici.
 */
export default async function SetariPage() {
  const settings = await readSettings();
  // Seriile de factură din Oblio, ca seria să se aleagă, nu să se scrie (doar citire).
  let series: { names: string[]; error: string | null } = { names: [], error: null };
  if (isOblioConfigured()) {
    try {
      series = { names: (await oblioSeries()).filter((item) => item.type.toLowerCase().startsWith("factur")).map((item) => item.name), error: null };
    } catch (error) {
      series = { names: [], error: error instanceof OblioError ? error.message : "Oblio n-a răspuns." };
    }
  }
  const links = [
    { name: "Oblio", ok: isOblioConfigured(), missing: "OBLIO_EMAIL, OBLIO_API_SECRET, OBLIO_CIF" },
    { name: "Email (Resend)", ok: isEmailConfigured(), missing: "RESEND_API_KEY" },
  ];
  // O citire la Google: folderul rădăcină se vede și se poate scrie în el?
  const drive = await driveStatus(true);

  return (
    <main className="px-4 pb-16 pt-6 sm:px-6">
      <PageHead title="Setări" subtitle="Ce se alege din admin. Cheile (Oblio, Google, emailul) stau doar în Vercel; aici vezi doar dacă sunt puse." />
      <section aria-labelledby="legaturi" className="mt-5 max-w-3xl">
        <h2 id="legaturi" className="text-[15px] font-semibold text-bone">
          Legăturile
        </h2>
        <ul className="mt-2 divide-y divide-hair rounded-xl border border-hair bg-char">
          {links.map((link) => (
            <li key={link.name} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-[14px]">
              <span className="font-medium text-bone">{link.name}</span>
              {link.ok ? <Tag tone="ok">Legat</Tag> : <span className="text-[13px] text-dim">Lipsește în Vercel: {link.missing}</span>}
            </li>
          ))}
        </ul>
      </section>
      <DriveStatusCard
        mode={drive.mode?.kind ?? null}
        serviceEmail={drive.mode?.kind === "service" ? drive.mode.email : null}
        rootName={drive.rootName}
        ok={drive.ok}
        message={drive.message}
        folderName={monthFolderName(currentMonth(), drive.pattern)}
        createMonthFolder={createMonthFolderAction}
      />
      {!settings.ok ? (
        <Notice tone="error" className="mt-5 max-w-3xl">
          {settings.message}
        </Notice>
      ) : (
        <SettingsForm settings={settings.data} series={series.names} seriesError={series.error} save={saveSettingsAction} />
      )}
    </main>
  );
}
