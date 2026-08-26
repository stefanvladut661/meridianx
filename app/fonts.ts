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
 * Clash Display și Switzer au rămas DOAR pentru /admin (sistemul vechi
 * de tokens), de aceea sunt marcate `preload: false`: se descarcă doar
 * unde chiar se folosesc, în loc să atârne de fiecare pagină publică.
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

export const satoshi = localFont({
  src: "./fonts/Satoshi-Variable.woff2",
  weight: "300 900",
  display: "swap",
  variable: "--font-satoshi",
  fallback: ["Helvetica Neue", "system-ui", "sans-serif"],
});

export const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin", "latin-ext"],
  display: "swap",
  variable: "--font-jbmono",
});

export const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600"],
  display: "swap",
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
