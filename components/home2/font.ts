import { Host_Grotesk } from "next/font/google";

/**
 * Fontul paginii /home-2: Host Grotesk, același ca pe site-ul de
 * referință. Restul site-ului rămâne pe Satoshi (app/fonts.ts) — fontul
 * se încarcă doar pe rutele care importă fișierul ăsta.
 *
 * `latin-ext` e obligatoriu: ș și ț stau acolo.
 */
export const hostGrotesk = Host_Grotesk({
  subsets: ["latin", "latin-ext"],
  display: "swap",
  variable: "--font-host",
  fallback: ["Helvetica Neue", "system-ui", "sans-serif"],
});
