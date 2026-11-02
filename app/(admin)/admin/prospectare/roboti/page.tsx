import type { Metadata } from "next";
import { RobotiEcran } from "@/components/panou/prospectare/roboti-ecran";
import { citesteDispozitive } from "@/lib/prospectare/citire";

export const metadata: Metadata = { title: "Roboți — MERIDIAN Prospectare", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** /admin/prospectare/roboti — dispozitivele care construiesc site-urile demo, tokenul lor și starea. */
export default async function RobotiPage() {
  const dispozitive = await citesteDispozitive();
  // Ora citirii trece la client: „activ acum” și „acum 5 min” ies la fel la randare și la hidratare.
  const acum = Date.now();
  return <RobotiEcran dispozitive={dispozitive.ok ? dispozitive.data : []} eroare={dispozitive.ok ? null : dispozitive.message} acum={acum} />;
}
