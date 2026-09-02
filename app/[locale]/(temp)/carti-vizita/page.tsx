import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { CardBoard } from "./card-board";

/* ============================================================
   PAGINĂ TEMPORARĂ — modele de carte de vizită.

   Nu face parte din site: e o masă de lucru pe care stau patru
   variante ale aceleiași cărți, ca să se poată alege una înainte de
   export. Se șterge ștergând folderul `(temp)` — nu are nicio
   legătură în afară, nimic nu importă de aici.

   De-aia stă în afara diviziilor: cărțile poartă AMBELE lumi, deci
   pagina nu poate trăi nici sub `(video)`, nici sub `(software)`.
   ============================================================ */

export const metadata: Metadata = {
  title: "Modele carte de vizită",
  // Pagină internă de lucru: nu are ce căuta în index.
  robots: { index: false, follow: false },
};

export default async function CartiVizitaPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <CardBoard />;
}
