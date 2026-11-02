import type { Metadata } from "next";
import { WhatsAppScreen, type ContWhatsApp } from "@/components/panou/prospectare/whatsapp-screen";
import { aziBucuresti, citesteListaWhatsapp, citesteSetari } from "@/lib/prospectare/citire";
import { utilizatorCurent } from "@/lib/prospectare/utilizator";

export const metadata: Metadata = { title: "WhatsApp azi — MERIDIAN Prospectare", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** Când Setările nu se citesc: conturile 1–3, câte 30 pe zi (la trimitere, baza folosește Setările ei). */
const CONTURI_IMPLICITE: ContWhatsApp[] = [1, 2, 3].map((cont) => ({ cont, limita: 30 }));

/** Conturile din `whatsapp_pe_cont` ({"1":30,"2":30}): chei 1–9, limita ca număr întreg (null dacă nu e număr). */
function conturiDinSetari(valoare: unknown): ContWhatsApp[] {
  if (!valoare || typeof valoare !== "object" || Array.isArray(valoare)) return [];
  return Object.entries(valoare as Record<string, unknown>)
    .map(([cheie, limita]) => ({ cont: Number(cheie), limita: Number(limita) }))
    .filter((c) => Number.isInteger(c.cont) && c.cont >= 1 && c.cont <= 9)
    .map((c) => ({ cont: c.cont, limita: Number.isFinite(c.limita) ? Math.max(0, Math.round(c.limita)) : null }))
    .sort((a, b) => a.cont - b.cont);
}

/**
 * /admin/prospectare/whatsapp — lista de WhatsApp, continuă și comună: firmele
 * intră singure (site gata, mobil; cu email, la o zi după email). Comutatorul
 * Ștefan / Vlăduț spune doar cine trimite. Garda de admin e în layout.
 */
export default async function WhatsAppPage() {
  const cine = await utilizatorCurent(null);
  const { azi } = aziBucuresti();
  const [lista, setari] = await Promise.all([citesteListaWhatsapp(200), citesteSetari()]);

  return (
    <WhatsAppScreen
      cine={cine}
      azi={azi}
      lista={lista.ok ? lista.data : null}
      eroareLista={lista.ok ? null : lista.message}
      conturi={setari.ok ? conturiDinSetari(setari.data.whatsapp_pe_cont) : CONTURI_IMPLICITE}
      sablon={setari.ok ? (setari.data.sablon_whatsapp_primul ?? "") : ""}
      eroareSetari={setari.ok ? null : setari.message}
    />
  );
}
