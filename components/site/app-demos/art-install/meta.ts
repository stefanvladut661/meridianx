import type { AppDemoMeta } from "../types";

/* Art Instal Suppliers — site HVAC cu calculator de pompe de căldură.
   Domeniul din bara browserului: confortsolutions.ro (adresa de pe care
   site-ul servea clipurile și căsuța de email din formularul de contact). */
export const meta: AppDemoMeta = {
  slug: "art-install",
  name: "Art Instal",
  client: "Art Install Suppliers",
  kind: "Site de prezentare · Instalații HVAC",
  headline: "Site HVAC care recomandă pompa de căldură potrivită casei.",
  summary:
    "Art Instal vinde și montează pompe de căldură, aer condiționat și centrale termice. Prima întrebare a oricărui client e ce putere îi trebuie, așa că site-ul are un calculator: din șapte întrebări despre casă estimează necesarul termic și alege cel mai mic model suficient, Daikin sau o alternativă mai accesibilă. Cererea de ofertă pornește apoi cu modelul și datele casei deja scrise.",
  features: [
    "Calculator de necesar termic",
    "Recomandare Daikin plus alternativă",
    "Magazin cu variante de putere",
    "Portofoliu filtrat pe categorii",
    "Cerere de ofertă precompletată",
  ],
  integrations: ["Formular pe email", "WhatsApp", "Google Maps"],
  tour: [
    {
      screen: "home",
      title: "Prima pagină",
      line: "Identitatea reală a firmei: servicii, garanții și drumul scurt spre calculator.",
    },
    {
      screen: "calculator",
      title: "Calculatorul",
      line: "Șapte întrebări despre casă, într-un singur formular, ca pe site.",
    },
    {
      screen: "recomandare",
      title: "Recomandarea",
      line: "Necesarul în kW, modelul Daikin și alternativa accesibilă, chiar sub formular.",
    },
    {
      screen: "magazin",
      title: "Magazinul",
      line: "Zece echipamente Daikin, Hyundai și TCL, cu variante de putere și cerere de ofertă.",
    },
    {
      screen: "portofoliu",
      title: "Portofoliu",
      line: "Lucrări pe categorii, deschise într-o galerie navigabilă din tastatură.",
    },
    {
      screen: "recenzii",
      title: "Recenzii",
      line: "Nota 4.98 pe Google și ce scriu clienții, pe pagina lor.",
    },
    {
      screen: "contact",
      title: "Cerere de ofertă",
      line: "Formular validat câmp cu câmp; din calculator vine deja completat.",
    },
  ],
  devices: ["desktop", "mobile"],
  defaultDevice: "desktop",
  brand: { bg: "#0E1115", accent: "#F97316", fg: "#EBE6E0" },
  host: "confortsolutions.ro",
};
