import type { AppDemoMeta } from "../types";

export const meta: AppDemoMeta = {
  slug: "zof",
  name: "Zof Stoc Online",
  client: "ZOF Optogerman",
  kind: "Management central · Rețea de optică",
  headline: "Toate magazinele, vânzările și stocul lor, într-un singur ecran.",
  summary:
    "Fiecare magazin Zof Optogerman lucra în propria gestiune desktop, offline, așa că vânzările și stocul se vedeau doar la fața locului. Am pus în fiecare locație un agent care citește gestiunea fără să scrie în ea și trimite datele semnat la un server central. Acum cifrele întregii rețele se văd într-un singur loc, de pe telefon sau de pe laptop.",
  features: [
    "Gestiuni offline aduse online",
    "Vânzări pe locații, în timp real",
    "Stocul fiecărui magazin, căutabil",
    "Profit și marjă estimate",
    "Agenți monitorizați, buffer local",
    "Export Excel, CSV, PDF",
  ],
  integrations: ["DorSoft", "Microsoft Access", "Shopify (zof.ro)", "Excel / CSV / PDF"],
  tour: [
    { screen: "dashboard", title: "Dashboard", line: "Vânzările întregii rețele, azi sau pe 12 luni, cu profitul și încasările pe card și numerar." },
    { screen: "locatii", title: "Locații", line: "Fiecare magazin are un agent. Apasă „Sincronizează acum” la Câmpulung și vezi bufferul golindu-se." },
    { screen: "locatie", title: "Un magazin", line: "Un magazin în detaliu: vânzări pe ore, încasări, bonurile care intră și agentul care le aduce." },
    { screen: "rame", title: "Stoc în rețea", line: "Caută „aviator” și vezi, pe loc, în care magazine mai e marfă." },
    { screen: "vanzari", title: "Jurnal vânzări", line: "Fiecare bon din fiecare locație, filtrabil și deschis pe linii." },
    { screen: "rapoarte", title: "Rapoarte", line: "Venit, profit și marjă pe 12 luni, per magazin și per brand, gata de export." },
  ],
  devices: ["desktop", "mobile"],
  defaultDevice: "desktop",
  brand: { bg: "#030711", accent: "#2563EB", fg: "#E1E7EF" },
  host: "stoc.zof.ro",
};
