import type { Metadata } from "next";
import Link from "next/link";
import { currentWorkspaceId, listWorkspaces } from "@/lib/ads/workspaces.server";
import { PlanEditor } from "@/components/panou/ads/plan-editor";
import { PAGE_LEAD, PAGE_TITLE } from "@/components/panou/ads/tone";
import {
  checkPlan,
  checkVideoUploadStatus,
  chooseWorkspace,
  createPausedCampaign,
  listLibraryVideos,
  prepareVideoUpload,
  sendStagedVideo,
} from "../actions";
import { continueJobAction } from "../v2-actions";

export const metadata: Metadata = {
  title: "Plan nou — MERIDIAN Reclame",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Acțiunile paginii rulează în funcția ei. Copierea unui video de către platformă
 * (faza 3) poate dura mai mult decât un apel obișnuit.
 */
export const maxDuration = 60;

/**
 * /admin/ads/nou — lipești planul, îl citești, îl corectezi.
 *
 * Pagina de server dă editorului doar ce e public despre spații (nume,
 * platformă, dacă tokenul e setat) și spațiul curent. Tokenurile rămân
 * aici, pe server.
 */
export default async function NewPlanPage() {
  const workspaces = listWorkspaces();
  const currentId = await currentWorkspaceId();

  return (
    <div className="space-y-4">
      <div>
        <Link href="/admin/ads/planuri" className="text-[11.5px] text-muted-foreground hover:text-foreground">
          ← Planuri
        </Link>
        <h1 className={`mt-2 ${PAGE_TITLE}`}>Plan nou</h1>
        <p className={PAGE_LEAD}>
          Lipește JSON-ul scris cu asistentul. Îl citim în română, îl verificăm pe conturile reale și abia apoi îl creăm — oprit.
        </p>
      </div>

      <PlanEditor
        workspaces={workspaces}
        currentWorkspaceId={currentId}
        actions={{
          chooseWorkspace,
          checkPlan,
          createPaused: createPausedCampaign,
          continueJob: continueJobAction,
          listLibrary: listLibraryVideos,
          prepareUpload: prepareVideoUpload,
          sendUpload: sendStagedVideo,
          uploadStatus: checkVideoUploadStatus,
        }}
      />
    </div>
  );
}
