import type { ComponentType } from "react";

/* ============================================================
   Contractul demo-urilor de aplicații (/software/proiecte).

   Fiecare aplicație din portofoliu trăiește în propriul folder:

     components/site/app-demos/<slug>/meta.ts   — `meta: AppDemoMeta`
     components/site/app-demos/<slug>/demo.tsx  — `export default`
                                                  un ComponentType<DemoProps>

   Demo-ul se desenează pe o PÂNZĂ DE MĂRIME FIXĂ — DEMO_CANVAS[device]
   — pe care vizualizatorul o scalează cu `transform: scale()` ca să
   încapă în orice ecran. Consecința: în interiorul demo-ului NU există
   media queries și nici breakpoint-uri Tailwind. Layout-ul pentru
   telefon îl alegi din prop-ul `device`, nu din lățimea ferestrei.

   Datele sunt toate inventate, pentru demonstrație. Vizualizatorul le
   marchează ca atare; demo-ul nu trebuie să le prezinte drept cifre
   reale ale clientului.
   ============================================================ */

export type DemoDevice = "desktop" | "mobile";

/** Pânza pe care se desenează demo-ul, în pixeli CSS, înainte de scalare. */
export const DEMO_CANVAS: Record<DemoDevice, { w: number; h: number }> = {
  desktop: { w: 1280, h: 800 },
  mobile: { w: 390, h: 844 },
};

/**
 * Pe telefon, pânza e tot ecranul, ca pe un iPhone real: primii 44px
 * sunt bara de stare — demo-ul o desenează cu <StatusBar/> din kit, pe
 * fundalul propriului header — iar vizualizatorul pune insula dinamică
 * peste ea. Ultimii 20px sunt indicatorul „home”, desenat tot de
 * vizualizator, peste demo: nu pune butoane acolo.
 */
export const MOBILE_SAFE_TOP = 44;
export const MOBILE_SAFE_BOTTOM = 20;

/** Un pas din turul ghidat din bara laterală a vizualizatorului. */
export type DemoTourStep = {
  /** Id-ul ecranului pe care îl deschide pasul. Trebuie să existe în demo. */
  screen: string;
  /** 1–3 cuvinte, exact eticheta din meniul aplicației. */
  title: string;
  /**
   * Opțional. Max. 60 de caractere, doar ce ecranul nu arată singur: o
   * interacțiune ascunsă sau efectul ei în alt ecran. Fără „live”,
   * „instant”, „singur” și fără tiparul „X: Y”. Majoritatea pașilor n-au.
   */
  line?: string;
  /**
   * Rolul care vede ecranul („Admin”, „Client”, „Recepție”). Pașii
   * consecutivi cu același grup se afișează sub o singură etichetă.
   */
  group?: string;
  /**
   * Dispozitivul pe care se deschide pasul (ex. aplicația clientului pe
   * telefon). Vizualizatorul îl respectă doar dacă vizitatorul n-a ales
   * singur dispozitivul.
   */
  device?: DemoDevice;
};

export type AppDemoMeta = {
  slug: string;
  /** Numele aplicației, cum apare pe ecran. */
  name: string;
  /** Pentru cine: firma clientului (sau „Produs MERIDIAN”). */
  client: string;
  /** Categoria, scurt: „Fidelizare · Stații de carburant”. */
  kind: string;
  /** O propoziție, maximum ~12 cuvinte: ce face aplicația. */
  headline: string;
  /** Max. 2 propoziții: problema clientului și ce am construit, cu un fapt concret. */
  summary: string;
  /**
   * 4–6 funcții, fiecare în maximum 5 cuvinte. Nu se mai afișează pe
   * suprafețe (turul e lista de funcții); rămân pentru uz intern.
   */
  features: string[];
  /**
   * Doar sisteme EXTERNE cu care se leagă aplicația (Netopia, SmartBill,
   * DorSoft). Nu funcții, formate de export sau canale. Opțional.
   */
  integrations?: string[];
  /**
   * Înlocuiește nota standard despre datele inventate, când nu se
   * potrivește (ex. Art Instal: conținutul e preluat de pe site-ul real).
   */
  disclaimer?: string;
  /** 4–7 pași. Primul e ecranul de pornire. */
  tour: DemoTourStep[];
  /** Pe ce dispozitive are demo-ul layout propriu. De preferat ambele. */
  devices: DemoDevice[];
  /** Cu ce dispozitiv se deschide pe un ecran mare. */
  defaultDevice: DemoDevice;
  /** Culorile mărcii aplicației — pentru cardul din portofoliu. */
  brand: {
    /** fundalul dominant al aplicației */
    bg: string;
    /** accentul principal */
    accent: string;
    /** text pe fundalul `bg` */
    fg: string;
  };
  /**
   * Domeniul REAL și public al aplicației, fără protocol
   * („confortsolutions.ro”). Vizualizatorul îl afișează ca link extern.
   * Lipsește dacă domeniul nu e confirmat (CLAUDE.md §5: nu inventăm).
   */
  host?: string;
};

export type DemoProps = {
  device: DemoDevice;
  /** Ecranul curent. Controlat de vizualizator (turul îl poate schimba). */
  screen: string;
  /** Navigare internă: schimbă ecranul curent. */
  go: (screen: string) => void;
  /**
   * Pentru acțiunile blocate în demo (ștergere, plată reală, export,
   * trimitere de mesaje). Vizualizatorul afișează un toast scurt, în
   * afara aplicației. O propoziție, max. ~70 de caractere, despre ce e
   * oprit: „Exportul CSV e oprit în demo.”
   */
  notify: (message: string) => void;
  /** prefers-reduced-motion: fără bucle, fără contoare care urcă singure. */
  reducedMotion: boolean;
};

export type DemoComponent = ComponentType<DemoProps>;
