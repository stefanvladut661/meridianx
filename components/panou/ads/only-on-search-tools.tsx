"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Banda cu spațiul de lucru (token + plafon) și filele „Căutări” mai servește
 * doar uneltele Google încă nerefăcute în noul design (termeni, cont, conversii,
 * plan de căutare). Ecranele refăcute (Plan nou, Lot, Creează, Pentru Claude)
 * își au spațiul de lucru în ecran. Când uneltele Google trec în designul nou,
 * componenta asta și `LegacyStrip` / `WorkspaceRail` se pot șterge.
 */
const SEARCH_TOOLS = /^\/admin\/ads\/(cautare|cont|termeni|conversii)(\/|$)/;

export function OnlyOnSearchTools({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return SEARCH_TOOLS.test(pathname) ? <>{children}</> : null;
}
