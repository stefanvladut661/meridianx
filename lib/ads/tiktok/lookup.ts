import "server-only";

import type { AdsWorkspace } from "../workspaces";
import type { AdAccountInfo, LibraryVideo, VideoInfo } from "../types";
import { TikTokApiError, tiktokGet, tiktokGetAll } from "./api";
import { TIKTOK_VIDEO_TRANSCODING } from "./errors";

/**
 * Citirile de pe TikTok: contul de reclame, identitățile, pixelii,
 * video-urile. Doar GET, prin `api.ts`.
 */

/** Tokenul nu vede obiectul: cont neautorizat pentru aplicație sau id greșit. */
function notVisible(error: unknown): boolean {
  return error instanceof TikTokApiError && (error.info.code === 40001 || error.info.code === 40106);
}

// ---------------------------------------------------------------------------
// Contul de reclame
// ---------------------------------------------------------------------------

interface RawAdvertiser {
  advertiser_id?: string | number;
  name?: string;
  currency?: string;
  status?: string;
}

/**
 * `status` al contului TikTok, spus în română. Conturile încă în verificare
 * pot primi campanii (oprite) — livrarea așteaptă oricum aprobarea.
 */
const ACCOUNT_STATE: Record<string, { label: string; usable: boolean }> = {
  STATUS_ENABLE: { label: "activ", usable: true },
  STATUS_PENDING_CONFIRM: { label: "în verificare la TikTok", usable: true },
  STATUS_PENDING_VERIFIED: { label: "în verificare la TikTok", usable: true },
  STATUS_WAIT_FOR_BPM_AUDIT: { label: "în verificare la TikTok", usable: true },
  STATUS_SELF_SERVICE_UNAUDITED: { label: "neverificat încă de TikTok", usable: true },
  STATUS_CONFIRM_FAIL: { label: "respins la verificare", usable: false },
  STATUS_CONFIRM_FAIL_END: { label: "respins la verificare", usable: false },
  STATUS_LIMIT: { label: "restricționat de TikTok", usable: false },
  STATUS_DISABLE: { label: "dezactivat", usable: false },
};

/**
 * Contul din plan, citit cu tokenul spațiului — `null` dacă tokenul nu-l
 * vede. Lista tuturor conturilor tokenului ar cere și secretul aplicației
 * (`/oauth2/advertiser/get/`); portalul nu-l ține, deci întreabă direct de
 * contul din plan.
 */
export async function readAdvertiser(workspace: AdsWorkspace, advertiserId: string): Promise<AdAccountInfo | null> {
  let data: { list?: RawAdvertiser[] };
  try {
    data = await tiktokGet<{ list?: RawAdvertiser[] }>(workspace, "/advertiser/info/", {
      advertiser_ids: [advertiserId],
      fields: ["advertiser_id", "name", "currency", "status"],
    });
  } catch (error) {
    if (notVisible(error)) return null;
    throw error;
  }
  const raw = (data.list ?? []).find((item) => String(item.advertiser_id) === advertiserId);
  if (!raw) return null;
  const state = ACCOUNT_STATE[raw.status ?? ""] ?? {
    label: `stare necunoscută (${raw.status ?? "—"})`,
    usable: true,
  };
  return {
    id: advertiserId,
    name: raw.name?.trim() || advertiserId,
    currency: raw.currency ?? "—",
    state: state.label,
    usable: state.usable,
  };
}

// ---------------------------------------------------------------------------
// Identitatea de pe reclamă
// ---------------------------------------------------------------------------

interface RawIdentity {
  identity_id?: string;
  identity_type?: string;
  display_name?: string;
  username?: string;
  can_push_video?: boolean;
  available_status?: string;
}

export interface TikTokIdentity {
  id: string;
  name: string;
  /** Poate primi un video urcat de noi (Spark Ads „push"). */
  canPushVideo: boolean;
  available: boolean;
}

/** Identitățile de tipul cerut pe care le vede contul. */
export async function listIdentities(
  workspace: AdsWorkspace,
  advertiserId: string,
  type: string,
  bcId: string | undefined
): Promise<TikTokIdentity[]> {
  const raw = await tiktokGetAll<RawIdentity>(
    workspace,
    "/identity/get/",
    {
      advertiser_id: advertiserId,
      identity_type: type,
      ...(bcId ? { identity_authorized_bc_id: bcId } : {}),
    },
    "identity_list",
    300
  );
  return raw
    .filter((item): item is RawIdentity & { identity_id: string } => Boolean(item.identity_id))
    .map((item) => ({
      id: item.identity_id,
      name: [item.display_name, item.username ? `@${item.username}` : null].filter(Boolean).join(" · ") || item.identity_id,
      canPushVideo: item.can_push_video !== false,
      // Fără câmp = disponibilă; altfel doar starea „AVAILABLE" e bună.
      available: item.available_status === undefined || item.available_status === "AVAILABLE",
    }));
}

