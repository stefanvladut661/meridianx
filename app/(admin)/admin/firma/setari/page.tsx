import type { Metadata } from "next";
import { readSettings } from "@/lib/firma/setari";
import { isOblioConfigured } from "@/lib/firma/oblio/api";
import { isEmailConfigured } from "@/lib/email/send";
import { SettingsForm } from "@/components/firma/settings-form";
import { Notice, PageHead, Tag } from "@/components/firma/ui";
import { saveSettingsAction } from "./actions";

export const metadata: Metadata = { title: "Setări — MERIDIAN Firmă", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * /admin/firma/setari — ce se setează din admin (seria, emailul contabilului,
 * folderul de pe Drive) și starea legăturilor care stau în Vercel. Cheile nu
 * se văd și nu se scriu aici.
 */
export default async function SetariPage() {
  const settings = await readSettings();
  const links = [
    { name: "Oblio", ok: isOblioConfigured(), missing: "OBLIO_EMAIL, OBLIO_API_SECRET, OBLIO_CIF" },
    { name: "Email (Resend)", ok: isEmailConfigured(), missing: "RESEND_API_KEY" },
  ];

  return (
    <main className="px-4 pb-16 pt-6 sm:px-6">
      <PageHead title="Setări" subtitle="Ce se alege din admin. Cheile (Oblio, Google, emailul) stau doar în Vercel; aici vezi doar dacă sunt puse." />
      <section aria-labelledby="legaturi" className="mt-5 max-w-3xl">
        <h2 id="legaturi" className="text-[15px] font-semibold text-bone">
          Legăturile
        </h2>
        <ul className="mt-2 divide-y divide-hair rounded-xl border border-hair bg-white">
          {links.map((link) => (
            <li key={link.name} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-[14px]">
              <span className="font-medium text-bone">{link.name}</span>
              {link.ok ? <Tag tone="ok">Legat</Tag> : <span className="text-[13px] text-dim">Lipsește în Vercel: {link.missing}</span>}
            </li>
          ))}
        </ul>
      </section>
      {!settings.ok ? (
        <Notice tone="error" className="mt-5 max-w-3xl">
          {settings.message}
        </Notice>
      ) : (
        <SettingsForm settings={settings.data} save={saveSettingsAction} />
      )}
    </main>
  );
}
