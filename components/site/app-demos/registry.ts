import type { AppDemoMeta } from "./types";
import { meta as prosperanta } from "./prosperanta/meta";
import { meta as tablex } from "./tablex/meta";
import { meta as zof } from "./zof/meta";
import { meta as elyssium } from "./elyssium/meta";
import { meta as artInstall } from "./art-install/meta";

/* ============================================================
   Portofoliul de aplicații: ordinea de aici e ordinea de pe site.

   Doar metadatele se importă static (sunt mici). Componentele de
   demo se încarcă leneș, abia pe pagina lor — vezi viewer.tsx.
   ============================================================ */

export const DEMOS: AppDemoMeta[] = [prosperanta, tablex, zof, elyssium, artInstall];

export const DEMO_SLUGS = DEMOS.map((d) => d.slug);

export function getDemo(slug: string): AppDemoMeta | undefined {
  return DEMOS.find((d) => d.slug === slug);
}

/** Capturile pentru cardurile din portofoliu (generate din demo-uri). */
export function demoPoster(slug: string, device: "desktop" | "mobile") {
  return `/software/proiecte/${slug}-${device}.webp`;
}
