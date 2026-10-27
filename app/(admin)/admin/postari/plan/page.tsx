import type { Metadata } from "next";
import Link from "next/link";
import { readSettings } from "@/lib/postari/setari";
import { examplePlan } from "@/lib/postari/plan-schema";
import { listPlans } from "@/lib/postari/planuri";
import { addDays, momentLabel, todayIn } from "@/lib/postari/timp";
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
  const plans = await listPlans(10);
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

      {plans.ok && plans.data.length > 0 ? (
        <section aria-labelledby="planuri-aprobate" className="mt-10">
          <h2 id="planuri-aprobate" className="text-[15px] font-semibold text-bone">
            Planurile aprobate
          </h2>
          <ul className="mt-2 divide-y divide-hair rounded-xl border border-hair bg-white">
            {plans.data.map((plan) => (
              <li key={plan.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 px-4 py-2.5 text-[14px]">
                <span className="text-bone">
                  <span className="font-semibold">{plan.nume ?? "Fără nume"}</span> · {plan.nrPostari} {plan.nrPostari === 1 ? "postare" : "postări"} · <span className="text-dim">{plan.folderCale}</span>
                </span>
                <span className="text-[13px] text-dim">
                  aprobat {momentLabel(plan.aprobatLa, fus)} de {plan.aprobatDe}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[13px] text-dim">
            Postările lor sunt în{" "}
            <Link href="/admin/postari" className="font-medium text-[var(--md-a1)] underline underline-offset-2">
              Coada
            </Link>
            , unde le poți scoate una câte una înainte să plece.
          </p>
        </section>
      ) : null}
    </main>
  );
}
