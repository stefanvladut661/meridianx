import type { Metadata } from "next";
import { currentWorkspaceId, listWorkspaces } from "@/lib/ads/workspaces.server";
import { PlanEditor } from "@/components/ads/plan-editor";
import {
  checkPlanOnMeta,
  checkVideoUploadStatus,
  chooseWorkspace,
  createPausedCampaign,
  listLibraryVideos,
  prepareVideoUpload,
  sendStagedVideoToMeta,
} from "../actions";

export const metadata: Metadata = {
  title: "Plan nou — MERIDIAN Reclame",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Acțiunile paginii rulează în funcția ei. Copierea unui video de către Meta
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
    <main className="mx-auto max-w-[1400px] px-4 pb-10 pt-8 sm:px-8 sm:pt-10">
      <p className="eyebrow">Reclame</p>
      <h1 className="display mt-2 text-[2.25rem] text-bone sm:text-[2.75rem]">Plan nou</h1>
      <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-bone/70">
        Lipește planul de campanie scris în altă conversație. Portalul îl verifică, ți-l spune în română
        și îl creează — oprit — în spațiul de lucru de sus.
      </p>

      <div className="mt-8">
        <PlanEditor
          workspaces={workspaces}
          currentWorkspaceId={currentId}
          actions={{
            chooseWorkspace,
            checkPlan: checkPlanOnMeta,
            createPaused: createPausedCampaign,
            listLibrary: listLibraryVideos,
            prepareUpload: prepareVideoUpload,
            sendUpload: sendStagedVideoToMeta,
            uploadStatus: checkVideoUploadStatus,
          }}
        />
      </div>
    </main>
  );
}
