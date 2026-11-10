import type { Metadata } from "next";
import { cookies } from "next/headers";
import { relativeRo } from "@/components/panou/ui/format";
import { Card } from "@/components/panou/ui/primitives";
import { PageHead } from "@/components/panou/prospectare/page-head";
import { EroareCitire } from "@/components/panou/prospectare/prezentare-eroare";
import { SetariCanale } from "@/components/panou/prospectare/setari-canale";
import { SetariConturi } from "@/components/panou/prospectare/setari-conturi";
import { SetariLimite } from "@/components/panou/prospectare/setari-limite";
import { SetariSabloane } from "@/components/panou/prospectare/setari-sabloane";
import { aziBucuresti, citesteCanale, citesteCasute, citesteConturiWhatsapp, citesteSetari } from "@/lib/prospectare/citire";
import { COOKIE_UTILIZATOR, isUtilizator, UTILIZATORI } from "@/lib/prospectare/labels";
import { requireAdmin } from "../../_components/require-admin";

export const metadata: Metadata = { title: "Setări — MERIDIAN Prospectare", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** /admin/prospectare/setari — conturile WhatsApp, limitele distribuției și ale roboților, șabloanele de mesaj. */
export default async function SetariPage() {
  await requireAdmin();
  const { azi } = aziBucuresti();
  const [setari, casute, conturi, canale, jar] = await Promise.all([citesteSetari(), citesteCasute(azi), citesteConturiWhatsapp(), citesteCanale(), cookies()]);
  const ales = jar.get(COOKIE_UTILIZATOR)?.value;
  // Previzualizarea scriptului de apel și a mesajului de după apel pune în {utilizator} numele ales în comutatorul de la Apeluri.
  const utilizator = UTILIZATORI[isUtilizator(ales) ? ales : "stefan"];
  const acum = Date.now();

  const pill = setari.ok
    ? setari.data.actualizat_de
      ? `modificate ${relativeRo(setari.data.actualizat_la, acum)}, de ${setari.data.actualizat_de}`
      : "valorile de start"
    : undefined;

  return (
    <div className="space-y-4">
      <PageHead title="Setări" pill={pill} />

      <SetariCanale canale={canale.ok ? canale.data : null} eroare={canale.ok ? null : canale.message} />

      <SetariConturi conturi={conturi.ok ? conturi.data : null} eroare={conturi.ok ? null : conturi.message} />

      {!setari.ok ? (
        <Card>
          <EroareCitire title="Setările nu s-au putut citi" message={setari.message} />
        </Card>
      ) : (
        <>
          <SetariLimite
            setari={{
              incercari_max: setari.data.incercari_max,
              rezervare_ore: setari.data.rezervare_ore,
              cereri_pe_minut: setari.data.cereri_pe_minut,
              scor_minim_constructie: setari.data.scor_minim_constructie,
              email_plafon_casuta: setari.data.email_plafon_casuta,
              apeluri_pe_zi: setari.data.apeluri_pe_zi,
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
