import type { Metadata } from "next";
import { Card, SectionTitle } from "@/components/panou/ui/primitives";
import { EroareCitire } from "@/components/panou/prospectare/prezentare-eroare";
import { ProgramariViitoare } from "@/components/panou/prospectare/programari-viitoare";
import { ProgrameazaButon } from "@/components/panou/prospectare/programeaza";
import { WhatsAppScreen } from "@/components/panou/prospectare/whatsapp-screen";
import {
  aziBucuresti,
  asiguraCiclu,
  citesteConturiWhatsapp,
  citesteOptiuniDistributie,
  citesteProgramari,
  citesteProgramariViitoare,
  citesteCanale,
  citesteSetari,
  maineBucuresti,
} from "@/lib/prospectare/citire";
import { utilizatorCurent } from "@/lib/prospectare/utilizator";
import { requireAdmin } from "../../_components/require-admin";

export const metadata: Metadata = { title: "WhatsApp azi — MERIDIAN Prospectare", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** „1 firmă”, „5 firme”, „20 de firme”. */
function firme(n: number): string {
  const rest = n % 100;
  if (n === 1) return "1 firmă";
  return rest >= 20 || (rest === 0 && n !== 0) ? `${n.toLocaleString("ro-RO")} de firme` : `${n.toLocaleString("ro-RO")} firme`;
}

/**
 * /admin/prospectare/whatsapp — ce e programat AZI pe WhatsApp, pe conturi, plus
 * restanțele (migrarea 39: nimic nu se programează singur; firmele vin din Firme,
 * „Distribuie”, iar netrimisele rămân pe contul lor până pleacă sau sunt scoase
 * din coadă). Jos, ce e programat de mâine încolo.
 */
export default async function WhatsAppPage() {
  await requireAdmin();
  const { azi } = aziBucuresti();
  // Ciclul de azi întâi: dacă cronul de la 00:00 n-a rulat, îl pornește citirea asta.
  const ciclu = await asiguraCiclu();
  const [programari, conturi, setari, optiuni, viitoare, utilizator, canale] = await Promise.all([
    // Azi și restanțele (netrimise din zilele dinainte: nu se mai eliberează la 00:00), cu datele robotului pentru mesaj.
    citesteProgramari("whatsapp", [azi], ["programata", "folosita"], { restante: true, cuDateExtra: true }),
    citesteConturiWhatsapp(),
    citesteSetari(),
    citesteOptiuniDistributie(),
    citesteProgramariViitoare("whatsapp", maineBucuresti(azi)),
    utilizatorCurent(),
    citesteCanale(),
  ]);
  const toateConturile = conturi.ok ? conturi.data : [];
  const wa = canale.ok ? canale.data.find((c) => c.canal === "whatsapp") : undefined;

  return (
    <div className="space-y-4">
      <WhatsAppScreen
        azi={azi}
        suspendat={wa && !wa.activ ? (wa.motiv ?? "") : null}
        programari={programari.ok ? programari.data : null}
        eroareProgramari={programari.ok ? null : programari.message}
        conturi={conturi.ok ? conturi.data : null}
        eroareConturi={conturi.ok ? null : conturi.message}
        sablon={setari.ok ? (setari.data.sablon_whatsapp_primul ?? "") : ""}
        eroareSetari={setari.ok ? null : setari.message}
        eroareCiclu={ciclu.ok ? null : ciclu.message}
        programeaza={
          <ProgrameazaButon
            key="programeaza"
            canal="whatsapp"
            azi={azi}
            optiuni={optiuni.ok ? optiuni.data : null}
            conturi={toateConturile}
            utilizator={utilizator}
            suspendat={Boolean(wa && !wa.activ)}
            className="h-10 px-3.5 text-[14.5px] sm:h-8 sm:px-3 sm:text-[14px]"
          />
        }
      />

      <Card as="section" aria-labelledby="whatsapp-viitoare">
        <SectionTitle
          title={<span id="whatsapp-viitoare">Programate de mâine încolo</span>}
          hint={viitoare.ok && viitoare.data.length ? firme(viitoare.data.length) : undefined}
        />
        <div className="mt-3">
          {viitoare.ok ? (
            <ProgramariViitoare canal="whatsapp" programari={viitoare.data} conturi={toateConturile} />
          ) : (
            <EroareCitire title="Programările viitoare nu s-au citit" message={viitoare.message} className="py-8" />
          )}
        </div>
      </Card>
    </div>
  );
}
