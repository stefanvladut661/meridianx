import "server-only";

import type { AdsWorkspace } from "../workspaces";
import { MetaApiError, metaGet, metaGetAll } from "./graph";
import type { LibraryVideo, AdAccountInfo, VideoInfo } from "../types";

/**
 * Citirile de pe Meta: conturile tokenului, obiectele din plan (pagină,
 * Instagram, pixel, video), biblioteca video. Doar GET, prin `graph.ts`.
 */

// ---------------------------------------------------------------------------
// Conturile de reclame ale tokenului
// ---------------------------------------------------------------------------

interface RawAdAccount {
  id: string;
  name?: string;
  currency?: string;
  account_status?: number;
}

/**
 * `account_status` din Marketing API, spus în română. Numeric intenționat:
 * portalul nu scrie și nu compară niciun status de livrare ca text.
 */
const ACCOUNT_STATE: Record<number, { label: string; usable: boolean }> = {
  1: { label: "activ", usable: true },
  2: { label: "dezactivat", usable: false },
  3: { label: "cu plăți restante", usable: false },
  7: { label: "în verificare de risc", usable: false },
  8: { label: "în așteptarea decontării", usable: false },
  9: { label: "în perioada de grație la plată", usable: true },
  100: { label: "în curs de închidere", usable: false },
  101: { label: "închis", usable: false },
};

/**
 * Conturile pe care le vede tokenul spațiului. Un System User vede exact
 * conturile atribuite lui în Business Settings — izolarea între portofolii
 * o garantează platforma, nu lista noastră.
 */
export async function listAdAccounts(workspace: AdsWorkspace): Promise<AdAccountInfo[]> {
  const raw = await metaGetAll<RawAdAccount>(
    workspace,
    "/me/adaccounts",
    { fields: "id,name,currency,account_status", limit: 100 },
    500
  );
  return raw.map((account) => {
    const state = ACCOUNT_STATE[account.account_status ?? -1] ?? {
      label: `stare necunoscută (${account.account_status ?? "—"})`,
      usable: false,
    };
    return {
      id: account.id,
      name: account.name ?? account.id,
      currency: account.currency ?? "—",
      state: state.label,
      usable: state.usable,
    };
  });
}

// ---------------------------------------------------------------------------
// DSA: beneficiarul și plătitorul implicite ale contului
// ---------------------------------------------------------------------------

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** Ce e setat în Ads Manager → contul → „Beneficiary and payer”. */
export async function readAccountDsa(
  workspace: AdsWorkspace,
  adAccount: string
): Promise<{ beneficiary: string | null; payor: string | null }> {
  const account = await metaGet<Record<string, unknown>>(workspace, `/${adAccount}`, {
    fields: "default_dsa_beneficiary,default_dsa_payor",
  });
  return { beneficiary: text(account.default_dsa_beneficiary), payor: text(account.default_dsa_payor) };
}

/**
 * Sugestiile Meta pentru beneficiar/plătitor (din reclamele trecute ale
 * contului). Doar pentru mesaj — portalul nu completează singur un câmp
 * legal. Forma răspunsului nu e documentată strict, deci citim tolerant.
 */
export async function readDsaSuggestions(workspace: AdsWorkspace, adAccount: string): Promise<string[]> {
  try {
    const response = await metaGet<{ data?: unknown[] }>(workspace, `/${adAccount}/dsa_recommendations`);
    const found = new Set<string>();
    for (const item of response.data ?? []) {
      if (typeof item === "string" && item.trim()) found.add(item.trim());
      const nested = item && typeof item === "object" ? (item as { recommendations?: unknown }).recommendations : null;
      if (Array.isArray(nested)) nested.forEach((value) => typeof value === "string" && value.trim() && found.add(value.trim()));
    }
    return [...found].slice(0, 5);
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Obiectele din plan
// ---------------------------------------------------------------------------

/**
 * Citește un obiect după id; `null` dacă tokenul nu-l vede (id greșit sau
 * activ neatribuit System User-ului). Alte erori (token, limită) urcă.
 */
async function readVisible<T>(workspace: AdsWorkspace, id: string, fields: string): Promise<T | null> {
  try {
    return await metaGet<T>(workspace, `/${id}`, { fields });
  } catch (error) {
    if (error instanceof MetaApiError && (error.info.code === 100 || error.info.code === 803 || error.info.code === 10)) {
      return null;
    }
    throw error;
  }
}

export async function readPage(workspace: AdsWorkspace, pageId: string) {
  const page = await readVisible<{ id: string; name?: string }>(workspace, pageId, "id,name");
  return page ? { id: page.id, name: page.name ?? page.id } : null;
}

export async function readInstagram(workspace: AdsWorkspace, accountId: string) {
  const account = await readVisible<{ id: string; username?: string }>(workspace, accountId, "id,username");
  return account ? { id: account.id, username: account.username ?? account.id } : null;
}

export async function readPixel(workspace: AdsWorkspace, pixelId: string) {
  const pixel = await readVisible<{ id: string; name?: string }>(workspace, pixelId, "id,name");
  return pixel ? { id: pixel.id, name: pixel.name ?? pixel.id } : null;
}

// ---------------------------------------------------------------------------
// Video
// ---------------------------------------------------------------------------

interface RawVideo {
  id: string;
  title?: string;
  length?: number;
  created_time?: string;
  picture?: string;
  status?: { video_status?: string };
  thumbnails?: { data?: Array<{ uri?: string; is_preferred?: boolean }> };
}

function preferredThumbnail(video: RawVideo): string | null {
  const thumbnails = video.thumbnails?.data ?? [];
  return (
    thumbnails.find((thumbnail) => thumbnail.is_preferred && thumbnail.uri)?.uri ??
    thumbnails.find((thumbnail) => thumbnail.uri)?.uri ??
    video.picture ??
    null
  );
}

function isReady(video: RawVideo): boolean {
  // Fără câmpul de status (video vechi), Meta îl tratează ca procesat.
  const status = video.status?.video_status;
  return status === undefined || status === "ready";
}

export async function readVideo(workspace: AdsWorkspace, videoId: string): Promise<VideoInfo | null> {
  const video = await readVisible<RawVideo>(
    workspace,
    videoId,
    "id,title,length,picture,status,thumbnails{uri,is_preferred}"
  );
  if (!video) return null;
  return {
    id: video.id,
    title: video.title?.trim() || null,
    lengthSeconds: typeof video.length === "number" ? video.length : null,
    thumbnailUrl: preferredThumbnail(video),
    ready: isReady(video),
  };
}

const LIBRARY_LIMIT = 60;

/** Biblioteca video a contului, cele mai noi primele. */
export async function listLibrary(
  workspace: AdsWorkspace,
  adAccount: string
): Promise<{ videos: LibraryVideo[]; truncated: boolean }> {
  const raw = await metaGetAll<RawVideo>(
    workspace,
    `/${adAccount}/advideos`,
    { fields: "id,title,length,created_time,picture,status", limit: 50 },
    LIBRARY_LIMIT + 1
  );
  const videos = raw
    .map((video) => ({
      id: video.id,
      title: video.title?.trim() || null,
      lengthSeconds: typeof video.length === "number" ? video.length : null,
      createdAt: video.created_time ?? null,
      thumbnailUrl: video.picture ?? null,
      ready: isReady(video),
    }))
    .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
  return { videos: videos.slice(0, LIBRARY_LIMIT), truncated: videos.length > LIBRARY_LIMIT };
}
