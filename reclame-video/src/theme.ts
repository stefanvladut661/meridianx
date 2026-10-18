import { continueRender, delayRender, staticFile } from "remotion";
import { loadFont as loadHostGrotesk } from "@remotion/google-fonts/HostGrotesk";
import { loadFont as loadJetBrains } from "@remotion/google-fonts/JetBrainsMono";

// Două stiluri, după clipurile de referință din folderul „reclame":
//  - LARVEN: video-ul din hero-ul larven.ai — spațiu bleumarin, carduri în 3D,
//    telefoane, titluri pe rânduri alb / albastru / gri. Font Host Grotesk.
//  - SHOPIFY: clipul Shopify — fundal închis uni, text mare și subțire care
//    apare pe voce, obiecte în locul cuvintelor, mână-cursor. Font Satoshi
//    (fontul site-ului Meridian), culori de trattoria pe verde închis.

export const HOST = loadHostGrotesk("normal", {
  weights: ["400", "500", "600", "700"],
  subsets: ["latin", "latin-ext"],
}).fontFamily;

export const MONO = loadJetBrains("normal", { weights: ["400", "500"], subsets: ["latin"] }).fontFamily;

export const SATOSHI = "Satoshi";
if (typeof document !== "undefined") {
  const handle = delayRender("Satoshi");
  new FontFace(SATOSHI, `url(${staticFile("fonts/Satoshi-Variable.woff2")}) format("woff2")`, { weight: "300 900" })
    .load()
    .then((face) => {
      document.fonts.add(face);
      continueRender(handle);
    })
    .catch((err) => {
      console.error(err);
      continueRender(handle);
    });
}

export const LARVEN = {
  bg: "#05070B",
  ink: "#F3F5F8",
  blue: "#4D8BFF",
  blueDeep: "#2F6BFF",
  grey: "#7C818D",
  font: HOST,
} as const;

export const SHOP = {
  bg: "#0D1C17",
  ink: "#F0E9D6",
  saffron: "#F1B33E",
  tomato: "#E2553D",
  paper: "#FBF6EC",
  paperInk: "#1D2A22",
  font: SATOSHI,
} as const;
