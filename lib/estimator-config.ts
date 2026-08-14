/**
 * Configurația estimatorului software (FAZA 5).
 *
 * ⚠️ CIFRELE DE AICI SUNT PARAMETRI DE BUSINESS, NU ADEVĂRURI.
 * Sunt puncte de plecare propuse, calibrate pe ținta din brief
 * (5.000–15.000 €, deschidere până la 60.000 €). **Omul trebuie să le
 * confirme sau să le ajusteze înainte de lansare** — e singurul loc din
 * tot site-ul unde apar prețuri (CLAUDE.md: estimatorul e excepția, și
 * e explicit un instrument, nu un tarif).
 *
 * Tot ce ține de calcul stă în acest fișier ca să poată fi reglat fără
 * să umbli prin componente. Logica pură e în
 * `components/software/estimator/estimate.ts`.
 */

export type ProjectTypeId =
  | "prezentare"
  | "ecommerce"
  | "aplicatie-web"
  | "aplicatie-mobila"
  | "automatizare-ai"
  | "altceva";

export interface ProjectType {
  id: ProjectTypeId;
  label: string;
  /** O linie, în cuvintele clientului — nu în cuvintele noastre. */
  summary: string;
  /** Intervalul de bază, în €, pentru configurația minimă. */
  base: [number, number];
  /** Câte ecrane/pagini intră în baza de mai sus. */
  includedScreens: number;
  /** Cost pentru fiecare ecran peste cele incluse. */
  perScreen: [number, number];
  /** „pagini" pentru site-uri, „ecrane" pentru aplicații. */
  screenNoun: string;
  /** Unele proiecte nu se pot estima înainte de o discuție. */
  estimable: boolean;
}

export const PROJECT_TYPES: ProjectType[] = [
  {
    id: "prezentare",
    label: "Site de prezentare",
    summary: "Vitrina firmei: cine ești, ce faci, de ce să te sune cineva.",
    base: [2500, 4500],
    includedScreens: 6,
    perScreen: [250, 420],
    screenNoun: "pagini",
    estimable: true,
  },
  {
    id: "ecommerce",
    label: "Magazin online",
    summary: "Vinzi produse direct, cu plată online și gestiune de comenzi.",
    base: [6000, 11000],
    includedScreens: 8,
    perScreen: [280, 480],
    screenNoun: "pagini",
    estimable: true,
  },
  {
    id: "aplicatie-web",
    label: "Aplicație web la comandă",
    summary:
      "Un instrument intern sau un produs: conturi, date, fluxuri de lucru.",
    base: [10000, 18000],
    includedScreens: 8,
    perScreen: [600, 1100],
    screenNoun: "ecrane",
    estimable: true,
  },
  {
    id: "aplicatie-mobila",
    label: "Aplicație mobilă",
    summary: "Aplicație pentru telefon, pe Android și iOS.",
    base: [14000, 26000],
    includedScreens: 8,
    perScreen: [800, 1500],
    screenNoun: "ecrane",
    estimable: true,
  },
  {
    id: "automatizare-ai",
    label: "Automatizare sau AI",
    summary:
      "Muncă repetitivă preluată de un sistem: procesare, integrări, asistenți.",
    base: [5000, 12000],
    includedScreens: 4,
    perScreen: [500, 1100],
    screenNoun: "fluxuri",
    estimable: true,
  },
  {
    id: "altceva",
    label: "Altceva / încă nu știu",
    summary: "Ai o problemă, nu o soluție. E un început perfect valid.",
    base: [0, 0],
    includedScreens: 0,
    perScreen: [0, 0],
    screenNoun: "elemente",
    estimable: false,
  },
];

export interface Addon {
  id: string;
  label: string;
  /** Ce înseamnă concret — apare sub etichetă, în text mic. */
  hint: string;
  range: [number, number];
  /** Dacă lipsește, opțiunea apare la toate tipurile estimabile. */
  appliesTo?: ProjectTypeId[];
}

