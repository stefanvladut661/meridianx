"use client";

import { createContext, useContext, type AnchorHTMLAttributes, type ReactNode } from "react";
import Link from "next/link";

/**
 * Navigarea dintre listă și fișă trece printr-o singură „tranziție”, ca ecranul să
 * poată arăta că așteaptă răspunsul serverului (lista se estompează) în loc să
 * stea nemișcat. Linkurile rămân linkuri adevărate: clic cu Ctrl/⌘, clic de mijloc
 * și „deschide în filă nouă” merg ca în orice browser.
 */

interface LeadsNav {
  go: (href: string) => void;
  pending: boolean;
}

const Ctx = createContext<LeadsNav | null>(null);

export function LeadsNavProvider({ value, children }: { value: LeadsNav; children: ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useLeadsNav = (): LeadsNav | null => useContext(Ctx);

export function NavLink({ href, onClick, children, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  const nav = useLeadsNav();
  return (
    <Link
      href={href}
      scroll={false}
      {...rest}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented || !nav) return;
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        nav.go(href);
      }}
    >
      {children}
    </Link>
  );
}
