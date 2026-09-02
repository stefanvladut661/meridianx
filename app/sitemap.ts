import type { MetadataRoute } from "next";
import { getPathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { LEGAL_LINKS } from "@/components/site/legal-links";
import { PHOTOS, VIDEOS } from "@/components/site/portfolio-content";

/**
 * Sitemap.
 *
 * După redesign site-ul public are șase rute: poarta, cele două
 * landing-uri și trei documente legale. Sub-paginile de divizie au
 * dispărut — landing-urile sunt o singură pagină cu ancore, iar o
 * ancoră nu se indexează separat.
 *
 * Lista e explicită, nu dedusă din navigație: navigația de acum e
 * formată din ancore (`#configurator`, `#servicii`), care n-au ce
 * căuta aici. O rută nouă se adaugă în `ROUTES`.
 *
 * Prefixele de limbă le construiește `getPathname`, ca să respecte
 * regula „RO fără prefix, EN cu /en” fără să o rescriem local.
 */

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://meridianagency.ro";

const ROUTES = [
  "/",
  "/video",
  "/software",
  "/video/portofoliu",
  ...LEGAL_LINKS.map((link) => link.href),
];

function priorityFor(route: string): number {
  if (route === "/") return 1;
  if (route === "/video" || route === "/software") return 0.9;
  if (route === "/video/portofoliu") return 0.8;
  return 0.3;
}

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return ROUTES.map((route) => {
    const languages = Object.fromEntries(
      routing.locales.map((locale) => [
        locale,
        `${BASE}${getPathname({ href: route, locale })}`,
      ])
    );

    /* Portofoliul e singura pagină cu media proprie. Declarând-o aici,
       Google indexează fiecare clip și fiecare fotografie, nu doar
       pagina care le conține. */
    const media =
      route === "/video/portofoliu"
        ? {
            images: PHOTOS.map(
              (photo) => `${BASE}${photo.base}-${photo.widths[photo.widths.length - 1]}.webp`
            ),
            videos: VIDEOS.map((video) => ({
              title: `${video.title} — ${video.client}`,
              description: `Material filmat și montat de MERIDIAN pentru ${video.client}.`,
              thumbnail_loc: `${BASE}${video.poster}`,
              content_loc: `${BASE}${video.src}`,
            })),
          }
        : {};

    return {
      url: `${BASE}${getPathname({ href: route, locale: routing.defaultLocale })}`,
      lastModified,
      changeFrequency: route.startsWith("/legal") ? "yearly" : "monthly",
      priority: priorityFor(route),
      alternates: { languages },
      ...media,
    };
  });
}
