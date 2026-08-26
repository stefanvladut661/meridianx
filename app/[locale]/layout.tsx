import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { routing, type Locale } from "@/i18n/routing";
import { fontVariables } from "@/app/fonts";
import { JsonLd } from "@/components/seo/json-ld";
import { CookieBanner } from "@/components/consent/cookie-banner";
import { AnalyticsLoader } from "@/components/consent/analytics-loader";
import { organizationSchema, websiteSchema } from "@/lib/seo";
import "@/app/globals.css";

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
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://meridianagency.ro"
  ),
  // Canonical relativ: Next îl rezolvă la ruta curentă, deci fiecare
  // pagină primește automat canonical-ul ei — inclusiv paginile care
  // încă nu există. Paginile care au nevoie și de hreflang îl adaugă
  // prin `pageSeo()` din lib/seo.ts și suprascriu linia asta.
  alternates: { canonical: "./" },
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
      <body className={`${fontVariables} md-body antialiased`}>
        <NextIntlClientProvider>
          {children}
          <CookieBanner />
          <AnalyticsLoader />
        </NextIntlClientProvider>
        <JsonLd
          schema={[organizationSchema(), websiteSchema(locale as Locale)]}
        />
      </body>
    </html>
  );
}
