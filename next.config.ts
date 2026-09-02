import path from "path";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

/* Un an, imuabil. Materialele de portofoliu sunt scrise o dată de
   `scripts/portfolio-build.mjs`; când se schimbă, se schimbă și numele
   fișierului (alt slug), deci nu există cazul „același URL, alt
   conținut". Implicit, Next servește `public/` cu `max-age=0`, adică
   fiecare vizitator re-descarcă posterele la fiecare vizită. */
const IMMUTABLE = [
  { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
];

const nextConfig: NextConfig = {
  // Există un package-lock.json rătăcit în C:\Users\PC care derutează
  // detecția de workspace a Turbopack — fixăm rădăcina explicit.
  turbopack: { root: path.join(__dirname) },

  // Antetul `X-Powered-By: Next.js` spune atacatorilor ce rulăm și nu
  // spune vizitatorilor nimic.
  poweredByHeader: false,

  async headers() {
    return [
      {
        /* `:path+` cere cel puțin un segment, deci prinde fișierele din
           folder, NU pagina /video/portofoliu. Dacă ar prinde-o, HTML-ul
           ar rămâne în cache un an și site-ul n-ar mai putea fi
           actualizat. */
        source: "/video/portofoliu/:path+",
        headers: IMMUTABLE,
      },
      { source: "/video/posters/:path+", headers: IMMUTABLE },
      { source: "/video/prezentare.:ext(mp4|webp)", headers: IMMUTABLE },
      { source: "/brand/:path+", headers: IMMUTABLE },
      {
        // Antete de securitate pe tot site-ul. Nimic exotic: doar ce nu
        // strică nimic și închide clasele evidente de probleme.
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-DNS-Prefetch-Control", value: "on" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
          },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
