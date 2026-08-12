import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { fontVariables } from "@/app/fonts";
import "@/app/globals.css";

/**
 * Root layout pentru toate rutele publice (FAZA 0).
 * Rutele publice trăiesc sub app/[locale]/ — RO fără prefix, EN cu /en.
 * Admin are propriul root layout în app/(admin)/, în afara i18n-ului.
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
      <body className={`${fontVariables} antialiased`}>
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
