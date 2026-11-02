import type { Metadata } from "next";
import { WhatsAppScreen } from "@/components/panou/prospectare/whatsapp-screen";
import { aziBucuresti, citesteConturiWhatsapp, citesteListaWhatsapp, citesteSetari } from "@/lib/prospectare/citire";

export const metadata: Metadata = { title: "WhatsApp azi — MERIDIAN Prospectare", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * /admin/prospectare/whatsapp — lista de WhatsApp, continuă și comună: intră
 * singure firmele cu site gata, mobil și niciun contact, plus cele cu WhatsApp
 * permis din fișă (primele). Se trimite de pe conturile din Setări; contul e
 * autorul din activitate. Garda de admin e în layout.
 */
export default async function WhatsAppPage() {
  const { azi } = aziBucuresti();
  const [lista, setari, conturi] = await Promise.all([citesteListaWhatsapp(200), citesteSetari(), citesteConturiWhatsapp()]);

  return (
    <WhatsAppScreen
      azi={azi}
      lista={lista.ok ? lista.data : null}
      eroareLista={lista.ok ? null : lista.message}
      conturi={conturi.ok ? conturi.data : null}
      eroareConturi={conturi.ok ? null : conturi.message}
      sablon={setari.ok ? (setari.data.sablon_whatsapp_primul ?? "") : ""}
      eroareSetari={setari.ok ? null : setari.message}
    />
  );
}