// ---------------------------------------------------------------------------
// Pixelul
// ---------------------------------------------------------------------------

interface RawPixel {
  pixel_id?: string | number;
  pixel_code?: string;
  pixel_name?: string;
  events?: Array<{ optimization_event?: string; deprecated?: boolean }>;
}

export interface TikTokPixel {
  /** Id-ul numeric — cel care intră în grupul de reclame. */
  id: string;
  code: string | null;
  name: string;
  /** `optimization_event` pe care pixelul le-a primit deja. `null` = TikTok nu le-a spus. */
  events: string[] | null;
}

/** Pixelul după id-ul numeric SAU după cod (`DAN9…`, cel din codul site-ului). */
export async function findPixel(workspace: AdsWorkspace, advertiserId: string, idOrCode: string): Promise<TikTokPixel | null> {
  const raw = await tiktokGetAll<RawPixel>(
    workspace,
    "/pixel/list/",
    { advertiser_id: advertiserId },
    "pixels",
    200,
    20
  );
  const match = raw.find((pixel) => String(pixel.pixel_id) === idOrCode || pixel.pixel_code === idOrCode);
  if (!match || match.pixel_id === undefined) return null;
  return {
    id: String(match.pixel_id),
    code: match.pixel_code ?? null,
    name: match.pixel_name?.trim() || String(match.pixel_id),
    events: Array.isArray(match.events)
      ? match.events.filter((event) => !event.deprecated && event.optimization_event).map((event) => String(event.optimization_event))
      : null,
  };
}

// ---------------------------------------------------------------------------
// Video
// ---------------------------------------------------------------------------

interface RawVideo {
  video_id?: string;
  file_name?: string;
  duration?: number | null;
  video_cover_url?: string | null;
  create_time?: string;
  displayable?: boolean;
}

/**
 * TikTok nu are un câmp „gata procesat": un video e gata când e afișabil și
 * are durată și copertă. Cât încă îl convertește, `/file/video/ad/info/`
 * răspunde cu eroarea 40901 sau cu câmpurile goale.
 */
function isReady(video: RawVideo): boolean {
  return video.displayable !== false && typeof video.duration === "number" && Boolean(video.video_cover_url);
}

/**
 * Un video după id. `null` = nu există în contul ăsta. `transcoding` = TikTok
 * încă îl convertește (eroarea 40901).
 */
export async function readVideoRaw(
  workspace: AdsWorkspace,
  advertiserId: string,
  videoId: string
): Promise<RawVideo | null | "transcoding"> {
  try {
    const data = await tiktokGet<{ list?: RawVideo[] }>(workspace, "/file/video/ad/info/", {
      advertiser_id: advertiserId,
      video_ids: [videoId],
    });
    return (data.list ?? []).find((video) => video.video_id === videoId) ?? null;
  } catch (error) {
    if (error instanceof TikTokApiError && error.info.code === TIKTOK_VIDEO_TRANSCODING) return "transcoding";
    throw error;
  }
}

export async function readVideo(workspace: AdsWorkspace, advertiserId: string, videoId: string): Promise<VideoInfo | null> {
  const video = await readVideoRaw(workspace, advertiserId, videoId);
  if (video === null) return null;
  if (video === "transcoding") {
    return { id: videoId, title: null, lengthSeconds: null, thumbnailUrl: null, ready: false };
  }
  return {
    id: videoId,
    title: video.file_name?.trim() || null,
    lengthSeconds: typeof video.duration === "number" ? video.duration : null,
    thumbnailUrl: video.video_cover_url ?? null,
    ready: isReady(video),
  };
}

const LIBRARY_LIMIT = 60;

/** `2026-09-20 10:00:00` (UTC, forma TikTok) → ISO. */
function isoOf(time: string | undefined): string | null {
  if (!time) return null;
  const parsed = Date.parse(`${time.replace(" ", "T")}Z`);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

/** Biblioteca video a contului, cele mai noi primele. */
export async function listLibrary(
  workspace: AdsWorkspace,
  advertiserId: string
): Promise<{ videos: LibraryVideo[]; truncated: boolean }> {
  const raw = await tiktokGetAll<RawVideo>(
    workspace,
    "/file/video/ad/search/",
    { advertiser_id: advertiserId },
    "list",
    500,
    100
  );
  const videos = raw
    .filter((video): video is RawVideo & { video_id: string } => Boolean(video.video_id))
    .map((video) => ({
      id: video.video_id,
      title: video.file_name?.trim() || null,
      lengthSeconds: typeof video.duration === "number" ? video.duration : null,
      createdAt: isoOf(video.create_time),
      thumbnailUrl: video.video_cover_url ?? null,
      ready: isReady(video),
    }))
    .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
  return { videos: videos.slice(0, LIBRARY_LIMIT), truncated: videos.length > LIBRARY_LIMIT };
}
