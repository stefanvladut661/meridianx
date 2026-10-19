import { Inter, Sora } from "next/font/google";

/* ============================================================
   Fonturile aplicației Elyssium, nu ale MERIDIAN.

   Sora e fața de afișaj a aplicației client (salutul, numele
   abonamentului, cifra din cerc, prețul). Inter e textul de lucru,
   în ambele aplicații: panoul recepției și aplicația membrului.

   Nu se preîncarcă: demo-ul se deschide doar pe pagina proiectului,
   iar bugetul de preîncărcare al site-ului (app/fonts.ts) rămâne
   neatins. Subsetul latin-ext aduce ă, ș și ț.
   ============================================================ */

export const sora = Sora({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "600"],
  display: "swap",
  preload: false,
  variable: "--font-ely-sora",
});

export const inter = Inter({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600"],
  display: "swap",
  preload: false,
  variable: "--font-ely-ui",
});
