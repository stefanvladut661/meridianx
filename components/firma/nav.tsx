import type { ReactNode } from "react";
import { IconBank, IconClients, IconExpense, IconHistory, IconInvoice, IconKey, IconPackage, IconPanel, IconSettings } from "./icons";

/**
 * Meniul modulului, în ordinea fazelor. Un ecran care nu există încă nu apare
 * (un link spre nimic e un drum înfundat): `ready` se aprinde în faza care îl
 * construiește. `month`/`client`: ecranul citește luna și clientul din bara de sus.
 */
export interface FirmaNavItem {
  key: string;
  href: string;
  label: string;
  icon: ReactNode;
  match: RegExp;
  month: boolean;
  client: boolean;
  ready: boolean;
}

export const FIRMA_NAV: FirmaNavItem[] = [
  { key: "panou", href: "/admin/firma", label: "Panou", icon: <IconPanel />, match: /^\/admin\/firma\/?$/, month: true, client: false, ready: false },
  { key: "clienti", href: "/admin/firma/clienti", label: "Clienți", icon: <IconClients />, match: /^\/admin\/firma\/clienti/, month: true, client: false, ready: true },
  { key: "facturi", href: "/admin/firma/facturi", label: "Facturi", icon: <IconInvoice />, match: /^\/admin\/firma\/facturi/, month: true, client: true, ready: false },
  { key: "cheltuieli", href: "/admin/firma/cheltuieli", label: "Cheltuieli", icon: <IconExpense />, match: /^\/admin\/firma\/cheltuieli/, month: true, client: false, ready: false },
  { key: "incasari", href: "/admin/firma/incasari", label: "Încasări", icon: <IconBank />, match: /^\/admin\/firma\/incasari/, month: true, client: false, ready: false },
  { key: "contabil", href: "/admin/firma/contabil", label: "Contabil", icon: <IconPackage />, match: /^\/admin\/firma\/contabil/, month: true, client: false, ready: false },
  { key: "accese", href: "/admin/firma/accese", label: "Accese", icon: <IconKey />, match: /^\/admin\/firma\/accese/, month: false, client: false, ready: false },
  { key: "istoric", href: "/admin/firma/istoric", label: "Istoric", icon: <IconHistory />, match: /^\/admin\/firma\/istoric/, month: false, client: false, ready: true },
  { key: "setari", href: "/admin/firma/setari", label: "Setări", icon: <IconSettings />, match: /^\/admin\/firma\/setari/, month: false, client: false, ready: true },
];

export function visibleFirmaNav(): FirmaNavItem[] {
  return FIRMA_NAV.filter((item) => item.ready);
}

export function navItemFor(pathname: string): FirmaNavItem | null {
  return FIRMA_NAV.find((item) => item.match.test(pathname)) ?? null;
}
