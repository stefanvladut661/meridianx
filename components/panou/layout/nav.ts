import { Building2, CalendarDays, Crosshair, Inbox, Megaphone, ShieldCheck, type LucideIcon } from "lucide-react";
import { FIRMA_NAV } from "@/components/firma/nav";

/**
 * Navigarea panoului, ca în redesign (config/nav.js), cu rutele reale. Modulele
 * din meniul principal sunt cinci (Prospectare al doilea, ca în prototip); Firma are
 * loc separat, jos (modul existent, încă nerefăcut în noul design).
 */

export type PanouModuleId = "prospectare" | "leaduri" | "reclame" | "postari" | "vault" | "firma";

export interface PanouNavItem {
  label: string;
  to: string;
}

export interface PanouModule {
  id: PanouModuleId;
  label: string;
  icon: LucideIcon;
  to: string;
  items: PanouNavItem[];
}

export const modules: PanouModule[] = [
  {
    id: "leaduri",
    label: "Lead-uri",
    icon: Inbox,
    to: "/admin",
    items: [{ label: "Lista lead-urilor", to: "/admin" }],
  },
  {
    id: "prospectare",
    label: "Prospectare",
    icon: Crosshair,
    to: "/admin/prospectare",
    items: [
      { label: "Prezentare", to: "/admin/prospectare" },
      { label: "Firme", to: "/admin/prospectare/firme" },
      { label: "Apeluri azi", to: "/admin/prospectare/apeluri" },
      { label: "WhatsApp azi", to: "/admin/prospectare/whatsapp" },
      { label: "Email", to: "/admin/prospectare/email" },
      { label: "Roboți", to: "/admin/prospectare/roboti" },
      { label: "Nișe", to: "/admin/prospectare/nise" },
      { label: "Setări", to: "/admin/prospectare/setari" },
    ],
  },
  {
    id: "reclame",
    label: "Reclame",
    icon: Megaphone,
    to: "/admin/ads",
    items: [
      { label: "Campanii", to: "/admin/ads" },
      { label: "Planuri", to: "/admin/ads/planuri" },
      { label: "Pentru Claude", to: "/admin/ads/claude" },
      { label: "Statistici", to: "/admin/ads/statistici" },
      { label: "Căutări", to: "/admin/ads/cautari" },
      { label: "Materiale", to: "/admin/ads/materiale" },
      { label: "Apeluri", to: "/admin/ads/apeluri" },
      { label: "Istoric", to: "/admin/ads/istoric" },
      { label: "Clienți", to: "/admin/ads/clienti" },
    ],
  },
  {
    id: "postari",
    label: "Postări",
    icon: CalendarDays,
    to: "/admin/postari",
    items: [
      { label: "Coada", to: "/admin/postari" },
      { label: "Plan nou", to: "/admin/postari/plan" },
      { label: "De publicat pe TikTok", to: "/admin/postari/tiktok" },
      { label: "Clipuri", to: "/admin/postari/clipuri" },
      { label: "Istoric", to: "/admin/postari/istoric" },
      { label: "Setări", to: "/admin/postari/setari" },
    ],
  },
  {
    id: "vault",
    label: "Vault",
    icon: ShieldCheck,
    to: "/vault",
    items: [
      { label: "Intrări", to: "/vault" },
      { label: "Import", to: "/vault/import" },
      { label: "Export", to: "/vault/export" },
      { label: "Membri", to: "/vault/membri" },
      { label: "Contul meu", to: "/vault/cont" },
    ],
  },
];

/** Modulul Firmă: în meniu apare jos, în locul „rezervat” din prototip, fiindcă există și funcționează. */
export const firmaModule: PanouModule = {
  id: "firma",
  label: "Firmă",
  icon: Building2,
  to: "/admin/firma",
  items: FIRMA_NAV.filter((item) => item.ready).map((item) => ({ label: item.label, to: item.href })),
};

/** Titlul ecranului, cu cea mai lungă potrivire de prefix (ca în prototip). */
const TITLES: [string, string][] = [
  ["/admin/prospectare/firme", "Firme"],
  ["/admin/prospectare/apeluri", "Apeluri azi"],
  ["/admin/prospectare/whatsapp", "WhatsApp azi"],
  ["/admin/prospectare/email", "Email"],
  ["/admin/prospectare/roboti", "Roboți"],
  ["/admin/prospectare/nise", "Nișe"],
  ["/admin/prospectare/setari", "Setări prospectare"],
  ["/admin/prospectare", "Prospectare"],
  ["/admin/ads/nou", "Plan nou"],
  ["/admin/ads/lot", "Lot de planuri"],
  ["/admin/ads/creeaza", "Creează ghidat"],
  ["/admin/ads/planuri", "Planuri"],
  ["/admin/ads/claude", "Pentru Claude"],
  ["/admin/ads/statistici", "Statistici"],
  ["/admin/ads/cautari", "Căutări"],
  ["/admin/ads/cautare", "Căutări"],
  ["/admin/ads/termeni", "Căutări"],
  ["/admin/ads/conversii", "Căutări"],
  ["/admin/ads/cont", "Căutări"],
  ["/admin/ads/materiale", "Materiale"],
  ["/admin/ads/apeluri", "Apeluri"],
  ["/admin/ads/istoric", "Istoric"],
  ["/admin/ads/clienti", "Clienți"],
  ["/admin/ads", "Campanii"],
  ["/admin/postari/plan", "Plan nou"],
  ["/admin/postari/tiktok", "De publicat pe TikTok"],
  ["/admin/postari/clipuri", "Clipuri"],
  ["/admin/postari/istoric", "Istoric"],
  ["/admin/postari/setari", "Setări"],
  ["/admin/postari", "Coada"],
  ["/vault/import", "Import"],
  ["/vault/export", "Export"],
  ["/vault/membri", "Membri"],
  ["/vault/cont", "Contul meu"],
  ["/vault/activare", "Activează seiful"],
  ["/vault/recuperare", "Recuperare"],
  ["/vault", "Vault"],
  ["/admin/firma", "Firmă"],
  ["/admin", "Lead-uri"],
];

const underPath = (pathname: string, path: string): boolean => pathname === path || pathname.startsWith(`${path}/`);

/** Modulul căruia îi aparține calea: potrivirea cea mai lungă, deci `/admin` e al lead-urilor doar când nu e o cale a altui modul. */
export function activeModule(pathname: string): PanouModule {
  if (underPath(pathname, firmaModule.to)) return firmaModule;
  const hits = modules.filter((module) => underPath(pathname, module.to)).sort((a, b) => b.to.length - a.to.length);
  return hits[0] ?? modules.find((module) => module.id === "leaduri") ?? modules[0];
}

export function getScreenMeta(pathname: string): { module: PanouModule; title: string } {
  const hit = TITLES.filter(([path]) => underPath(pathname, path)).sort((a, b) => b[0].length - a[0].length)[0];
  return { module: activeModule(pathname), title: hit ? hit[1] : "Meridian" };
}

/** Subpagina e activă la egalitate sau când adresa e sub ea (fără a conta pagina-rădăcină a modulului). */
export function isItemActive(pathname: string, item: PanouNavItem, module: PanouModule): boolean {
  return pathname === item.to || (item.to !== module.to && pathname.startsWith(`${item.to}/`));
}
