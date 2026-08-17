import type { MetadataRoute } from "next";

/**
 * robots.txt (FAZA 7).
 *
 * Admin-ul și API-ul nu au ce căuta în index. Restul e deschis —
 * site-ul e un instrument de vânzare, nu un secret.
 */

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://meridianagency.ro";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/admin/", "/api/"],
      },
    ],
    sitemap: `${BASE}/sitemap.xml`,
    host: BASE,
  };
}
