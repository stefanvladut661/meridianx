import type { Division } from "@/lib/division";

/**
 * Sursa unică a rutelor de navigare per divizie (FAZA 1).
 * Cheile sunt sub namespace-ul i18n `nav.video.*` / `nav.software.*`.
 * Rutele de sub-pagini apar în F2–F5; le linkuim oricum (contract).
 */

export interface NavLink {
  href: string;
  /** cheia i18n în interiorul `nav.<division>` */
  key: string;
}

export const DIVISION_HOME: Record<Division, string> = {
  video: "/video",
  software: "/software",
};

export const NAV_LINKS: Record<Division, NavLink[]> = {
  video: [
    { href: "/video/servicii", key: "services" },
    { href: "/video/portofoliu", key: "portfolio" },
    { href: "/video/reclame", key: "ads" },
    { href: "/video/proces", key: "process" },
    { href: "/video/contact", key: "contact" },
  ],
  software: [
    { href: "/software/servicii", key: "services" },
    { href: "/software/fonduri", key: "funding" },
    { href: "/software/proiecte", key: "projects" },
    { href: "/software/proces", key: "process" },
  ],
};

export const LEGAL_LINKS = [
  { href: "/legal/confidentialitate", key: "privacy" },
  { href: "/legal/termeni", key: "terms" },
  { href: "/legal/cookies", key: "cookies" },
] as const;
