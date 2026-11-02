import type { Metadata } from "next";
import { cookies } from "next/headers";
import { relativeRo } from "@/components/panou/ui/format";
import { Card } from "@/components/panou/ui/primitives";
import { PageHead } from "@/components/panou/prospectare/page-head";
import { EroareCitire } from "@/components/panou/prospectare/prezentare-eroare";
import { SetariLimite } from "@/components/panou/prospectare/setari-limite";
import { SetariSabloane } from "@/components/panou/prospectare/setari-sabloane";
import { aziBucuresti, citesteCasute, citesteSetari } from "@/lib/prospectare/citire";
import { COOKIE_UTILIZATOR, isUtilizator, UTILIZATORI } from "@/lib/prospectare/labels";

export const metadata: Metadata = { title: "Setări — MERIDIAN Prospectare", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** /admin/prospectare/setari — limitele roboților și ale listelor, plafoanele căsuțelor, șabloanele de mesaj. */
export default async function SetariPage() {
  const { azi } = aziBucuresti();
  const [setari, casute, jar] = await Promise.all([citesteSetari(), citesteCasute(azi), cookies()]);
  const ales = jar.get(COOKIE_UTILIZATOR)?.value;
  // Previzualizarea șabloanelor pune în {utilizator} numele ales în comutator.
  const utilizator = UTILIZATORI[isUtilizator(ales) ? ales : "stefan"];
  const acum = Date.now();

  const pill = setari.ok
    ? setari.data.actualizat_de
      ? `modificate ${relativeRo(setari.data.actualizat_la, acum)}, de ${setari.data.actualizat_de}`
      : "valorile de start"
    : undefined;

  return (
    <div className="space-y-4">
      <PageHead title="Setări prospectare" pill={pill} subtitle="Limitele care opresc roboții și textele pe care le folosesc oamenii la apel și pe WhatsApp." />

      {!setari.ok ? (
        <Card>
          <EroareCitire title="Setările nu s-au putut citi" message={setari.message} />
        </Card>
      ) : (
        <>
          <SetariLimite
            setari={{
              incercari_max: setari.data.incercari_max,
              whatsapp_pe_cont: setari.data.whatsapp_pe_cont,
              rezervare_ore: setari.data.rezervare_ore,
              cereri_pe_minut: setari.data.cereri_pe_minut,
            }}
            casute={casute.ok ? casute.data : null}
            eroareCasute={casute.ok ? null : casute.message}
          />
          <SetariSabloane
            sabloane={{
              sablon_whatsapp_primul: setari.data.sablon_whatsapp_primul,
              sablon_whatsapp_dupa_apel: setari.data.sablon_whatsapp_dupa_apel,
              sablon_script_apel: setari.data.sablon_script_apel,
            }}
            utilizator={utilizator}
          />
        </>
      )}
    </div>
  );
}
