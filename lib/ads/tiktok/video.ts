import "server-only";

import type { UploadStatus } from "../types";
import type { AdsWorkspace } from "../workspaces";
import { tiktokCreate } from "./api";
import { readVideo } from "./lookup";

/**
 * Video nou în biblioteca contului TikTok: TikTok îl descarcă singur, de la
 * linkul semnat din stocarea temporară a portalului (`UPLOAD_BY_URL`).
 *
 * Cererea e sincronă — răspunde după descărcare, cu id-ul video-ului —, dar
 * conversia continuă după: starea se citește din `/file/video/ad/info/`
 * până când video-ul e afișabil, cu durată și copertă. TikTok nu dă un
 * procent de conversie, deci bara rămâne nedeterminată.
 */

/** Numele din bibliotecă: 1–100 de caractere, unic, ca să nu se confunde cu o urcare anterioară. */
function fileName(title: string): string {
  const base = title.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 80) || "video";
  return `${base} · ${Date.now().toString(36)}`;
}

export async function sendVideoToTikTok(
  workspace: AdsWorkspace,
  advertiserId: string,
  input: { fileUrl: string; title: string }
): Promise<{ videoId: string }> {
  const data = await tiktokCreate<unknown>(workspace, "/file/video/ad/upload/", {
    advertiser_id: advertiserId,
    upload_type: "UPLOAD_BY_URL",
    video_url: input.fileUrl,
    file_name: fileName(input.title),
  });
  // `data` e o listă cu un obiect (documentația v1.3); citim și forma de obiect.
  const first = Array.isArray(data) ? data[0] : data;
  const videoId = first && typeof first === "object" ? (first as { video_id?: unknown }).video_id : undefined;
  if (typeof videoId !== "string" || !videoId) throw new Error("TikTok a primit video-ul, dar n-a întors id-ul lui.");
  return { videoId };
}

export async function readTikTokUploadStatus(
  workspace: AdsWorkspace,
  advertiserId: string,
  videoId: string
): Promise<UploadStatus> {
  const video = await readVideo(workspace, advertiserId, videoId);
  if (video?.ready) return { state: "ready", progress: 100, message: null };
  // Negăsit încă sau în conversie: TikTok îl pregătește.
  return { state: "processing", progress: null, message: null };
}
