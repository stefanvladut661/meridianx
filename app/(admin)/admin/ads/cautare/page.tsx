import type { Metadata } from "next";
import { currentWorkspaceId, listWorkspaces } from "@/lib/ads/workspaces.server";
import { SearchEditor } from "@/components/ads/search-editor";
import { checkSearchPlan, createSearchPlan } from "../actions";

export const metadata: Metadata = {
  title: "Căutare — MERIDIAN Reclame",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/** Verificarea întreabă contul, locațiile, conversiile și adresele, apoi trimite tot planul cu validateOnly. */
export const maxDuration = 60;

/**
 * /admin/ads/cautare — planul de căutare (`meridian-google-search/1`):
 * campanii, grupuri, cuvinte cheie, negative, anunțuri responsive și
 * materiale, într-un singur cont Google Ads. Citit în română, verificat cu
 * `validateOnly`, creat într-o singură cerere — totul oprit.
 */
export default async function SearchPlanPage() {
  const workspaces = listWorkspaces();
  const currentId = await currentWorkspaceId();
  const current = workspaces.find((workspace) => workspace.id === currentId);

  return (
    <main className="mx-auto max-w-[1400px] px-4 pb-10 pt-8 sm:px-8 sm:pt-10">
      <p className="eyebrow">Reclame · Google</p>
      <h1 className="display mt-2 text-[2.25rem] text-bone sm:text-[2.75rem]">Campanii de căutare</h1>
      <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-bone/70">
        Un plan = un cont Google Ads = mai multe campanii de căutare, cu grupurile, cuvintele cheie, negativele,
        anunțurile și materialele lor. Portalul le citește, găsește conflictele și le creează pe toate odată — oprite.
      </p>
      {current && current.platform !== "google" ? (
        <p className="mt-4 max-w-2xl rounded-panel-lg border border-[#f0b429]/30 bg-[#f0b429]/[0.04] px-4 py-3 text-[14px] leading-relaxed text-[var(--ap-warn)]">
          Lucrezi în {current.name}. Planurile de căutare se creează în Google Ads: treci în Meridian · Google sau Clienți ·
          Google din selectorul de sus.
        </p>
      ) : null}

      <div className="mt-8">
        <SearchEditor
          workspaces={workspaces}
          currentWorkspaceId={currentId}
          actions={{ checkPlan: checkSearchPlan, createPaused: createSearchPlan }}
        />
      </div>
    </main>
  );
}
