import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { notFound } from "next/navigation";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { routing, type Locale } from "@/i18n/routing";
import { fontVariables } from "@/app/fonts";
import { JsonLd } from "@/components/seo/json-ld";
import { CookieBanner } from "@/components/consent/cookie-banner";
import { AnalyticsLoader } from "@/components/consent/analytics-loader";
import { MetaPixel } from "@/components/consent/meta-pixel";
import { TikTokPixel } from "@/components/consent/tiktok-pixel";
import { organizationSchema, websiteSchema } from "@/lib/seo";
import "@/app/globals.css";
import { SITE_URL } from "@/lib/site-url";

/**
 * Root layout pentru toate rutele publice (FAZA 0).
 * Rutele publice trăiesc sub app/[locale]/ — RO fără prefix, EN cu /en.
 * Admin are propriul root layout în app/(admin)/, în afara i18n-ului.
 *
 * FAZA 7 a adăugat aici, punctual: structured data de nivel site
 * (Organization + WebSite), bannerul de cookie-uri și încărcătorul de
 * analytics condiționat de consimțământ. Toate trei trebuie să existe
 * o singură dată, pe toate rutele publice — de-aia stau în root, nu în
 * layout-urile de divizie.
 */

export const metadata: Metadata = {
  title: {
    default: "MERIDIAN — Video & Software",
    template: "%s — MERIDIAN",
  },
  description:
    "MERIDIAN: producție video comercială și dezvoltare software la comandă. Două divizii, un singur punct zero.",
  metadataBase: new URL(SITE_URL),
  // Canonical relativ: Next îl rezolvă la ruta curentă, deci fiecare
  // pagină primește automat canonical-ul ei — inclusiv paginile care
  // încă nu există. Paginile care au nevoie și de hreflang îl adaugă
  // prin `pageSeo()` din lib/seo.ts și suprascriu linia asta.
  alternates: { canonical: "./" },
  /* Paginile de divizie isi pun singure cardul prin `pageSeo()`. Astea
     sunt valorile pentru restul — inclusiv poarta, care e chiar pagina
     pe care o distribuie cineva cand da link la "meridianx.ro". */
  openGraph: {
    type: "website",
    siteName: "MERIDIAN",
    locale: "ro_RO",
    title: "MERIDIAN — Video & Software",
    description:
      "Producție video comercială și dezvoltare software la comandă. Două divizii, un singur punct zero.",
    images: [
      {
        url: "/og.png?division=gate&title=MERIDIAN",
        width: 1200,
        height: 630,
        alt: "MERIDIAN — video și software",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "MERIDIAN — Video & Software",
    description:
      "Producție video comercială și dezvoltare software la comandă.",
    images: ["/og.png?division=gate&title=MERIDIAN"],
  },
  applicationName: "MERIDIAN",
  authors: [{ name: "MERIDIAN" }],
  creator: "MERIDIAN",
  publisher: "MERIDIAN",
  category: "business",
  // Numerele de telefon sunt marcate ca atare de noi (butoane `tel:`);
  // detecția automată a lui Safari ar rescrie și numere din texte.
  formatDetection: { telephone: false, address: false, email: false },
  /* Fără astea, Google taie previzualizările: imaginile apar mici în
     rezultate, iar clipurile de portofoliu nu primesc preview video. */
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-video-preview": -1,
      "max-snippet": -1,
    },
  },
};

/** Culoarea barei de sistem pe mobil: negrul comun al celor două lumi. */
export const viewport: Viewport = {
  themeColor: "#08080F",
  colorScheme: "dark",
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);

  return (
    <html lang={locale}>
      <head>
        {/* Codul de bază al pixelilor stă în /public/pixels, nu inline: un
            <Script> inline apare de două ori în sursa paginii (tag + payload
            RSC), iar Meta raportează „pixel inițializat de mai multe ori".
            Fiecare fișier citește întâi cookie-ul de consimțământ și nu
            pornește nimic fără „da" la marketing. Fără `<noscript>`-ul lui
            Meta: e o imagine care pleacă necondiționat, înainte de orice
            accept — exact ce politica de cookie-uri spune că nu facem. */}
        <Script
          id="meta-pixel-base"
          src="/pixels/meta.js"
          strategy="beforeInteractive"
        />
        <Script
          id="tiktok-pixel-base"
          src="/pixels/tiktok.js"
          strategy="beforeInteractive"
        />
      </head>
      <body className={`${fontVariables} md-body antialiased`}>
        <NextIntlClientProvider>
          {children}
          <CookieBanner />
          <AnalyticsLoader />
          <MetaPixel />
          <TikTokPixel />
        </NextIntlClientProvider>
        <JsonLd
          schema={[organizationSchema(), websiteSchema(locale as Locale)]}
        />
      </body>
    </html>
  );
}
