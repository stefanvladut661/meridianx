import { DM_Sans, Playfair_Display } from "next/font/google";

/* Fonturile reale ale site-ului confortsolutions.ro (src/index.css,
   linia 1): Playfair Display 400/700/900 pentru h1–h4 și DM Sans
   300–700 pentru restul. Aceleași fișiere, servite de pe domeniul
   nostru prin next/font (CSP-ul blochează fonts.googleapis.com).

   Nu se preîncarcă: demo-ul apare abia pe pagina lui și nu are voie
   să concureze cu fonturile MERIDIAN pentru LCP. `latin-ext` e
   obligatoriu: ă, ș și ț trăiesc acolo. */

export const playfair = Playfair_Display({
  weight: ["400", "700", "900"],
  subsets: ["latin", "latin-ext"],
  display: "swap",
  preload: false,
  variable: "--ai-heading",
});

export const dmSans = DM_Sans({
  weight: ["300", "400", "500", "600", "700"],
  subsets: ["latin", "latin-ext"],
  display: "swap",
  preload: false,
  variable: "--ai-body",
});
