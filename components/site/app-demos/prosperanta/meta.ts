import type { AppDemoMeta } from "../types";

export const meta: AppDemoMeta = {
  slug: "prosperanta",
  name: "Prosperanța Club",
  client: "Prosperanța · francizat Rompetrol",
  kind: "Fidelizare · Stații de carburant",
  headline: "Puncte la fiecare litru, recompense în stație, rețeaua văzută live.",
  summary:
    "Prosperanța, unul dintre cei mai mari francizați Rompetrol din țară, voia un program de fidelizare propriu pentru cele 16 stații din Pitești. Am construit o aplicație cu trei fețe: clientul strânge puncte la alimentare și le schimbă pe recompense, angajatul adaugă litri și validează vouchere din stație, iar managementul vede rețeaua live, face campanii și primește rapoarte legate de facturare.",
  features: [
    "Puncte pe litru, pe combustibil",
    "Vouchere cu cod unic",
    "Panou pentru angajații din stație",
    "Dashboard live al rețelei",
    "Campanii afișate în aplicație",
    "Rapoarte pe stație și echipă",
  ],
  integrations: ["Sistemele Rompetrol", "Programul de facturare", "Hărți OpenStreetMap"],
  tour: [
    { screen: "dashboard", title: "Rețeaua, live", line: "Vânzările lunii, litrii și fiecare alimentare din cele 16 stații, pe măsură ce se întâmplă." },
    { screen: "home", title: "Aplicația clientului", line: "Clientul își vede punctele, campania săptămânii și cât mai are până la următoarea recompensă." },
    { screen: "statie", title: "Panoul din stație", line: "Angajatul caută clientul după telefon, adaugă litrii și punctele ajung instant în aplicație." },
    { screen: "recompense", title: "Recompense", line: "Clientul revendică o recompensă și primește un voucher cu cod unic, validat apoi la casă." },
    { screen: "campanii", title: "Campanii", line: "Managementul scrie o campanie, alege publicul și vede exact cum apare pe telefonul clientului." },
    { screen: "clienti", title: "Clienți", line: "Fișa fiecărui client: istoric, litri, vouchere și ajustări de puncte cu motiv scris." },
    { screen: "rapoarte", title: "Rapoarte", line: "Cifrele pe stație și pe echipă, plus legătura cu casele de marcat și facturarea." },
  ],
  devices: ["desktop", "mobile"],
  defaultDevice: "desktop",
  brand: { bg: "#FFFFFF", accent: "#E0061C", fg: "#1A1A1A" },
  host: "club.prosperanta.ro",
};
