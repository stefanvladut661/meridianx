import type { Metadata } from "next";
import { getPathname } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import type { Division } from "./division";

/**
 * Ajutoare de SEO (FAZA 7).
 *
 * Canonical și hreflang se construiesc dintr-un singur loc, folosind
 * `getPathname` din contractul i18n al FAZEI 0 — altfel fiecare pagină
 * ar reinventa regula „RO fără prefix, EN cu /en” și una din ele ar
 * greși-o.
 *
 * Cum se folosește într-o pagină:
 *   export async function generateMetadata({ params }) {
 *     const { locale } = await params;
 *     return {
 *       title: "…",
 *       ...pageSeo({ route: "/video/servicii", locale, division: "video",
 *                    title: "…", description: "…" }),
 *     };
 *   }
 */

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://meridianagency.ro";

/** URL-ul imaginii OG generate pentru o pagină. */
export function ogImageUrl(options: {
  division: Division;
  title: string;
  subtitle?: string;
}): string {
  const params = new URLSearchParams({
    division: options.division,
    title: options.title,
  });
  if (options.subtitle) params.set("subtitle", options.subtitle);
  return `/og.png?${params.toString()}`;
}

/** canonical + hreflang pentru o rută, în locale-ul curent. */
export function alternatesFor(route: string, locale: Locale) {
  const languages: Record<string, string> = {};
  for (const item of routing.locales) {
    languages[item] = `${BASE}${getPathname({ href: route, locale: item })}`;
  }
  // x-default trimite la sursa de adevăr a copy-ului: româna
  languages["x-default"] = `${BASE}${getPathname({
    href: route,
    locale: routing.defaultLocale,
  })}`;

  return {
    canonical: `${BASE}${getPathname({ href: route, locale })}`,
    languages,
  };
}

/**
 * Blocul complet de metadata pentru o pagină publică: canonical,
 * hreflang, Open Graph și Twitter card cu imaginea diviziei.
 */
export function pageSeo(options: {
  route: string;
  locale: Locale;
  division: Division;
  title: string;
  description: string;
  /** Textul de pe imaginea OG, dacă e altul decât titlul. */
  ogTitle?: string;
}): Metadata {
  const image = ogImageUrl({
    division: options.division,
    title: options.ogTitle ?? options.title,
    subtitle: options.description,
  });

  return {
    alternates: alternatesFor(options.route, options.locale),
    openGraph: {
      type: "website",
      siteName: "MERIDIAN",
      locale: options.locale === "en" ? "en_US" : "ro_RO",
      title: options.title,
      description: options.description,
      url: `${BASE}${getPathname({ href: options.route, locale: options.locale })}`,
      images: [{ url: image, width: 1200, height: 630, alt: options.title }],
    },
    twitter: {
      card: "summary_large_image",
      title: options.title,
      description: options.description,
      images: [image],
    },
  };
}

/* ─────────────────────────── JSON-LD ───────────────────────────── */

export function organizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "MERIDIAN",
    url: BASE,
    logo: `${BASE}/og.png?division=software&title=MERIDIAN`,
    description:
      "Agenție cu două divizii: producție video comercială și dezvoltare software la comandă.",
    // NOTĂ: fără `address` și fără LocalBusiness până când avem datele
    // reale ale firmei. Structured data inventată e minciună citită de
    // mașini, nu doar de oameni.
    sameAs: [process.env.NEXT_PUBLIC_INSTAGRAM].filter(
      (value): value is string => Boolean(value && value.startsWith("http"))
    ),
  };
}

export function websiteSchema(locale: Locale) {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "MERIDIAN",
    url: `${BASE}${getPathname({ href: "/", locale })}`,
    inLanguage: locale === "en" ? "en" : "ro",
  };
}

export interface BreadcrumbItem {
  name: string;
  route: string;
}

export function breadcrumbSchema(items: BreadcrumbItem[], locale: Locale) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: `${BASE}${getPathname({ href: item.route, locale })}`,
    })),
  };
}

export function serviceSchema(options: {
  name: string;
  description: string;
  division: Division;
  route: string;
  locale: Locale;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    name: options.name,
    description: options.description,
    serviceType:
      options.division === "video" ? "Video production" : "Software development",
    provider: { "@type": "Organization", name: "MERIDIAN", url: BASE },
    areaServed: "RO",
    url: `${BASE}${getPathname({ href: options.route, locale: options.locale })}`,
  };
}
