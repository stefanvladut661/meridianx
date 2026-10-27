import type { Metadata } from "next";
import { checkMonth } from "@/lib/firma/contabil";
import { actorEmail } from "@/lib/firma/db";
import { addMonths, currentMonth, isMonth } from "@/lib/firma/format";
import { readSettings } from "@/lib/firma/setari";
import { isEmailReady } from "@/lib/firma/email";
import { uploadMissingDriveAction } from "../facturi/actions";
import { AccountantScreen } from "@/components/firma/accountant-screen";
import { Notice, PageHead } from "@/components/firma/ui";
import { buildPackageAction, downloadPackageAction, sendPackageAction } from "./actions";

export const metadata: Metadata = { title: "Contabil — MERIDIAN Firmă", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * /admin/firma/contabil — pachetul lunar: ce lipsește din luna aleasă (implicit
 * luna trecută), zip-ul cu folderul lunii și extrasul, emailul către contabil.
 */
export default async function ContabilPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  // Pachetul se face la început de lună, pentru luna trecută.
  const month = typeof params.luna === "string" && isMonth(params.luna) ? params.luna : addMonths(currentMonth(), -1);
  const [check, settings] = await Promise.all([checkMonth(month, await actorEmail()), readSettings()]);
  return (
    <main className="px-4 pb-16 pt-6 sm:px-6">
      <PageHead title="Pachetul pentru contabil" subtitle="Ce lipsește din lună, zip-ul cu folderul lunii și extrasul, și emailul către contabil — care pleacă doar la „Trimite”." />
      {!check.ok ? (
        <Notice tone="error" className="mt-5">
          {check.message}
        </Notice>
      ) : (
        <AccountantScreen
          check={check.data}
          accountant={settings.ok ? settings.data.emailContabil : null}
          email={isEmailReady()}
          actions={{ build: buildPackageAction, send: sendPackageAction, download: downloadPackageAction, uploadMissing: uploadMissingDriveAction }}
        />
      )}
    </main>
  );
}
