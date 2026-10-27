import type { ClipProbe } from "./clipuri";

/**
 * Limitele platformelor, din documentația oficială (citatele sunt cele din
 * documentație, ca să se poată verifica):
 *
 * Instagram — Reels prin Content Publishing
 * (developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/media):
 *   „Container: MOV or MP4 (MPEG-4 Part 14), no edit lists, moov atom at the front of the file.”
 *   „Audio codec: AAC, 48khz sample rate maximum, 1 or 2 channels (mono or stereo).”
 *   „Video codec: HEVC or H264, progressive scan, closed GOP, 4:2:0 chroma subsampling.”
 *   „Frame rate: 23-60 FPS.”  „Maximum columns (horizontal pixels): 1920”
 *   „Video bitrate: VBR, 25Mbps maximum”  „Duration: 15 mins maximum, 3 seconds minimum”
 *   „File size: 300MB maximum”  Descrierea: 2200 de caractere, 30 de hashtag-uri, 20 de @.
 *
 * TikTok — Content Posting API, media transfer guide
 * (developers.tiktok.com/docs/en/content-posting-api-media-transfer-guide):
 *   formate MP4 (recomandat), WebM, MOV; codecuri H.264 (recomandat), H.265, VP8, VP9;
 *   „Minimum of 23 FPS” / „Maximum of 60 FPS”; „Minimum of 360 pixels for both height
 *   and width” / „Maximum of 4096 pixels”; „The longest video a developer can send via the
 *   initialize Upload Video endpoint is 10 minutes.”; „Maximum of 4GB”.
 *
 * Plus regula Meridian: clipurile sunt verticale, 9:16.
 */

export type Platforma = "instagram" | "tiktok";
export const PLATFORME: readonly Platforma[] = ["instagram", "tiktok"];
export const PLATFORMA_LABEL: Record<Platforma, string> = { instagram: "Instagram", tiktok: "TikTok" };

export const IG_LIMITS = {
  minDurationMs: 3_000,
  maxDurationMs: 15 * 60_000,
  maxBytes: 300 * 1024 * 1024,
  maxWidth: 1920,
  minFps: 23,
  maxFps: 60,
  maxVideoKbps: 25_000,
  maxAudioHz: 48_000,
  captionChars: 2200,
  hashtags: 30,
  mentions: 20,
} as const;

export const TT_LIMITS = {
  maxDurationMs: 10 * 60_000,
  /** TikTok primește 4 GB; adminul ține clipul în memorie cât îl urcă, așa că se oprește mai jos. */
  maxBytes: 250 * 1024 * 1024,
  minSide: 360,
  maxSide: 4096,
  minFps: 23,
  maxFps: 60,
  captionChars: 2200,
} as const;

/** 9:16, cu o toleranță de 1% (ex. 1080×1920, 720×1280, 1080×1918). */
export const VERTICAL = 9 / 16;
export function isVertical916(width: number, height: number): boolean {
  if (width <= 0 || height <= 0) return false;
  return Math.abs(width / height - VERTICAL) / VERTICAL <= 0.01;
}

export interface Issue {
  nivel: "eroare" | "atentie";
  mesaj: string;
}

const CODEC_LABEL: Record<string, string> = { h264: "H.264", hevc: "HEVC (H.265)", vp8: "VP8", vp9: "VP9", av1: "AV1", prores: "ProRes", mpeg4: "MPEG-4", aac: "AAC", opus: "Opus", ac3: "AC-3", eac3: "E-AC-3", pcm: "PCM" };
export const codecLabel = (codec: string | null) => (codec ? (CODEC_LABEL[codec] ?? codec) : "—");

