import type { Metadata } from "next";
import { num } from "@/components/panou/ui/format";
import { Card, SectionTitle } from "@/components/panou/ui/primitives";
import { DistributieApeluriProvider } from "@/components/panou/prospectare/apeluri-import";
import { ApeluriScreen } from "@/components/panou/prospectare/apeluri-screen";
import { EroareCitire } from "@/components/panou/prospectare/prezentare-eroare";
import { cate } from "@/components/panou/prospectare/prezentare-comun";
import { ProgramariViitoare } from "@/components/panou/prospectare/programari-viitoare";
import {
  aziBucuresti,
  citesteListaZi,
  citesteOptiuniDistributie,
  citesteProgramariViitoare,
  citesteRezerva,
  citesteSetari,
  maineBucuresti,
  reporteazaListe,
} from "@/lib/prospectare/citire";
import { UTILIZATORI } from "@/lib/prospectare/labels";
import type { Utilizator } from "@/lib/prospectare/types";
import { utilizatorCurent } from "@/lib/prospectare/utilizator";

export const metadata: Metadata = { title: "Apeluri azi — MERIDIAN Prospectare", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * /admin/prospectare/apeluri — lista de telefon a zilei, a celui ales în
 * comutatorul Ștefan / Vlăduț, importul din rezervă, „Programează” pentru zilele
 * următoare și programările lui de mâine încolo. Garda de admin e în layout-ul modulului.
 */
export default async function ApeluriPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const cine = await utilizatorCurent(params.cine);
  // Acțiunile salvează pe cel din cookie; `?cine=` schimbă doar ce vezi.
  const salvat = await utilizatorCurent(null);
  const { azi } = aziBucuresti();
  const maine = maineBucuresti(azi);
  // Ciclul de azi (00:00) rulează înainte de citire, dacă n-a rulat; „Sună înapoi” de ieri trece pe azi.
  await reporteazaListe();
  const [lista, rezerva, setari, optiuni, viitoare] = await Promise.all([
    citesteListaZi(cine, "telefon", azi),
    citesteRezerva(),
    citesteSetari(),
    citesteOptiuniDistributie(),
    citesteProgramariViitoare("telefon", maine),
  ]);

  // Fiecare vede doar programările lui; ale celuilalt doar se numără.
  const ale = viitoare.ok ? viitoare.data.filter((p) => p.utilizator === cine) : [];
  const celalalt: Utilizator = cine === "stefan" ? "vladut" : "stefan";
  const aleCeluilalt = viitoare.ok ? viitoare.data.filter((p) => p.utilizator === celalalt).length : 0;

  return (
    <div className="space-y-4">
      <DistributieApeluriProvider value={{ azi, cine, optiuni: optiuni.ok ? optiuni.data : null }}>
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
      </DistributieApeluriProvider>

      <Card id="programate">
        <SectionTitle
          title="Programate de mâine încolo"
          hint={
            viitoare.ok
              ? `${cate(ale.length, "firmă", "firme")} pentru ${UTILIZATORI[cine]}${aleCeluilalt ? ` · ${UTILIZATORI[celalalt]} are ${num(aleCeluilalt)}` : ""} · intră în „Apeluri azi” la 00:00, în ziua lor; se anulează până atunci`
              : undefined
          }
        />
        <div className="mt-3">
          {viitoare.ok ? (
            <ProgramariViitoare
              canal="telefon"
              programari={ale}
              gol={`Nimic programat pentru ${UTILIZATORI[cine]} de mâine încolo. Apelurile nu se programează singure: cu „Programează” (lângă import) alegi firmele și ziua, iar în ziua aleasă ele intră în lista ta la 00:00${setari.ok ? `, cel mult ${num(setari.data.apeluri_pe_zi)} pe zi` : ""}.`}
            />
          ) : (
            <EroareCitire title="Programările nu s-au putut citi" message={viitoare.message} className="py-8" />
          )}
        </div>
      </Card>
    </div>
  );
}
