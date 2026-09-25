"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * Navigarea portalului. Doar paginile care există — un link spre un ecran
 * care încă nu e construit e un drum înfundat, nu o promisiune.
 */
const LINKS = [
  { href: "/admin/ads", label: "Campanii", exact: true },
  { href: "/admin/ads/nou", label: "Plan nou", exact: false },
  { href: "/admin/ads/statistici", label: "Statistici", exact: false },
] as const;

export function AdsNav() {
  const pathname = usePathname();

  return (
    // Pe telefon, trei linkuri + „Ieși” nu încap la 360px fără să se rupă:
    // lista derulează orizontal în locul ei, fiecare link pe un singur rând.
    <nav
      aria-label="Reclame"
      className="-my-1 flex min-w-0 items-center gap-0.5 overflow-x-auto px-1 py-1 [scrollbar-width:none] sm:gap-1"
    >
      {LINKS.map((link) => {
        const active = link.exact ? pathname === link.href : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "shrink-0 whitespace-nowrap rounded-full px-2.5 py-1.5 text-[13px] font-medium transition-colors duration-150 sm:px-3 sm:text-[13.5px]",
              active ? "bg-glass text-bone" : "text-dim hover:text-bone"
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
