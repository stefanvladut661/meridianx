import type { Metadata } from "next";
import { NiseEcran } from "@/components/panou/prospectare/nise-ecran";
import { citesteNise, citesteRezumat } from "@/lib/prospectare/citire";

export const metadata: Metadata = { title: "Nișe — MERIDIAN Prospectare", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** /admin/prospectare/nise — tabla comună de nișe: ce cercetează fiecare robot, ce e liber, ce s-a terminat. */
export default async function NisePage() {
  const [nise, rezumat] = await Promise.all([citesteNise(), citesteRezumat()]);
  // Ora citirii trece la client: „acum 3 h” iese la fel la randare și la hidratare.
  const acum = Date.now();
  // O bază fără ultima migrare dă rezumatul fără nișe: atunci ecranul numără din tablă.
  const r = rezumat.ok && rezumat.data.nise && rezumat.data.evaluate ? rezumat.data : null;
  return (
    <NiseEcran
      nise={nise.ok ? nise.data : []}
      eroare={nise.ok ? null : nise.message}
      rezumat={r ? { nise: r.nise, evaluate: r.evaluate, coada_constructie: Number(r.coada_constructie ?? 0) } : null}
      acum={acum}
    />
  );
}
