import { Building2, CalendarDays, Inbox, Megaphone, ShieldCheck, type LucideIcon } from "lucide-react";
import { FIRMA_NAV } from "@/components/firma/nav";

/**
 * Navigarea panoului, ca în redesign (config/nav.js), cu rutele reale. Modulele
 * din meniul principal sunt patru; Firma are loc separat, jos (modul existent,
 * încă nerefăcut în noul design).
 */

export type PanouModuleId = "leaduri" | "reclame" | "postari" | "vault" | "firma";

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

/** Titlul și subtitlul ecranului, cu cea mai lungă potrivire de prefix (ca în prototip). */
const TITLES: [string, string, string][] = [
  ["/admin/ads/nou", "Plan nou", "Lipește planul, verifică-l, creează pe pauză"],
  ["/admin/ads/lot", "Lot de planuri", "Până la 50 de planuri, un singur proprietar"],
  ["/admin/ads/creeaza", "Creează ghidat", "Plan pas cu pas, cu previzualizare"],
  ["/admin/ads/planuri", "Planuri", "Schițe verificate înainte de creare"],
  ["/admin/ads/claude", "Pentru Claude", "Formatul planului și contextul conturilor"],
  ["/admin/ads/statistici", "Statistici", "Cheltuială și rezultate, zi cu zi"],
  ["/admin/ads/cautari", "Căutări", "Google Search, termeni, conversii"],
  ["/admin/ads/cautare", "Căutări", "Google Search, termeni, conversii"],
  ["/admin/ads/termeni", "Căutări", "Google Search, termeni, conversii"],
  ["/admin/ads/conversii", "Căutări", "Google Search, termeni, conversii"],
  ["/admin/ads/cont", "Căutări", "Google Search, termeni, conversii"],
  ["/admin/ads/materiale", "Materiale", "Biblioteca de video a conturilor"],
  ["/admin/ads/apeluri", "Apeluri", "Apelurile din reclame, notate de om"],
  ["/admin/ads/istoric", "Istoric", "Tot ce a făcut portalul"],
  ["/admin/ads/clienti", "Clienți", "Spații de lucru și conexiuni"],
  ["/admin/ads", "Campanii", "Create pe pauză, pornite de om în platformă"],
  ["/admin/postari/plan", "Plan nou", "Ce clip, pe ce platformă, la ce oră"],
  ["/admin/postari/tiktok", "De publicat pe TikTok", "Gata de lipit descrierea în aplicație"],
  ["/admin/postari/clipuri", "Clipuri", "Loturile din folderul Drive"],
  ["/admin/postari/istoric", "Istoric", "Fiecare rulare, cu rezultat"],
  ["/admin/postari/setari", "Setări", "Drive, sloturi, conturi, programare"],
  ["/admin/postari", "Coada", "Calendarul postărilor aprobate"],
  ["/vault/import", "Import", "CSV, Bitwarden sau export MERIDIAN"],
  ["/vault/export", "Export", "Doar criptat, cu parolă separată"],
  ["/vault/membri", "Membri", "Cine are cheia pentru acest seif"],
  ["/vault/cont", "Contul meu", "Parolă master și inel de chei"],
  ["/vault/activare", "Activează seiful", "Parola master nu se poate reseta"],
  ["/vault/recuperare", "Recuperare", "Cu codul de recuperare"],
  ["/vault", "Vault", "Secrete criptate, decriptate în browser"],
  ["/admin/firma", "Firmă", "Clienți, facturi, cheltuieli și încasări"],
  ["/admin", "Lead-uri", "Cereri din formularele site-ului"],
];

const underPath = (pathname: string, path: string): boolean => pathname === path || pathname.startsWith(`${path}/`);

/** Modulul căruia îi aparține calea. `/admin` e al lead-urilor doar când nu e o cale a altui modul. */
export function activeModule(pathname: string): PanouModule {
  if (underPath(pathname, firmaModule.to)) return firmaModule;
  return [...modules].reverse().find((module) => underPath(pathname, module.to)) ?? modules[0];
}

export function getScreenMeta(pathname: string): { module: PanouModule; title: string; subtitle: string } {
  const hit = TITLES.filter(([path]) => underPath(pathname, path)).sort((a, b) => b[0].length - a[0].length)[0];
  return { module: activeModule(pathname), title: hit ? hit[1] : "Meridian", subtitle: hit ? hit[2] : "" };
}

/** Subpagina e activă la egalitate sau când adresa e sub ea (fără a conta pagina-rădăcină a modulului). */
export function isItemActive(pathname: string, item: PanouNavItem, module: PanouModule): boolean {
  return pathname === item.to || (item.to !== module.to && pathname.startsWith(`${item.to}/`));
}
