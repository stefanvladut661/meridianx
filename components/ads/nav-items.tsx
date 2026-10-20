import type { ReactNode } from "react";
import { IconCalls, IconCampaigns, IconHistory, IconMaterials, IconPlans, IconSearch, IconStats } from "./icons";

/**
 * Meniul portalului v2, în ordinea din prompt: Campanii, Planuri, Statistici,
 * Căutări (doar Google), Materiale, Apeluri, Istoric. Un ecran care nu există
 * încă nu apare (un link spre nimic e un drum înfundat): `ready` se aprinde în
 * faza care îl construiește.
 */

export interface NavItem {
  key: string;
  href: string;
  label: string;
  icon: ReactNode;
  /** Căile care țin de element (ecranele vechi ale lui, fișele). */
  match: RegExp;
  googleOnly?: boolean;
  /** Ruta schimbă un cookie: fără preîncărcare (o preîncărcare n-are voie să schimbe nimic). */
  noPrefetch?: boolean;
  ready: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { key: "campanii", href: "/admin/ads", label: "Campanii", icon: <IconCampaigns />, match: /^\/admin\/ads\/?$/, ready: true },
  {
    key: "planuri",
    href: "/admin/ads/planuri",
    label: "Planuri",
    icon: <IconPlans />,
    match: /^\/admin\/ads\/(planuri|nou|lot|claude|creeaza|[0-9a-f-]{36})(\/|$)/,
    ready: true,
  },
  { key: "statistici", href: "/admin/ads/statistici", label: "Statistici", icon: <IconStats />, match: /^\/admin\/ads\/statistici/, ready: true },
  {
    key: "cautari",
    // Trece prin /admin/ads/cautari: spațiul Google al clientului ales, apoi termenii contului lui.
    href: "/admin/ads/cautari",
    label: "Căutări",
    icon: <IconSearch />,
    match: /^\/admin\/ads\/(cautari|termeni|cont|conversii|cautare)(\/|$)/,
    googleOnly: true,
    noPrefetch: true,
    ready: true,
  },
  { key: "materiale", href: "/admin/ads/materiale", label: "Materiale", icon: <IconMaterials />, match: /^\/admin\/ads\/materiale/, ready: false },
  { key: "apeluri", href: "/admin/ads/apeluri", label: "Apeluri", icon: <IconCalls />, match: /^\/admin\/ads\/apeluri/, ready: false },
  { key: "istoric", href: "/admin/ads/istoric", label: "Istoric", icon: <IconHistory />, match: /^\/admin\/ads\/istoric/, ready: true },
];

export function visibleNav(googleTools: boolean): NavItem[] {
  return NAV_ITEMS.filter((item) => item.ready && (!item.googleOnly || googleTools));
}

/** Ecranele v2, care citesc alegerea din adresă (client, perioadă, canal). */
export const SELECTION_PAGES = /^\/admin\/ads(\/(statistici|apeluri|istoric|planuri|materiale))?\/?$/;
