import { Inter } from "next/font/google";

/* ============================================================
   Fontul aplicației Zof Stoc Online, nu al MERIDIAN.

   Aplicația reală încarcă Inter (src/index.css) și scrie totul cu
   el: meniul, titlurile, cifrele (tabulare). Varianta variabilă
   acoperă greutățile folosite aici (400–700) cu un singur fișier pe
   subset.

   Nu se preîncarcă: demo-ul se deschide doar pe pagina proiectului.
   Subsetul latin-ext aduce ă, ș și ț.
   ============================================================ */

export const inter = Inter({
  subsets: ["latin", "latin-ext"],
  display: "swap",
  preload: false,
  variable: "--font-zof",
});
