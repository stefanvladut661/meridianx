import { Instrument_Sans, Instrument_Serif } from "next/font/google";
import { fontVariables } from "@/app/fonts";

/**
 * Fonturile panoului de administrare (redesign): Instrument Sans pentru text,
 * Instrument Serif pentru titluri. Sunt într-un fișier separat de `app/fonts.ts`
 * ca site-ul public să nu le încarce deloc: doar root layout-ul adminului le
 * importă. Le citește `ads/portal.css`, prin --md-font-body / --md-font-display.
 *
 * `latin-ext` e obligatoriu: ă, ș și ț trăiesc în el.
 */
export const instrumentSans = Instrument_Sans({
  subsets: ["latin", "latin-ext"],
  display: "swap",
  variable: "--font-instrument-sans",
});

export const instrumentSerif = Instrument_Serif({
  subsets: ["latin", "latin-ext"],
  weight: "400",
  display: "swap",
  preload: false,
  variable: "--font-instrument-serif",
});

/** Variabilele site-ului (mono-urile, Satoshi) plus cele ale panoului, pe <body>. */
export const adminFontVariables = [fontVariables, instrumentSans.variable, instrumentSerif.variable].join(" ");
