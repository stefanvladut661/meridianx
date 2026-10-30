import type { Metadata } from "next";
import Link from "next/link";
import { examplePlan } from "@/lib/postari/plan-schema";
import { listPlans } from "@/lib/postari/planuri";
import { readSettings } from "@/lib/postari/setari";
import { addDays, momentLabel, todayIn } from "@/lib/postari/timp";
import { Card, SectionTitle } from "@/components/panou/ui/primitives";
import { PlanEditor } from "@/components/panou/postari/plan-editor";
import { approvePlanAction, verifyPlanAction } from "./actions";

export const metadata: Metadata = { title: "Plan nou — MERIDIAN Postări", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
/** Verificarea citește clipurile necitite de pe Drive; un apel poate dura. */
export const maxDuration = 60;

/**
 * /admin/postari/plan — planul JSON: lipit, încărcat sau scris de Claude din
 * manifest (ecranul „Clipuri”). Verificarea, previzualizarea pe postare și
 * „Aprobă planul”. Pagina nu există în prototip; e proiectată în același limbaj.
 */
export default async function PlanPage() {
  const settings = await readSettings();
  const fus = settings.ok ? settings.data.sloturiFus : "Europe/Bucharest";
  const plans = await listPlans(10);
  const example = examplePlan(settings.ok ? settings.data.driveFolderNume : null, settings.ok ? settings.data.sloturiOre : ["12:30", "19:00"], fus, addDays(todayIn(fus), 2));

  return (
    <div className="space-y-4">
      <PlanEditor example={example} verify={verifyPlanAction} approve={approvePlanAction} driveMissing={settings.ok && !settings.data.driveFolderId} />

      {plans.ok && plans.data.length > 0 ? (
        <Card className="overflow-hidden p-0">
          <div className="border-b border-white/[0.06] px-4 py-3">
            <SectionTitle title="Planurile aprobate" hint="Postările lor sunt în Coadă, unde le poți scoate una câte una înainte să plece." />
          </div>
          <ul className="divide-y divide-white/[0.05]">
            {plans.data.map((plan) => (
              <li key={plan.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 px-4 py-3 text-[12.5px]">
                <span>
                  <span className="font-medium">{plan.nume ?? "Fără nume"}</span> · {plan.nrPostari} {plan.nrPostari === 1 ? "postare" : "postări"} · <span className="font-mono text-[11px] text-muted-foreground">{plan.folderCale}</span>
                </span>
                <span className="text-[11px] text-muted-foreground">
                  aprobat {momentLabel(plan.aprobatLa, fus)} de {plan.aprobatDe}
                </span>
              </li>
            ))}
          </ul>
          <div className="border-t border-white/[0.06] px-4 py-2.5 text-[11px] text-muted-foreground">
            <Link href="/admin/postari" className="hover:text-foreground">
              Deschide coada →
            </Link>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
