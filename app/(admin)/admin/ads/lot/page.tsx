import type { Metadata } from "next";
import { currentWorkspaceId, listWorkspaces } from "@/lib/ads/workspaces.server";
import { BatchEditor } from "@/components/ads/batch-editor";
import { checkBatchPlan, createBatchPlan } from "../actions";
import { continueJobAction } from "../v2-actions";

export const metadata: Metadata = {
  title: "Lot de planuri — MERIDIAN Reclame",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/** Fiecare plan se verifică și se creează într-un apel separat; unul singur poate dura. */
export const maxDuration = 60;

/**
 * /admin/ads/lot — mai multe planuri odată, pentru același proprietar
 * (agenția sau clienții), pe oricare platformă.
 */
export default async function BatchPage() {
  const workspaces = listWorkspaces();
  const currentId = await currentWorkspaceId();

  return (
    <main className="mx-auto max-w-[1400px] px-4 pb-10 pt-8 sm:px-8 sm:pt-10">
      <p className="eyebrow">Reclame</p>
      <h1 className="display mt-2 text-[2.25rem] text-bone sm:text-[2.75rem]">Lot de planuri</h1>
      <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-bone/70">
        Lipește toate planurile scrise în conversație. Portalul le verifică pe rând, pe conturile reale, și le
        creează — oprite — fiecare în spațiul scris în el.
      </p>

      <div className="mt-8">
        <BatchEditor
          workspaces={workspaces}
          currentWorkspaceId={currentId}
          actions={{ checkBatchPlan, createBatchPlan, continueJob: continueJobAction }}
        />
      </div>
    </main>
  );
}
