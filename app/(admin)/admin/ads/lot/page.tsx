import type { Metadata } from "next";
import Link from "next/link";
import { currentWorkspaceId, listWorkspaces } from "@/lib/ads/workspaces.server";
import { BatchEditor } from "@/components/panou/ads/batch-editor";
import { PAGE_TITLE } from "@/components/panou/ads/tone";
import { checkBatchPlan, chooseWorkspace, createBatchPlan } from "../actions";
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
    <div className="space-y-4">
      <div>
        <Link href="/admin/ads/planuri" className="text-[13px] text-muted-foreground hover:text-foreground">
          ← Planuri
        </Link>
        <h1 className={`mt-2 ${PAGE_TITLE}`}>Lot de planuri</h1>
      </div>

      <BatchEditor
        workspaces={workspaces}
        currentWorkspaceId={currentId}
        actions={{ checkBatchPlan, createBatchPlan, continueJob: continueJobAction, chooseWorkspace }}
      />
    </div>
  );
}
