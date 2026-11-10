import type { Metadata } from "next";
import { Lock, LockOpen } from "lucide-react";
import { dateTimeRo, relativeRo } from "@/components/panou/ui/format";
import { RobotiEcran } from "@/components/panou/prospectare/roboti-ecran";
import { citesteDispozitive, citesteLacatPublicare } from "@/lib/prospectare/citire";
import { requireAdmin } from "../../_components/require-admin";

export const metadata: Metadata = { title: "Roboți — MERIDIAN Prospectare", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** /admin/prospectare/roboti — calculatoarele (un rând pe calculator, cu sesiunile lui), tokenul lor, starea și lacătul de publicare. */
export default async function RobotiPage() {
  await requireAdmin();
  const [dispozitive, lacat] = await Promise.all([citesteDispozitive(), citesteLacatPublicare()]);
  // Ora citirii trece la client: „activ acum” și „acum 5 min” ies la fel la randare și la hidratare.
  const acum = Date.now();
  return (
    <div className="space-y-3">
      <RobotiEcran dispozitive={dispozitive.ok ? dispozitive.data : []} eroare={dispozitive.ok ? null : dispozitive.message} acum={acum} />
      {lacat.ok ? (
        <p className="flex items-center gap-2 px-1 text-[14px] text-muted-foreground">
          {lacat.data ? <Lock className="h-4 w-4 text-apricot" aria-hidden="true" /> : <LockOpen className="h-4 w-4" aria-hidden="true" />}
          {lacat.data ? (
            <span>
              Publicare:{" "}
              <span className="font-medium text-foreground">
                {lacat.data.robot ?? "un robot"}
                {lacat.data.sesiune ? ` (${lacat.data.sesiune})` : ""}
              </span>{" "}
              {lacat.data.din ? (
                <time dateTime={lacat.data.din} title={dateTimeRo(lacat.data.din)}>
                  {relativeRo(lacat.data.din, acum)}
                </time>
              ) : null}
            </span>
          ) : (
            <span>Publicare: liber</span>
          )}
        </p>
      ) : null}
    </div>
  );
}
