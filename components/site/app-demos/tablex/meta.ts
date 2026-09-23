import type { AppDemoMeta } from "../types";

export const meta: AppDemoMeta = {
  slug: "tablex",
  name: "TableX",
  client: "Produs MERIDIAN",
  kind: "SaaS de rezervări · HoReCa",
  headline: "Rezervări, harta live a sălii și clienții restaurantului, fără comision.",
  summary:
    "Platformele de rezervări iau comision pe fiecare client adus, iar multe restaurante țin încă sala într-o agendă de hârtie. TableX e sistemul nostru pentru HoReCa: harta 2D a sălii cu starea fiecărei mese, pagină publică de rezervare pentru bio și site, fișe de client, evenimente cu bilete și mesaje automate. Restaurantul plătește un abonament lunar fix; rezervările sunt nelimitate, fără comision pe rezervare sau pe persoană.",
  features: [
    "Hartă 2D live a sălii",
    "Walk-in în două atingeri",
    "Pagină publică de rezervare",
    "Fișe de client automate",
    "Evenimente cu bilete QR",
    "Confirmări și remindere WhatsApp",
  ],
  integrations: ["Supabase Realtime", "Iframe pe site-ul restaurantului", "Link în bio", "Aplicație instalabilă pe tabletă"],
  tour: [
    {
      screen: "harta",
      title: "Harta live",
      line: "Sala în timp real: atinge o masă liberă și așezi un walk-in în două atingeri.",
    },
    {
      screen: "rezervari",
      title: "Seara pe mese",
      line: "Cererile noi intră live; le accepți, le aloci o masă sau le marchezi sosite.",
    },
    {
      screen: "widget",
      title: "Rezervare online",
      line: "Ce vede oaspetele din linkul din bio: oră, persoane, chiar și masa dorită.",
    },
    {
      screen: "client",
      title: "Fișa clientului",
      line: "Fiecare telefon devine o fișă: vizite, preferințe și semnal roșu la neprezentări.",
    },
    {
      screen: "evenimente",
      title: "Marketing",
      line: "Seri cu bilete QR, anunț pe pagina de rezervare, remindere automate.",
    },
    {
      screen: "acasa",
      title: "Ziua în cifre",
      line: "Ocupare, persoane așteptate, surse și neprezentări, dintr-o privire.",
    },
    {
      screen: "retea",
      title: "Toată rețeaua",
      line: "Panoul echipei TableX: restaurantele din toată țara și rezervările lor, live.",
    },
  ],
  devices: ["desktop", "mobile"],
  defaultDevice: "desktop",
  brand: { bg: "#1e293b", accent: "#60a5fa", fg: "#e2e8f0" },
  host: "tablex.ro",
};
