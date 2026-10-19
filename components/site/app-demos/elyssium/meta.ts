import type { AppDemoMeta } from "../types";

export const meta: AppDemoMeta = {
  slug: "elyssium",
  name: "Elyssium Wellness",
  client: "Elyssium Gym · Pitești",
  kind: "Aplicație de sală · Acces cu QR",
  headline: "Membrii intră cu un cod QR, iar recepția vede abonamentul.",
  summary:
    "La Elyssium, abonamentele se consumă pe ședințe de fitness, SPA și aerobic, iar recepția trebuie să știe la intrare ce i se scade fiecărui membru. Am construit aplicația pentru membri (iOS, Android, web) și panoul recepției, cu plata prin Netopia și facturile emise în SmartBill.",
  features: [
    "Intrare cu cod QR",
    "Scanarea apare la recepție",
    "Abonamente cu mai multe contoare",
    "Plată Netopia, factură SmartBill",
    "Anunțuri cu notificare push",
    "Raport lunar pe email",
  ],
  integrations: ["Netopia", "SmartBill"],
  tour: [
    { screen: "acasa", title: "Acasă", group: "Membru", device: "mobile" },
    {
      screen: "scanare",
      title: "Intrarea cu QR",
      line: "A doua scanare din aceeași zi nu mai consumă o ședință.",
      group: "Membru",
      device: "mobile",
    },
    { screen: "receptie", title: "Scanări", line: "Deschide o scanare în așteptare și alege ce se consumă.", group: "Recepție" },
    { screen: "clienti", title: "Clienți", line: "Deschide un client și vinde-i un abonament nou.", group: "Recepție" },
    { screen: "dashboard", title: "Dashboard", group: "Recepție" },
    { screen: "anunturi", title: "Anunțuri", group: "Recepție" },
    { screen: "facturi", title: "Rapoarte", line: "Fiecare plată Netopia primește factură SmartBill, seria APP.", group: "Recepție" },
  ],
  devices: ["desktop", "mobile"],
  defaultDevice: "desktop",
  brand: { bg: "#FAFAF8", accent: "#4A2B7A", fg: "#111827" },
};
