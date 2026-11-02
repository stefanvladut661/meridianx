import type { Metadata } from "next";
import { ApeluriScreen } from "@/components/panou/prospectare/apeluri-screen";
import { aziBucuresti, citesteListaZi, citesteRezerva, citesteSetari, reporteazaListe } from "@/lib/prospectare/citire";
import { utilizatorCurent } from "@/lib/prospectare/utilizator";

export const metadata: Metadata = { title: "Apeluri azi — MERIDIAN Prospectare", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * /admin/prospectare/apeluri — lista de telefon a zilei, a celui ales în
 * comutatorul Ștefan / Vlăduț. Garda de admin e în layout-ul modulului.
 */
export default async function ApeluriPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const cine = await utilizatorCurent(params.cine);
  // Acțiunile salvează pe cel din cookie; `?cine=` schimbă doar ce vezi.
  const salvat = await utilizatorCurent(null);
  const { azi } = aziBucuresti();
  // Ce a rămas nesunat în zilele trecute trece pe azi înainte de citire.
  await reporteazaListe();
  const [lista, rezerva, setari] = await Promise.all([citesteListaZi(cine, "telefon", azi), citesteRezerva(), citesteSetari()]);

  return (
    <ApeluriScreen
      cine={cine}
      salvat={salvat}
      azi={azi}
      acum={Date.now()}
      randuri={lista.ok ? lista.data : null}
      eroareLista={lista.ok ? null : lista.message}
      rezerva={rezerva.ok ? rezerva.data : null}
      eroareRezerva={rezerva.ok ? null : rezerva.message}
      setari={
        setari.ok
          ? { incercariMax: setari.data.incercari_max, scriptApel: setari.data.sablon_script_apel ?? "", dupaApel: setari.data.sablon_whatsapp_dupa_apel ?? "" }
          : { incercariMax: 3, scriptApel: "", dupaApel: "" }
      }
      eroareSetari={setari.ok ? null : setari.message}
    />
  );
}
