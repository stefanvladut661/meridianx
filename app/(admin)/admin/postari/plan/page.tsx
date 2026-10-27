import type { Metadata } from "next";
import Link from "next/link";
import { readSettings } from "@/lib/postari/setari";
import { examplePlan } from "@/lib/postari/plan-schema";
import { addDays, todayIn } from "@/lib/postari/timp";
import { PlanEditor } from "@/components/postari/plan-editor";
import { Notice, PageHead } from "@/components/postari/ui";
import { approvePlanAction, verifyPlanAction } from "./actions";

export const metadata: Metadata = { title: "Plan nou — MERIDIAN Postări", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
/** Verificarea citește clipurile necitite de pe Drive; un apel poate dura. */
export const maxDuration = 60;

/**
 * /admin/postari/plan — planul JSON: lipit, încărcat sau scris de Claude din
 * manifest (ecranul „Clipuri”). Verificarea, previzualizarea și „Aprobă planul”.
 */
export default async function PlanPage() {
  const settings = await readSettings();
  const fus = settings.ok ? settings.data.sloturiFus : "Europe/Bucharest";
  const example = examplePlan(settings.ok ? settings.data.driveFolderNume : null, settings.ok ? settings.data.sloturiOre : ["12:30", "19:00"], fus, addDays(todayIn(fus), 2));

  return (
    <main className="px-4 pb-16 pt-6 sm:px-6">
      <PageHead
        title="Plan nou"
        subtitle={
          <>
            Lipește planul JSON sau încarcă-l din fișier. Îl poate scrie și Claude, din manifest.json, la{" "}
            <Link href="/admin/postari/clipuri" className="font-medium text-[var(--md-a1)] underline underline-offset-2">
              Clipuri
            </Link>
            . Nimic nu intră în coadă până nu apeși „Aprobă planul”.
          </>
        }
      />
      {settings.ok && !settings.data.driveFolderId ? (
        <Notice tone="warn" className="mt-5 max-w-3xl">
          Folderul principal de pe Drive nu e ales, deci planul nu se poate verifica.{" "}
          <Link href="/admin/postari/setari" className="font-semibold underline underline-offset-2">
            Alege-l în Setări
          </Link>
        </Notice>
      ) : null}
      <PlanEditor example={example} verify={verifyPlanAction} approve={approvePlanAction} />
    </main>
  );
}
