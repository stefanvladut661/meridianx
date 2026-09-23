import type { AppDemoMeta } from "../types";

export const meta: AppDemoMeta = {
  slug: "elyssium",
  name: "Elyssium Wellness",
  client: "Elyssium Gym · Pitești",
  kind: "Aplicație de sală · Acces cu QR",
  headline: "Abonamentul în telefon, intrarea cu QR, recepția pe un singur ecran.",
  summary:
    "O sală cu abonamente pe ședințe, SPA și aerobic are nevoie ca recepția să știe pe loc dacă omul din fața ei poate intra și ce i se consumă. Am construit aplicația pentru membri (iOS, Android și web) și panoul recepției: clientul scanează codul de la intrare, motorul verifică abonamentul și ședințele rămase, iar pop-up-ul apare instant pe ecranul recepției. Plata online, factura SmartBill și raportul lunar merg singure.",
  features: [
    "Intrare cu cod QR",
    "Pop-up live la recepție",
    "Abonamente cu contoare multiple",
    "Plată online, factură automată",
    "Anunțuri cu notificare push",
    "Rapoarte lunare pe email",
  ],
  integrations: ["Netopia", "SmartBill", "Supabase Realtime", "Notificări push", "Excel"],
  tour: [
    { screen: "acasa", title: "Abonamentul", line: "Cercul arată zilele rămase, pastilele ședințele pe fiecare tip." },
    { screen: "scanare", title: "Intrarea cu QR", line: "Clientul scanează codul, recepția vede pop-up-ul în aceeași secundă." },
    { screen: "receptie", title: "Scanări live", line: "Ecranul recepției: intrările sosesc singure, iar cele cu alegere așteaptă un clic." },
    { screen: "clienti", title: "Clienți", line: "Orice client, găsit după nume sau tag, primește abonament nou în două clicuri." },
    { screen: "dashboard", title: "Vânzări", line: "Luna față de luna trecută, intrările pe zi și cine trebuie sunat." },
    { screen: "anunturi", title: "Anunțuri", line: "Un anunț scris aici ajunge în aplicație și ca notificare pe telefon." },
    { screen: "facturi", title: "Facturare", line: "Plata Netopia activează abonamentul, iar SmartBill emite factura singur." },
  ],
  devices: ["desktop", "mobile"],
  defaultDevice: "desktop",
  brand: { bg: "#FAFAF8", accent: "#4A2B7A", fg: "#111827" },
  host: "app.elyssiumgym.ro",
};
