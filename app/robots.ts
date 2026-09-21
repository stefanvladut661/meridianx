import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site-url";

/**
 * robots.txt (FAZA 7).
 *
 * Admin-ul, vault-ul și API-ul nu au ce căuta în index. Restul e
 * deschis — site-ul e un instrument de vânzare, nu un secret.
 * (`/vault` nu e nici în sitemap: `ROUTES` din app/sitemap.ts e o listă
 * explicită, iar el nu e pe ea.)
 */

const BASE = SITE_URL;

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/admin/", "/vault", "/vault/", "/api/"],
      },
    ],
    sitemap: `${BASE}/sitemap.xml`,
    host: BASE,
  };
}
