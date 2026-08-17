import type { MetadataRoute } from "next";
import { getPathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { NAV_LINKS, DIVISION_HOME, LEGAL_LINKS } from "@/components/shell/nav-links";

/**
 * Sitemap (FAZA 7).
 *
 * Rutele se citesc din `components/shell/nav-links.ts` — aceeași sursă
 * pe care o folosesc header-ul și footer-ul. Dacă apare o pagină nouă
 * în navigație, apare automat și aici; nu ținem două liste care se
 * ceartă între ele.
 *
 * Prefixele de limbă le construiește `getPathname`, ca să respecte
 * regula „RO fără prefix, EN cu /en” fără să o rescriem local.
 */

const BASE =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://meridianagency.ro";

/** Rute care nu apar în navigație, dar trebuie indexate. */
const EXTRA_ROUTES = ["/software/brief"];

function allRoutes(): string[] {
  const routes = new Set<string>(["/"]);
  for (const home of Object.values(DIVISION_HOME)) routes.add(home);
  for (const links of Object.values(NAV_LINKS)) {
    for (const link of links) routes.add(link.href);
  }
  for (const route of EXTRA_ROUTES) routes.add(route);
  for (const link of LEGAL_LINKS) routes.add(link.href);
  return [...routes];
}

function priorityFor(route: string): number {
  if (route === "/") return 1;
  if (route === "/video" || route === "/software") return 0.9;
  if (route.startsWith("/legal")) return 0.3;
  return 0.7;
}

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return allRoutes().map((route) => {
    const languages = Object.fromEntries(
      routing.locales.map((locale) => [
        locale,
        `${BASE}${getPathname({ href: route, locale })}`,
      ])
    );

    return {
      url: `${BASE}${getPathname({ href: route, locale: routing.defaultLocale })}`,
      lastModified,
      changeFrequency: route.startsWith("/legal") ? "yearly" : "monthly",
      priority: priorityFor(route),
      alternates: { languages },
    };
  });
}
