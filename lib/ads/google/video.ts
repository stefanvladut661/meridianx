import "server-only";

import type { UploadStatus } from "../types";
import type { AdsWorkspace } from "../workspaces";
import { googleSearch, googleUploadYouTubeVideo, idOf } from "./api";
import { findGoogleAccount } from "./lookup";

/**
 * Video nou pe Google: din anticamera portalului, pe YouTube, prin Google
 * Ads (canalul administrat de Google al contului, NELISTAT).
 *
 * Spre deosebire de Meta și TikTok, Google nu descarcă singur de la un
 * link: serverul ia fișierul din anticameră (cel mult 50 MB) și îl trimite
 * într-o singură cerere. Google îl procesează după; starea se citește din
 * `you_tube_video_upload`, iar când e gata, video-ul are id-ul lui de
 * YouTube — pe acela îl primește planul.
 */

export class GoogleAccountHiddenError extends Error {
  constructor(customerId: string) {
    super(`Cheia nu vede contul Google Ads ${customerId}.`);
    this.name = "GoogleAccountHiddenError";
  }
}

export async function sendVideoToGoogle(
  workspace: AdsWorkspace,
  customerId: string,
  input: { fileUrl: string; title: string }
): Promise<{ videoId: string }> {
  const account = await findGoogleAccount(workspace, customerId);
  if (!account) throw new GoogleAccountHiddenError(customerId);

  const file = await fetch(input.fileUrl, { cache: "no-store", signal: AbortSignal.timeout(40_000) });
  if (!file.ok) throw new Error(`fișierul din stocarea temporară nu s-a putut citi (HTTP ${file.status})`);
  const bytes = await file.arrayBuffer();
  const contentType = file.headers.get("content-type")?.startsWith("video/") ? (file.headers.get("content-type") as string) : "video/mp4";

  const { resourceName } = await googleUploadYouTubeVideo(
    workspace,
    account.info.id,
    { title: input.title, bytes, contentType },
    { loginCustomerId: account.loginCustomerId }
  );
  const uploadId = idOf(resourceName);
  if (!uploadId) throw new Error("Google a primit video-ul, dar n-a întors id-ul urcării.");
  return { videoId: uploadId };
}

const STATE: Record<string, UploadStatus["state"]> = {
  PENDING: "copying",
  UPLOADED: "processing",
  PROCESSED: "ready",
  FAILED: "error",
  REJECTED: "error",
  UNAVAILABLE: "error",
};

export async function readGoogleUploadStatus(
  workspace: AdsWorkspace,
  customerId: string,
  uploadId: string
): Promise<UploadStatus> {
  const account = await findGoogleAccount(workspace, customerId);
  if (!account) throw new GoogleAccountHiddenError(customerId);
  const resource = `customers/${account.info.id}/youTubeVideoUploads/${uploadId}`;
  const rows = await googleSearch<{ youTubeVideoUpload?: { videoId?: string; state?: string } }>(
    workspace,
    account.info.id,
    `SELECT you_tube_video_upload.resource_name, you_tube_video_upload.video_id, you_tube_video_upload.state FROM you_tube_video_upload WHERE you_tube_video_upload.resource_name = '${resource}'`,
    { loginCustomerId: account.loginCustomerId }
  );
  const upload = rows[0]?.youTubeVideoUpload;
  const state = STATE[upload?.state ?? ""] ?? "processing";
  if (state === "ready" && upload?.videoId) return { state, progress: 100, message: null, finalId: upload.videoId };
  if (state === "ready") return { state: "processing", progress: null, message: null };
  if (state === "error") {
    return {
      state,
      progress: null,
      message:
        upload?.state === "REJECTED"
          ? "YouTube a respins video-ul (politici sau drepturi de autor)."
          : upload?.state === "UNAVAILABLE"
            ? "video-ul nu mai e disponibil pe YouTube."
            : "YouTube n-a putut procesa fișierul.",
    };
  }
  return { state, progress: null, message: null };
}
