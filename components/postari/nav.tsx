import type { ReactNode } from "react";
import { IconFilm, IconHistory, IconPhone, IconPlan, IconQueue, IconSettings } from "./icons";

/**
 * Meniul modulului. Un ecran care nu există încă nu apare (un link spre nimic
 * e un drum înfundat): `ready` se aprinde în faza care îl construiește.
 * `mobile`: ecranele din bara de jos a telefonului, în ordinea asta — „De publicat
 * pe TikTok” e acolo, fiindcă pe telefon vine notificarea.
 */
export interface PostariNavItem {
  key: string;
  href: string;
  label: string;
  short: string;
  icon: ReactNode;
  match: RegExp;
  ready: boolean;
  mobile: number | null;
}

export const POSTARI_NAV: PostariNavItem[] = [
  { key: "coada", href: "/admin/postari", label: "Coada", short: "Coada", icon: <IconQueue />, match: /^\/admin\/postari\/?$/, ready: false, mobile: 1 },
  { key: "plan", href: "/admin/postari/plan", label: "Plan nou", short: "Plan nou", icon: <IconPlan />, match: /^\/admin\/postari\/plan/, ready: false, mobile: 3 },
  { key: "clipuri", href: "/admin/postari/clipuri", label: "Clipuri", short: "Clipuri", icon: <IconFilm />, match: /^\/admin\/postari\/clipuri/, ready: true, mobile: 4 },
  { key: "tiktok", href: "/admin/postari/tiktok", label: "De publicat pe TikTok", short: "TikTok", icon: <IconPhone />, match: /^\/admin\/postari\/tiktok/, ready: false, mobile: 2 },
  { key: "istoric", href: "/admin/postari/istoric", label: "Istoric", short: "Istoric", icon: <IconHistory />, match: /^\/admin\/postari\/istoric/, ready: true, mobile: null },
  { key: "setari", href: "/admin/postari/setari", label: "Setări", short: "Setări", icon: <IconSettings />, match: /^\/admin\/postari\/setari/, ready: true, mobile: null },
];

export function visiblePostariNav(): PostariNavItem[] {
  return POSTARI_NAV.filter((item) => item.ready);
}

export function navItemFor(pathname: string): PostariNavItem | null {
  return POSTARI_NAV.find((item) => item.match.test(pathname)) ?? null;
}
