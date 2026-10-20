import "server-only";

import type { AdsWorkspace } from "../workspaces";
import { metaGet, metaUploadVideoFromUrl } from "./graph";
import type { UploadStatus } from "../types";

/**
 * Video nou în biblioteca contului: Meta îl descarcă singur, de la un link
 * semnat din stocarea temporară a portalului, apoi îl procesează.
 *
 * Documentația nu spune dacă `POST /advideos` cu `file_url` așteaptă
 * descărcarea sau răspunde imediat, deci nu presupunem nimic: fișierul
 * temporar rămâne până când starea devine `ready` sau eroare, iar starea se
 * citește din `status` al video-ului:
 *   `video_status`      — ready | processing | expired | error;
 *   `uploading_phase`   — Meta copiază fișierul (bytes_transferred / source_file_size);
 *   `processing_phase`  — Meta îl pregătește (`processing_progress` 0–100).
 * Eroarea stă în `<fază>.errors[0].message` (SDK) sau `<fază>.error.message`
 * (un exemplu mai vechi din documentație) — le citim pe amândouă.
 */

export async function sendVideoToMeta(
  workspace: AdsWorkspace,
  adAccount: string,
  input: { fileUrl: string; title: string }
): Promise<{ videoId: string }> {
  const { id } = await metaUploadVideoFromUrl(workspace, adAccount, input);
  return { videoId: id };
}

interface RawPhase {
  status?: string;
  errors?: Array<{ code?: number; message?: string }>;
  error?: { code?: number; message?: string };
  bytes_transferred?: number;
  /** Așa apare într-un exemplu din documentația Meta. */
  bytes_transfered?: number;
  source_file_size?: number;
}

interface RawStatus {
  video_status?: string;
  processing_progress?: number;
  uploading_phase?: RawPhase;
  processing_phase?: RawPhase;
}

function phaseError(phase: RawPhase | undefined): string | null {
  return phase?.errors?.find((error) => error.message)?.message ?? phase?.error?.message ?? null;
}

function percent(value: number | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(100, Math.round(value))) : null;
}

export function readUploadStatus(raw: RawStatus | undefined): UploadStatus {
  const status = raw ?? {};
  const uploading = status.uploading_phase;
  const processing = status.processing_phase;

  if (status.video_status === "expired") {
    return { state: "error", progress: null, message: "Meta a marcat încărcarea ca expirată." };
  }
  if (status.video_status === "error" || uploading?.status === "error" || processing?.status === "error") {
    return {
      state: "error",
      progress: null,
      message: phaseError(uploading) ?? phaseError(processing) ?? "Meta a marcat video-ul cu eroare, fără detalii.",
    };
  }
  if (status.video_status === "ready") return { state: "ready", progress: 100, message: null };

  // Meta încă descarcă fișierul de la noi.
  if (uploading && uploading.status !== "complete") {
    const transferred = uploading.bytes_transferred ?? uploading.bytes_transfered;
    const total = uploading.source_file_size;
    return {
      state: "copying",
      progress: transferred !== undefined && total ? percent((transferred / total) * 100) : null,
      message: null,
    };
  }
  return { state: "processing", progress: percent(status.processing_progress), message: null };
}

export async function readVideoUploadStatus(workspace: AdsWorkspace, videoId: string): Promise<UploadStatus> {
  const video = await metaGet<{ status?: RawStatus }>(workspace, `/${videoId}`, { fields: "status" });
  return readUploadStatus(video.status);
}
