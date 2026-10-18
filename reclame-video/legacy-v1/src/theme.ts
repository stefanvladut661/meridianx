import { continueRender, delayRender, staticFile } from "remotion";
import { loadFont as loadHostGrotesk } from "@remotion/google-fonts/HostGrotesk";
import { loadFont as loadPlayfair } from "@remotion/google-fonts/PlayfairDisplay";

// Host Grotesk e fontul de pe larven.ai (referința). Playfair e doar pentru
// site-ul fictiv al restaurantului din animația de analiză.
export const FONT = loadHostGrotesk("normal", {
  weights: ["300", "400", "500", "600", "700"],
  subsets: ["latin", "latin-ext"],
}).fontFamily;

export const SERIF = loadPlayfair("normal", {
  weights: ["400", "500", "600"],
  subsets: ["latin", "latin-ext"],
}).fontFamily;

// Satoshi e fontul wordmark-ului MERIDIAN de pe site (app/fonts/Satoshi-Variable.woff2).
export const BRAND_FONT = "Satoshi";
if (typeof document !== "undefined") {
  const handle = delayRender("Satoshi");
  new FontFace("Satoshi", `url(${staticFile("fonts/Satoshi-Variable.woff2")}) format("woff2")`, {
    weight: "300 900",
  })
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

// Culorile sunt eșantionate din cadrele și pozele de referință.
export const C = {
  bg: "#05070B",
  ink: "#F3F5F8",
  dim: "#8C919C",
  mute: "#727784",
  blue: "#3C7DFF",
  blueHi: "#7FA6FF",
  blueDeep: "#1F4FE0",
  green: "#3DDC97",
  card: "rgba(17,18,22,0.95)",
  line: "rgba(255,255,255,0.08)",
} as const;
