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

// ---------------------------------------------------------------------------
// Content-Security-Policy
// ---------------------------------------------------------------------------

/* Originile externe pe care le atinge BROWSERUL. Ce vorbește doar de pe
   server — Supabase din route handlers, Resend — nu trece prin CSP:
   politica se aplică paginii, nu procesului Node.

   Lista e completă, nu ghicită: am numărat originile externe din tot
   HTML-ul prerandat. În afară de domeniul propriu și de schema.org (care
   apare doar ca text în JSON-LD, nu ca cerere), există exact patru:
   connect.facebook.net, www.facebook.com, analytics.tiktok.com și wa.me.

   Regula de întreținere: fiecare linie de aici are un motiv scris. Dacă
   dispare motivul, dispare și linia. */
const META_SCRIPT = "https://connect.facebook.net"; // fbevents.js
const META_PIXEL = "https://www.facebook.com"; // /tr, inclusiv <noscript>
// events.js + modulele pe care le încarcă după, și evenimentele (fetch/img).
const TIKTOK = "https://analytics.tiktok.com";
// Lista din Events Manager → Pixel → „Content Security Policy": main.*.js
// vine de pe CDN, iar evenimentele pleacă spre *.tiktokw.us.
const TIKTOK_CDN = "https://*.tiktokcdn.com";
const TIKTOK_EVENTS = "https://*.tiktokw.us";

const isProduction = process.env.NODE_ENV === "production";

/**
 * Proiectul Supabase, citit LA BUILD.
 *
 * `headers()` se evaluează o singură dată, la build, și se coace în
 * `.next/routes-manifest.json` — deci variabila trebuie să existe pe
 * mașina de build (pe Vercel există), nu la runtime.
 *
 * Azi browserul NU vorbește direct cu Supabase: toți clienții din
 * `lib/supabase/clients.ts` importă `next/headers` și trăiesc pe server.
 * Linia rămâne fiindcă exact aici s-ar rupe în tăcere un viitor client
 * de browser, iar `wss:` e obligatoriu dacă se adaugă vreodată Realtime.
 */
function supabaseOrigins(): string[] {
  const fallback = ["https://*.supabase.co", "wss://*.supabase.co"];
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!raw) return fallback;

  try {
    const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    const { host } = new URL(withScheme);
    return [`https://${host}`, `wss://${host}`];
  } catch {
    // Aceeași grijă ca în `lib/site-url.ts`: o variabilă stricată în
    // dashboard nu are voie să oprească build-ul.
    return fallback;
  }
}

/**
 * Politica de securitate a conținutului.
 *
 * DE CE 'unsafe-inline' ȘI NU NONCE: fiecare pagină prerandată conține
 * script-uri inline puse de Next (payload-ul de React Server Components)
 * plus fragmentul Meta din `app/[locale]/layout.tsx`. Un nonce ar trebui
 * generat pe cerere în `middleware.ts` și ar face fiecare pagină
 * dinamică — adică am pierde exact prerenderul static pe care tocmai
 * l-am recâștigat la punctul 4. În plus, paginile folosesc atribute
 * `style=` inline, care nu pot primi nonce NICIODATĂ (nonce-urile se
 * aplică doar elementelor `<style>`), deci `style-src 'unsafe-inline'`
 * ar rămâne oricum.
 *
 * CE APĂRĂ TOTUȘI politica asta: framing (clickjacking), injecția de
 * `<base>`, plugin-urile `<object>`, trimiterea unui formular către alt
 * domeniu și — cel mai important — încărcarea de script sau trimiterea
 * de date către orice origine care nu e pe listă.
 */
function contentSecurityPolicy(): string {
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],

    "script-src": [
      "'self'",
      "'unsafe-inline'",
      META_SCRIPT,
      TIKTOK,
      TIKTOK_CDN,
      // Codul nostru nu face eval (verificat în `.next/static/chunks`), dar
      // SDK-ul TikTok (main.*.js) îl cere — fără el pixelul raportează
      // violări și pierde evenimente. În dev îl cere și Turbopack.
      "'unsafe-eval'",
    ],

    // Tailwind v4 și next/font ajung în atribute `style=` inline.
    "style-src": ["'self'", "'unsafe-inline'"],

    // `data:` — CSS-ul construit conține un data:image/svg+xml.
    "img-src": ["'self'", "data:", "blob:", META_PIXEL, TIKTOK],

    // next/font auto-găzduiește totul în /_next/static/media.
    "font-src": ["'self'"],

    "connect-src": [
      "'self'", // /api/leads, /api/admin/session, /_vercel/insights
      META_SCRIPT,
      META_PIXEL,
      TIKTOK,
      TIKTOK_CDN,
      TIKTOK_EVENTS,
      ...supabaseOrigins(),
      // HMR-ul lui `next dev` merge pe websocket.
      ...(isProduction ? [] : ["ws:"]),
    ],

    "media-src": ["'self'"], // /video/*.mp4
    "manifest-src": ["'self'"], // /manifest.webmanifest
    "worker-src": ["'self'", "blob:"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    // Formularele merg toate acasă: /api/leads sau server actions.
    "form-action": ["'self'"],
    // Perechea modernă a lui X-Frame-Options.
    "frame-ancestors": ["'self'"],
    // Site-ul nu încorporează nimic. În dev, 'self' lasă loc suprapunerii
    // de erori a lui Next, dacă versiunea o randează în iframe.
    "frame-src": isProduction ? ["'none'"] : ["'self'"],
  };

  return Object.entries(directives)
    .map(([name, values]) => `${name} ${values.join(" ")}`)
    .join("; ");
}

/**
 * Cât timp politica se testează: browserul RAPORTEAZĂ în consolă ce ar
 * fi blocat, dar nu blochează nimic.
 *
 * Nu există endpoint de raportare, deci încălcările se văd doar în
 * consola celui care navighează — umblă prin site cu DevTools deschis
 * înainte să pui `false` aici. De verificat neapărat: formularul de
 * lead, acceptul de cookie-uri (care pornește pixelul), portofoliul
 * video și /admin.
 */
const CSP_REPORT_ONLY = true;

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
          /* Pentru browserele vechi care nu știu `frame-ancestors`.
             Unde le știe pe amândouă, `frame-ancestors` câștigă. */
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          {
            key: CSP_REPORT_ONLY
              ? "Content-Security-Policy-Report-Only"
              : "Content-Security-Policy",
            value: contentSecurityPolicy(),
          },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
