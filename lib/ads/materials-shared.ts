import type { Platform } from "./constants";

/**
 * Materialele (migrarea 15), cum le văd ecranele. Fișier izomorf.
 */

export interface MaterialUploadRow {
  platform: Platform;
  workspace: string;
  adAccount: string;
  uploadId: string;
  /** Id-ul din biblioteca contului — cel care intră în plan. `null` cât platforma încă lucrează. */
  videoId: string | null;
  status: "sent" | "ready" | "failed";
  message: string | null;
  updatedAt: string;
}

export interface MaterialRow {
  id: string;
  clientId: string | null;
  name: string;
  contentType: string;
  sizeBytes: number | null;
  durationSeconds: number | null;
  width: number | null;
  height: number | null;
  status: "uploading" | "ready";
  createdAt: string;
  createdByEmail: string | null;
  /** Link semnat, o oră, pentru previzualizarea din pagină. */
  previewUrl: string | null;
  uploads: MaterialUploadRow[];
}

export const MATERIAL_NAME_MAX = 120;

/** „9:16 · vertical”, „16:9 · orizontal”, „1:1 · pătrat” — din lățime și înălțime. */
export function aspectLabel(width: number | null, height: number | null): string | null {
  if (!width || !height) return null;
  const ratio = width / height;
  const known: Array<[number, string]> = [
    [9 / 16, "9:16 · vertical"],
    [4 / 5, "4:5 · vertical"],
    [1, "1:1 · pătrat"],
    [16 / 9, "16:9 · orizontal"],
  ];
  const close = known.find(([value]) => Math.abs(value - ratio) < 0.03);
  if (close) return close[1];
  return ratio < 1 ? `${width}×${height} · vertical` : `${width}×${height} · orizontal`;
}

/** „0:24”, „1:05”. */
export function durationLabel(seconds: number | null): string | null {
  if (seconds === null || !Number.isFinite(seconds)) return null;
  const total = Math.round(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

export function sizeLabel(bytes: number | null): string | null {
  if (!bytes) return null;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 1 }).format(bytes / 1024 / 1024)} MB`;
}