export const FEATURES: Addon[] = [
  {
    id: "conturi",
    label: "Conturi de utilizator",
    hint: "Autentificare, roluri, resetare de parolă.",
    range: [1200, 2500],
  },
  {
    id: "plati",
    label: "Plăți online",
    hint: "Card, procesator de plăți, facturi automate.",
    range: [1500, 3000],
  },
  {
    id: "programari",
    label: "Programări sau rezervări",
    hint: "Calendar, disponibilitate, confirmări automate.",
    range: [1200, 2600],
  },
  {
    id: "admin",
    label: "Panou de administrare",
    hint: "Îți administrezi singur conținutul și datele, fără să ne suni.",
    range: [1800, 4000],
  },
  {
    id: "rapoarte",
    label: "Rapoarte și export",
    hint: "Grafice, filtre, export în Excel sau PDF.",
    range: [900, 2200],
  },
  {
    id: "notificari",
    label: "Notificări automate",
    hint: "Email sau SMS la evenimentele care contează.",
    range: [600, 1400],
  },
  {
    id: "harta",
    label: "Hărți și geolocalizare",
    hint: "Puncte pe hartă, căutare după zonă, trasee.",
    range: [700, 1600],
  },
  {
    id: "asistent-ai",
    label: "Asistent AI",
    hint: "Răspunde la întrebări pe datele tale, nu pe internet.",
    range: [2000, 5000],
  },
];

export const INTEGRATIONS: Addon[] = [
  {
    id: "facturare",
    label: "Program de facturare sau ERP",
    hint: "SmartBill, Oblio, SAGA sau ERP-ul pe care îl folosești deja.",
    range: [1500, 4000],
  },
  {
    id: "crm",
    label: "CRM",
    hint: "Lead-urile ajung direct unde le urmărește echipa de vânzări.",
    range: [1000, 2500],
  },
  {
    id: "curierat",
    label: "Curierat",
    hint: "AWB generat automat, urmărire coletelor în cont.",
    range: [800, 2000],
    appliesTo: ["ecommerce", "aplicatie-web", "automatizare-ai"],
  },
  {
    id: "api-extern",
    label: "Alt sistem prin API",
    hint: "Orice serviciu care are documentație și îți ține date.",
    range: [900, 2200],
  },
];

/** Multilingv — procent aplicat peste subtotal, nu sumă fixă. */
export const MULTILINGUAL = {
  /** A doua limbă. */
  secondLanguage: [0.12, 0.2] as [number, number],
  /** Fiecare limbă în plus, peste a doua. */
  extraLanguage: [0.06, 0.1] as [number, number],
};

/** Mentenanța e recurentă — NU se adună în intervalul de proiect. */
export const MAINTENANCE = {
  id: "mentenanta",
  label: "Mentenanță lunară",
  hint: "Actualizări, copii de siguranță, monitorizare, ore de modificări incluse.",
  monthly: [250, 700] as [number, number],
};

/**
 * Cât de larg deschidem intervalul, în funcție de cât știm.
 *
 * Asta e ideea instrumentului: nu pretindem precizie pe care n-o avem.
 * Cu un singur răspuns, estimarea e o bandă lată. Cu tot brief-ul
 * completat, se strânge — dar tot rămâne un interval, niciodată un preț.
 */
export const UNCERTAINTY = {
  /** Știm doar tipul de proiect. */
  type: 0.35,
  /** Știm și ce conține. */
  composition: 0.18,
  /** Știm și contextul și termenul. */
  context: 0.1,
};

/** Rotunjim la multiplu de, ca să nu pretindem precizie la euro. */
export const ROUNDING = 500;

/** Sub atât nu coborâm, oricât de mic ar fi proiectul. */
export const FLOOR = 1500;

/** Peste atât spunem „discutăm", nu dăm cifră. */
export const CEILING = 60000;