export function mb(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toLocaleString("ro-RO", { maximumFractionDigits: 1 })} MB`;
}

export function seconds(ms: number): string {
  return `${(ms / 1000).toLocaleString("ro-RO", { maximumFractionDigits: 1 })} s`;
}

/** Ce e comun: fișierul s-a putut citi și e vertical 9:16. */
export function commonIssues(probe: ClipProbe): Issue[] {
  if (probe.eroare) return [{ nivel: "eroare", mesaj: probe.eroare }];
  const issues: Issue[] = [];
  const width = probe.latime ?? 0;
  const height = probe.inaltime ?? 0;
  if (!isVertical916(width, height)) {
    issues.push({ nivel: "eroare", mesaj: `Clipul e ${width}×${height}, nu vertical 9:16 (ex. 1080×1920). Exportă-l în format 9:16.` });
  }
  return issues;
}

export function instagramIssues(probe: ClipProbe, storageLimitMb: number): Issue[] {
  if (probe.eroare) return [];
  const issues: Issue[] = [];
  const container = probe.mime === "video/mp4" || probe.mime === "video/quicktime" || /\.(mp4|mov)$/i.test(probe.nume);
  if (!container) issues.push({ nivel: "eroare", mesaj: "Instagram primește doar MP4 sau MOV." });
  if (probe.moovLaInceput === false) issues.push({ nivel: "eroare", mesaj: "Instagram cere indexul (moov) la începutul fișierului. Exportă cu „-movflags +faststart” (ffmpeg)." });
  if (probe.codecVideo !== "h264" && probe.codecVideo !== "hevc") issues.push({ nivel: "eroare", mesaj: `Instagram primește video H.264 sau HEVC, nu ${codecLabel(probe.codecVideo)}.` });
  if (probe.codecAudio && probe.codecAudio !== "aac") issues.push({ nivel: "eroare", mesaj: `Instagram primește sunet AAC, nu ${codecLabel(probe.codecAudio)}.` });
  if (probe.audioHz && probe.audioHz > IG_LIMITS.maxAudioHz) issues.push({ nivel: "eroare", mesaj: `Sunetul e la ${probe.audioHz} Hz; Instagram primește cel mult 48 kHz.` });
  if (probe.audioCanale && probe.audioCanale > 2) issues.push({ nivel: "eroare", mesaj: `Sunetul are ${probe.audioCanale} canale; Instagram primește mono sau stereo.` });
  if (probe.fps !== null && (probe.fps < IG_LIMITS.minFps - 0.01 || probe.fps > IG_LIMITS.maxFps + 0.01)) issues.push({ nivel: "eroare", mesaj: `Clipul are ${probe.fps.toLocaleString("ro-RO", { maximumFractionDigits: 2 })} cadre pe secundă; Instagram primește între 23 și 60.` });
  if ((probe.latime ?? 0) > IG_LIMITS.maxWidth) issues.push({ nivel: "eroare", mesaj: `Clipul are ${probe.latime} px lățime; Instagram primește cel mult 1920.` });
  if (probe.debitKbps !== null && probe.debitKbps > IG_LIMITS.maxVideoKbps) issues.push({ nivel: "eroare", mesaj: `Debitul video e ${(probe.debitKbps / 1000).toLocaleString("ro-RO", { maximumFractionDigits: 1 })} Mbps; Instagram primește cel mult 25 Mbps. Exportă cu un CRF mai mare sau cu „-maxrate 20M -bufsize 40M”.` });
  const duration = probe.durataMs ?? 0;
  if (duration < IG_LIMITS.minDurationMs) issues.push({ nivel: "eroare", mesaj: `Clipul are ${seconds(duration)}; Instagram cere cel puțin 3 secunde.` });
  if (duration > IG_LIMITS.maxDurationMs) issues.push({ nivel: "eroare", mesaj: `Clipul are ${seconds(duration)}; Instagram primește cel mult 15 minute.` });
  if (probe.marime > IG_LIMITS.maxBytes) issues.push({ nivel: "eroare", mesaj: `Clipul are ${mb(probe.marime)}; Instagram primește cel mult 300 MB.` });
  else if (probe.marime > storageLimitMb * 1024 * 1024) {
    issues.push({ nivel: "eroare", mesaj: `Clipul are ${mb(probe.marime)}, iar stocarea temporară primește cel mult ${storageLimitMb} MB pe fișier (planul gratuit Supabase: 50 MB). Exportă-l mai mic (ex. „-crf 20 -maxrate 12M -bufsize 24M”).` });
  }
  return issues;
}

export function tiktokIssues(probe: ClipProbe): Issue[] {
  if (probe.eroare) return [];
  const issues: Issue[] = [];
  const container = probe.mime === "video/mp4" || probe.mime === "video/quicktime" || probe.mime === "video/webm" || /\.(mp4|mov|webm)$/i.test(probe.nume);
  if (!container) issues.push({ nivel: "eroare", mesaj: "TikTok primește MP4, MOV sau WebM." });
  if (!["h264", "hevc", "vp8", "vp9"].includes(probe.codecVideo ?? "")) issues.push({ nivel: "eroare", mesaj: `TikTok primește H.264, H.265, VP8 sau VP9, nu ${codecLabel(probe.codecVideo)}.` });
  if (probe.fps !== null && (probe.fps < TT_LIMITS.minFps - 0.01 || probe.fps > TT_LIMITS.maxFps + 0.01)) issues.push({ nivel: "eroare", mesaj: `Clipul are ${probe.fps.toLocaleString("ro-RO", { maximumFractionDigits: 2 })} cadre pe secundă; TikTok primește între 23 și 60.` });
  const width = probe.latime ?? 0;
  const height = probe.inaltime ?? 0;
  if (Math.min(width, height) < TT_LIMITS.minSide) issues.push({ nivel: "eroare", mesaj: `Clipul e ${width}×${height}; TikTok cere cel puțin 360 px pe fiecare latură.` });
  if (Math.max(width, height) > TT_LIMITS.maxSide) issues.push({ nivel: "eroare", mesaj: `Clipul e ${width}×${height}; TikTok primește cel mult 4096 px pe latură.` });
  if ((probe.durataMs ?? 0) > TT_LIMITS.maxDurationMs) issues.push({ nivel: "eroare", mesaj: `Clipul are ${seconds(probe.durataMs ?? 0)}; prin API, TikTok primește cel mult 10 minute.` });
  if (probe.marime > TT_LIMITS.maxBytes) issues.push({ nivel: "eroare", mesaj: `Clipul are ${mb(probe.marime)}; adminul urcă pe TikTok clipuri de cel mult 250 MB.` });
  return issues;
}

/** Ce s-a citit, pe scurt: „1080×1920 · 27,4 s · 30 cps · H.264/AAC · 34,2 MB · 9,8 Mbps”. */
export function probeSummary(probe: ClipProbe): string {
  if (probe.eroare) return probe.eroare;
  const parts = [`${probe.latime}×${probe.inaltime}`, seconds(probe.durataMs ?? 0)];
  if (probe.fps) parts.push(`${probe.fps.toLocaleString("ro-RO", { maximumFractionDigits: 2 })} cps`);
  parts.push(`${codecLabel(probe.codecVideo)}${probe.codecAudio ? `/${codecLabel(probe.codecAudio)}` : ", fără sunet"}`);
  parts.push(mb(probe.marime));
  if (probe.debitKbps) parts.push(`${(probe.debitKbps / 1000).toLocaleString("ro-RO", { maximumFractionDigits: 1 })} Mbps`);
  return parts.join(" · ");
}
