import { Inter, Wix_Madefor_Display, Wix_Madefor_Text } from "next/font/google";

/* ============================================================
   Fonturile TableX, nu ale MERIDIAN — exact cele din produs
   (src/index.css după redesignul din 2 oct. 2026):

   · Wix Madefor Text — interfața și cifrele (tabulare);
   · Wix Madefor Display — titlurile h1–h4, strânse la -0.022em.

   Inter NU e font TableX: produsul îl încarcă doar pentru stilurile
   formularului public, care sunt identitatea RESTAURANTULUI. De aceea
   îl poartă numai pagina de rezervare a Trattoriei Nord.

   Variabile, nu greutăți fixe: produsul folosește 550 pe butoane și
   etichete, iar axa de greutate o dă fără un al treilea fișier.
   Nu se preîncarcă: demo-ul trăiește doar pe pagina proiectului, iar
   bugetul de preîncărcare al site-ului (app/fonts.ts) rămâne neatins.
   Subsetul latin-ext aduce ă, ș și ț.
   ============================================================ */

export const fontText = Wix_Madefor_Text({
  subsets: ["latin", "latin-ext"],
  display: "swap",
  preload: false,
  variable: "--font-tx-sans",
});

export const fontTitlu = Wix_Madefor_Display({
  subsets: ["latin", "latin-ext"],
  display: "swap",
  preload: false,
  variable: "--font-tx-display",
});

/** Pagina publică a restaurantului (stilul formularului ales de el). */
export const fontOaspete = Inter({
  subsets: ["latin", "latin-ext"],
  display: "swap",
  preload: false,
  variable: "--font-tx-guest",
});
