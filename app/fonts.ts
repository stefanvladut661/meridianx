import localFont from "next/font/local";
import { JetBrains_Mono, IBM_Plex_Mono } from "next/font/google";

/**
 * Fonturile MERIDIAN.
 *
 * Site-ul public, după redesign:
 *   VIDEO și POARTA — Satoshi (display + body) · JetBrains Mono
 *   SOFTWARE        — Satoshi (display + body) · IBM Plex Mono
 *
 * Diferența dintre lumi o fac culoarea, razele de colț și temperamentul
 * de motion, nu familia de litere: direcția aleasă la finalul testelor
 * ține o singură voce tipografică, cu două tonuri de mono.
 *
 * Clash Display și Switzer au rămas doar în blocul vechi
 * `[data-world="video"]` din globals.css, selector pe care nu îl poartă
 * niciun element (adminul folosește `[data-world="software"]`, care
 * merge tot pe Satoshi). De aceea sunt marcate `preload: false`.
 * Variabilele lor rămân totuși pe <body>: `:root` din globals.css încă
 * le citește, iar dacă dispar, `font-family` de pe <body> devine
 * invalidă și pagina cade pe serif-ul browserului.
 *
 * Bugetul de preîncărcare: UN singur font, Satoshi. Vezi nota de la
 * mono-uri pentru de ce.
 *
 * Fișierele variable woff2 vin de pe Fontshare (licența ITF FFL,
 * vezi app/fonts/FFL-LICENSE.txt). Mono-urile vin din next/font/google.
 */

export const clashDisplay = localFont({
  src: "./fonts/ClashDisplay-Variable.woff2",
  weight: "200 700",
  display: "swap",
  preload: false,
  variable: "--font-clash",
  fallback: ["Arial Narrow", "system-ui", "sans-serif"],
});

export const switzer = localFont({
  src: "./fonts/Switzer-Variable.woff2",
  weight: "100 900",
  display: "swap",
  preload: false,
  variable: "--font-switzer",
  fallback: ["Helvetica Neue", "system-ui", "sans-serif"],
});

/* Singurul font preîncărcat. E cel cu care se scrie tot ce se vede
   primul: titlurile și corpul de text, în ambele lumi. */
export const satoshi = localFont({
  src: "./fonts/Satoshi-Variable.woff2",
  weight: "300 900",
  display: "swap",
  preload: true,
  variable: "--font-satoshi",
  fallback: ["Helvetica Neue", "system-ui", "sans-serif"],
});

/* Mono-urile NU se preîncarcă.
 *
 * `next/font/google` preîncarcă implicit fiecare subset al fiecărei
 * greutăți, deci cele două mono-uri scoteau singure 8 din cele 9
 * `<link rel="preload" as="font">` de pe fiecare pagină — 112 KB de
 * fonturi cerute cu prioritate mare, în competiție cu HTML-ul și cu
 * CSS-ul, înainte ca browserul să știe dacă are nevoie de ele.
 *
 * Deasupra pliului mono apare doar ca etichetă de 10-11px: eyebrow-uri
 * („DIVIZIA 01"), timecode-ul și coordonatele. Nimic din ce se pictează
 * primul nu e scris cu ele, deci se încarcă normal, la rând.
 *
 * Subseturile rămân `latin` + `latin-ext` și nu se ating: ă, ș și ț
 * trăiesc în latin-ext (â și î sunt în latin), deci fără el româna se
 * rupe.
 */
export const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin", "latin-ext"],
  display: "swap",
  preload: false,
  variable: "--font-jbmono",
});

export const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600"],
  display: "swap",
  preload: false,
  variable: "--font-plexmono",
});

/** Toate variabilele de font, aplicate o dată pe <body> în root layout. */
export const fontVariables = [
  clashDisplay.variable,
  switzer.variable,
  satoshi.variable,
  jetbrainsMono.variable,
  ibmPlexMono.variable,
].join(" ");
