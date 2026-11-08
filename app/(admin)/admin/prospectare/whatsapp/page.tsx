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
  citesteSetari,
  maineBucuresti,
} from "@/lib/prospectare/citire";
import { utilizatorCurent } from "@/lib/prospectare/utilizator";

export const metadata: Metadata = { title: "WhatsApp azi — MERIDIAN Prospectare", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** „o firmă”, „5 firme”, „20 de firme”. */
function firme(n: number): string {
  const rest = n % 100;
  if (n === 1) return "O firmă";
  return rest >= 20 || (rest === 0 && n !== 0) ? `${n.toLocaleString("ro-RO")} de firme` : `${n.toLocaleString("ro-RO")} firme`;
}

/**
 * /admin/prospectare/whatsapp — ce e programat AZI pe WhatsApp, pe conturi
 * (migrarea 35): la 00:00 se programează singure cele mai vechi site-uri cu
 * mobil, egal pe conturile active (din 36, și cele cu email trimis într-o zi de
 * dinainte); restul vine din „Programează”. Jos, ce e
 * programat de mâine încolo. Garda de admin e în layout.
 */
export default async function WhatsAppPage() {
  const { azi } = aziBucuresti();
  // Ciclul de azi întâi: dacă cronul de la 00:00 n-a rulat, îl pornește citirea asta.
  const ciclu = await asiguraCiclu();
  const [programari, conturi, setari, optiuni, viitoare, utilizator] = await Promise.all([
    citesteProgramari("whatsapp", [azi], ["programata", "folosita"]),
    citesteConturiWhatsapp(),
    citesteSetari(),
    citesteOptiuniDistributie(),
    citesteProgramariViitoare("whatsapp", maineBucuresti(azi)),
    utilizatorCurent(),
  ]);
  const toateConturile = conturi.ok ? conturi.data : [];

  return (
    <div className="space-y-4">
      <WhatsAppScreen
        azi={azi}
        programari={programari.ok ? programari.data : null}
        eroareProgramari={programari.ok ? null : programari.message}
        conturi={conturi.ok ? conturi.data : null}
        eroareConturi={conturi.ok ? null : conturi.message}
        sablon={setari.ok ? (setari.data.sablon_whatsapp_primul ?? "") : ""}
        eroareSetari={setari.ok ? null : setari.message}
        eroareCiclu={ciclu.ok ? null : ciclu.message}
        programeaza={
          <ProgrameazaButon
            canal="whatsapp"
            azi={azi}
            optiuni={optiuni.ok ? optiuni.data : null}
            conturi={toateConturile}
            utilizator={utilizator}
            className="h-10 px-3.5 text-[14.5px] sm:h-8 sm:px-3 sm:text-[14px]"
          />
        }
      />

      <Card as="section" aria-labelledby="whatsapp-viitoare">
        <SectionTitle
          title={<span id="whatsapp-viitoare">Programate de mâine încolo</span>}
          hint={
            viitoare.ok && viitoare.data.length
              ? `${firme(viitoare.data.length)} pe WhatsApp, pe zile. Le poți anula până în ziua lor: se întorc în rezervă.`
              : "Pe zile, cu anulare până în ziua lor"
          }
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
