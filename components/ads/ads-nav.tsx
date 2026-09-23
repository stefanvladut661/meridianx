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
] as const;

export function AdsNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Reclame" className="flex items-center gap-1">
      {LINKS.map((link) => {
        const active = link.exact ? pathname === link.href : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-full px-3 py-1.5 text-[13.5px] font-medium transition-colors duration-150",
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
