import type { LucideIcon } from "lucide-react";
import { Building2, CalendarDays, Inbox, Megaphone, ShieldCheck } from "lucide-react";
import { visibleNav } from "@/components/ads/nav-items";
import { visibleFirmaNav } from "@/components/firma/nav";
import { visiblePostariNav } from "@/components/postari/nav";

/**
 * Navigarea panoului, dintr-un singur loc: cele cinci module și, pentru cel
 * activ, subpaginile lui. Subpaginile vin din configurările fiecărui modul
 * (reclame, postări, firmă), deci un ecran nou apare aici odată cu el, fără o
 * a doua listă de ținut la zi.
 */

export type PanouModuleId = "leaduri" | "reclame" | "postari" | "vault" | "firma";

export interface PanouSubItem {
  key: string;
  href: string;
  label: string;
  match: RegExp;
}

export interface PanouModule {
  id: PanouModuleId;
  label: string;
  href: string;
  icon: LucideIcon;
  match: RegExp;
  items: (googleTools: boolean) => PanouSubItem[];
}

const plain = (item: { key: string; href: string; label: string; match: RegExp }): PanouSubItem => ({
  key: item.key,
  href: item.href,
  label: item.label,
  match: item.match,
});

export const PANOU_MODULES: PanouModule[] = [
  {
    id: "leaduri",
    label: "Lead-uri",
    href: "/admin",
    icon: Inbox,
    match: /^\/admin\/?$/,
    items: () => [],
  },
  {
    id: "reclame",
    label: "Reclame",
    href: "/admin/ads",
    icon: Megaphone,
    match: /^\/admin\/ads(\/|$)/,
    items: (googleTools) => [
      ...visibleNav(googleTools).map(plain),
      { key: "clienti", href: "/admin/ads/clienti", label: "Clienți", match: /^\/admin\/ads\/clienti/ },
    ],
  },
  {
    id: "postari",
    label: "Postări",
    href: "/admin/postari",
    icon: CalendarDays,
    match: /^\/admin\/postari(\/|$)/,
    items: () => visiblePostariNav().map(plain),
  },
  {
    // Vault-ul are propriul cadru (zero-knowledge, fără nimic din admin): de aici doar se intră în el.
    id: "vault",
    label: "Vault",
    href: "/vault",
    icon: ShieldCheck,
    match: /^\/vault(\/|$)/,
    items: () => [],
  },
  {
    id: "firma",
    label: "Firmă",
    href: "/admin/firma",
    icon: Building2,
    match: /^\/admin\/firma(\/|$)/,
    items: () => visibleFirmaNav().map(plain),
  },
];

/** Modulul căruia îi aparține calea; „Lead-uri” pentru orice altă pagină din /admin. */
export function activeModule(pathname: string): PanouModule {
  return PANOU_MODULES.find((module) => module.match.test(pathname)) ?? PANOU_MODULES[0];
}

/** Subpagina activă a modulului (cea mai specifică potrivire e prima din listă, ca în meniurile vechi). */
export function isSubItemActive(item: PanouSubItem, pathname: string): boolean {
  return item.match.test(pathname);
}
