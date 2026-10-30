import { Instrument_Sans, Instrument_Serif } from "next/font/google";
import { fontVariables } from "@/app/fonts";

/**
 * Fonturile Vault-ului: aceleași ca ale panoului (Instrument Sans pentru text,
 * Instrument Serif pentru titluri), pentru ca Vault-ul să arate ca restul
 * panoului. Sunt copiate aici, nu importate din `app/(admin)/fonts.ts`:
 * Vault-ul are root layout propriu și nu importă nimic din zona adminului.
 *
 * `latin-ext` e obligatoriu: ă, ș și ț trăiesc în el.
 */
const instrumentSans = Instrument_Sans({
  subsets: ["latin", "latin-ext"],
  display: "swap",
  variable: "--font-instrument-sans",
});

const instrumentSerif = Instrument_Serif({
  subsets: ["latin", "latin-ext"],
  weight: "400",
  display: "swap",
  preload: false,
  variable: "--font-instrument-serif",
});

/** Variabilele site-ului (mono-urile, Satoshi) plus cele ale panoului, pe <body>. */
export const vaultFontVariables = [fontVariables, instrumentSans.variable, instrumentSerif.variable].join(" ");
