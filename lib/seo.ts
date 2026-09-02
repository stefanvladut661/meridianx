import type { Metadata } from "next";
import { getPathname } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { SOFTWARE_CONTACT, VIDEO_CONTACT } from "@/components/site/contact";
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
 *       ...pageSeo({ route: "/video", locale, division: "video",
 *                    title: "…", description: "…" }),
 *     };
 *   }
 */

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://meridianx.ro";

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
      // O singură limbă până adaptăm copy-ul în EN (i18n/routing.ts).
      locale: "ro_RO",
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

/**
 * Cardul social pentru paginile care nu apartin unei divizii: poarta si
 * documentele legale. Il declaram explicit, nu ne bazam pe mostenirea
 * din layout — Next o rezolva diferit dupa cum pagina isi exporta sau
 * nu propria metadata, iar tagurile astea sunt exact cele pe care nu ne
 * permitem sa le pierdem: sunt ce vede cineva cand da link pe WhatsApp.
 */
export function neutralSocial(title: string, description: string): Metadata {
  const image = "/og.png?division=gate&title=MERIDIAN";
  return {
    openGraph: {
      type: "website",
      siteName: "MERIDIAN",
      locale: "ro_RO",
      title,
      description,
      images: [
        { url: image, width: 1200, height: 630, alt: "MERIDIAN — video si software" },
      ],
    },
    twitter: { card: "summary_large_image", title, description, images: [image] },
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
    //
    // Telefoanele sunt însă reale și publice (tipărite pe cărțile de
    // vizită), deci intră ca puncte de contact — câte unul per divizie,
    // fiindcă exact așa răspunde agenția.
    contactPoint: [
      {
        "@type": "ContactPoint",
        contactType: "sales",
        name: "MERIDIAN Video",
        telephone: VIDEO_CONTACT.phoneHref.replace("tel:", ""),
        availableLanguage: ["ro"],
        areaServed: "RO",
      },
      {
        "@type": "ContactPoint",
        contactType: "sales",
        name: "MERIDIAN Software",
        telephone: SOFTWARE_CONTACT.phoneHref.replace("tel:", ""),
        availableLanguage: ["ro"],
        areaServed: "RO",
      },
    ],
    sameAs: [process.env.NEXT_PUBLIC_INSTAGRAM].filter(
      (value): value is string => Boolean(value && value.startsWith("http"))
    ),
  };
}

/* ---------- materiale de portofoliu ----------
   Google indexează video și imagini separat de pagină. Fără VideoObject
   un clip de portofoliu e, pentru un crawler, un `<video>` mut. */

export interface PortfolioVideoSeo {
  slug: string;
  client: string;
  title: string;
  src: string;
  poster: string;
  seconds: number;
  published: string;
  w: number;
  h: number;
}

/** ISO 8601 pentru durată: 22s → PT22S, 95s → PT1M35S. */
function isoDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `PT${m ? `${m}M` : ""}${s || !m ? `${s}S` : ""}`;
}

export function videoObjectSchema(
  video: PortfolioVideoSeo,
  route: string,
  locale: Locale
) {
  const page = `${BASE}${getPathname({ href: route, locale })}`;
  return {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    name: `${video.title} — ${video.client}`,
    description: `Material filmat și montat de MERIDIAN pentru ${video.client}.`,
    thumbnailUrl: [`${BASE}${video.poster}`],
    contentUrl: `${BASE}${video.src}`,
    /* `uploadDate` e data la care materialul a apărut pe site (mtime-ul
       fișierului livrat), nu data filmării — pe aia nu o știm și n-o
       inventăm. */
    uploadDate: video.published,
    duration: isoDuration(video.seconds),
    width: video.w,
    height: video.h,
    isFamilyFriendly: true,
    inLanguage: "ro",
    creator: { "@type": "Organization", name: "MERIDIAN", url: BASE },
    embedUrl: page,
    mainEntityOfPage: page,
  };
}

export interface PortfolioPhotoSeo {
  slug: string;
  alt: string;
  client: string;
  base: string;
  widths: number[];
  w: number;
  h: number;
}

export function imageGallerySchema(
  photos: PortfolioPhotoSeo[],
  route: string,
  locale: Locale
) {
  const page = `${BASE}${getPathname({ href: route, locale })}`;
  return {
    "@context": "https://schema.org",
    "@type": "ImageGallery",
    name: "Fotografie comercială MERIDIAN",
    url: page,
    inLanguage: "ro",
    associatedMedia: photos.map((photo) => ({
      "@type": "ImageObject",
      contentUrl: `${BASE}${photo.base}-${photo.widths[photo.widths.length - 1]}.webp`,
      thumbnailUrl: `${BASE}${photo.base}-${photo.widths[0]}.webp`,
      name: photo.alt,
      caption: `${photo.alt} — ${photo.client}`,
      width: photo.w,
      height: photo.h,
      creditText: "MERIDIAN",
      creator: { "@type": "Organization", name: "MERIDIAN", url: BASE },
      copyrightNotice: "MERIDIAN",
      acquireLicensePage: page,
    })),
  };
}

/** Întrebările frecvente, exact cum sunt pe pagină. */
export function faqSchema(items: readonly { q: string; a: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };
}

export function websiteSchema(locale: Locale) {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "MERIDIAN",
    url: `${BASE}${getPathname({ href: "/", locale })}`,
    inLanguage: "ro",
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
