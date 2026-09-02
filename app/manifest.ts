import type { MetadataRoute } from "next";

/**
 * Manifestul web.
 *
 * Nu facem o aplicație instalabilă — dar manifestul e locul de unde
 * Android și Chrome iau numele și icoanele când cineva adaugă site-ul
 * pe ecranul de start, iar Google îl citește ca semnal de identitate a
 * site-ului. Culorile sunt negrul comun al celor două lumi: manifestul
 * e la rădăcină, deci nu are voie să favorizeze o divizie.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MERIDIAN — Video & Software",
    short_name: "MERIDIAN",
    description:
      "Producție video comercială și dezvoltare software la comandă. Două divizii, un singur punct zero.",
    start_url: "/",
    display: "standalone",
    background_color: "#08080F",
    theme_color: "#08080F",
    lang: "ro",
    categories: ["business", "photo", "productivity"],
    icons: [
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/brand/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
