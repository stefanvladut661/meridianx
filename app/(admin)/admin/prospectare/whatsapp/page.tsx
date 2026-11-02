import type { Metadata } from "next";
import { WhatsAppScreen, type ContWhatsApp } from "@/components/panou/prospectare/whatsapp-screen";
import { aziBucuresti, citesteFolosireConturi, citesteListaZi, citesteRezerva, citesteSetari, reporteazaListe } from "@/lib/prospectare/citire";
import { utilizatorCurent } from "@/lib/prospectare/utilizator";

export const metadata: Metadata = { title: "WhatsApp azi — MERIDIAN Prospectare", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * /admin/prospectare/whatsapp — lista de WhatsApp a zilei, pe cont, a celui
 * ales în comutator. Conturile sunt cheile din Setări (`whatsapp_pe_cont`),
 * plus orice cont care are deja rânduri azi. `?cont=` alege contul.
 */
export default async function WhatsAppPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const cine = await utilizatorCurent(params.cine);
  // Acțiunile salvează pe cel din cookie; `?cine=` schimbă doar ce vezi.
  const salvat = await utilizatorCurent(null);
  const { azi } = aziBucuresti();
  // Ce a rămas netrimis în zilele trecute trece pe azi înainte de citire.
  await reporteazaListe();
  const [lista, rezerva, setari, folosire] = await Promise.all([
    citesteListaZi(cine, "whatsapp", azi),
    citesteRezerva(),
    citesteSetari(),
    citesteFolosireConturi(azi),
  ]);

  const randuri = lista.ok ? lista.data : [];
  const limite: Record<string, unknown> = setari.ok ? (setari.data.whatsapp_pe_cont ?? {}) : {};
  const chei = new Set<number>();
  for (const k of Object.keys(limite)) {
    const n = Number(k);
    if (Number.isInteger(n) && n >= 1 && n <= 9) chei.add(n);
  }
  for (const r of randuri) if (r.cont_whatsapp) chei.add(r.cont_whatsapp);

  const conturi: ContWhatsApp[] = [...chei]
    .sort((a, b) => a - b)
    .map((cont) => {
      const limita = Number(limite[String(cont)] ?? 0);
      return {
        cont,
        limita: setari.ok ? (Number.isFinite(limita) ? Math.max(0, limita) : 0) : null,
        folosite: folosire.ok ? (folosire.data[String(cont)] ?? 0) : null,
      };
    });

  // Contul din adresă; altfel primul cu mesaje de trimis, apoi primul cu loc azi, apoi primul.
  const dinAdresa = Number(Array.isArray(params.cont) ? params.cont[0] : params.cont);
  const contInitial =
    conturi.find((c) => c.cont === dinAdresa)?.cont ??
    conturi.find((c) => randuri.some((r) => r.cont_whatsapp === c.cont && r.rezultat !== "trimis"))?.cont ??
    conturi.find((c) => c.limita !== null && c.limita - (c.folosite ?? 0) > 0)?.cont ??
    conturi[0]?.cont ??
    null;

  return (
    <WhatsAppScreen
      cine={cine}
      salvat={salvat}
      azi={azi}
      randuri={lista.ok ? lista.data : null}
      eroareLista={lista.ok ? null : lista.message}
      rezerva={rezerva.ok ? rezerva.data : null}
      eroareRezerva={rezerva.ok ? null : rezerva.message}
      conturi={conturi}
      contInitial={contInitial}
      sablon={setari.ok ? (setari.data.sablon_whatsapp_primul ?? "") : ""}
      eroareSetari={setari.ok ? null : setari.message}
    />
  );
}
