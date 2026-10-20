"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Banda de sub bara de sus, doar pe ecranele care lucrează într-un spațiu de
 * lucru (Plan nou, Lot, Pentru Claude, uneltele Google): spațiul ales — tokenul
 * și plafonul în care se verifică și se creează. Pe uneltele Google, și filele
 * „Căutări”: termenii, contul (negative, audit), conversiile, planul de căutare.
 */

const WORKSPACE_PAGES = /^\/admin\/ads\/(nou|lot|claude|cautare|cont|termeni|conversii)(\/|$)/;

const GOOGLE_TABS = [
  { href: "/admin/ads/termeni", label: "Termeni de căutare" },
  { href: "/admin/ads/cont", label: "Negative și audit" },
  { href: "/admin/ads/conversii", label: "Conversii" },
  { href: "/admin/ads/cautare", label: "Plan de căutare" },
];

export function LegacyStrip({ rail }: { rail: ReactNode }) {
  const pathname = usePathname();
  if (!WORKSPACE_PAGES.test(pathname)) return null;
  const google = GOOGLE_TABS.some((tab) => pathname.startsWith(tab.href));

  return (
    <div className="border-b border-hair bg-[var(--ap-side)]">
      {google ? (
        <nav aria-label="Căutări" className="flex gap-1 overflow-x-auto px-4 pt-2 [scrollbar-width:none] sm:px-6">
          {GOOGLE_TABS.map((tab) => {
            const active = pathname.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "shrink-0 whitespace-nowrap border-b-2 px-3 pb-2 pt-1.5 text-[13.5px] font-medium",
                  active ? "border-[var(--md-a1)] text-[var(--ap-accent-ink)]" : "border-transparent text-dim hover:text-bone"
                )}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      ) : null}
      <div className="px-4 py-2.5 sm:px-6">{rail}</div>
    </div>
  );
}
