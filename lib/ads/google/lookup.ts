import "server-only";

import type { AdAccountInfo, LibraryVideo, VideoInfo } from "../types";
import type { AdsWorkspace } from "../workspaces";
import { GoogleAdsApiError, customerDigits, googleGet, googleSearch, idOf } from "./api";

/**
 * Citirile de pe Google Ads: conturile cheii, contul din plan (și prin ce
 * cont manager se vede), acțiunile de conversie, video-urile YouTube. Doar
 * citiri, prin `api.ts`.
 */

// ---------------------------------------------------------------------------
// Contul și calea până la el
// ---------------------------------------------------------------------------

interface RawCustomer {
  customer?: {
    id?: string;
    descriptiveName?: string;
    currencyCode?: string;
    timeZone?: string;
    status?: string;
    manager?: boolean;
    testAccount?: boolean;
  };
}

const CUSTOMER_STATE: Record<string, { label: string; usable: boolean }> = {
  ENABLED: { label: "activ", usable: true },
  CANCELED: { label: "anulat", usable: false },
  SUSPENDED: { label: "suspendat de Google", usable: false },
  CLOSED: { label: "închis", usable: false },
};

export interface GoogleAccount {
  info: AdAccountInfo;
  timeZone: string;
  manager: boolean;
  /** Contul manager prin care cheia vede contul, sau null dacă îl vede direct. */
  loginCustomerId: string | null;
}

async function readCustomer(workspace: AdsWorkspace, customerId: string, loginCustomerId: string | null): Promise<GoogleAccount | null> {
  const rows = await googleSearch<RawCustomer>(
    workspace,
    customerId,
    "SELECT customer.id, customer.descriptive_name, customer.currency_code, customer.time_zone, customer.status, customer.manager, customer.test_account FROM customer",
    { loginCustomerId }
  );
  const customer = rows[0]?.customer;
  if (!customer) return null;
  const state = CUSTOMER_STATE[customer.status ?? ""] ?? { label: `stare necunoscută (${customer.status ?? "—"})`, usable: false };
  const manager = customer.manager === true;
  return {
    info: {
      id: customerId,
      name: customer.descriptiveName?.trim() || customerId,
      currency: customer.currencyCode ?? "—",
      state: manager ? "cont manager (MCC)" : customer.testAccount ? `${state.label}, cont de test` : state.label,
      usable: state.usable && !manager,
    },
    timeZone: customer.timeZone ?? "Europe/Bucharest",
    manager,
    loginCustomerId,
  };
}

/** Conturile pe care cheia le vede direct (fără manager). */
export async function listAccessibleCustomers(workspace: AdsWorkspace): Promise<string[]> {
  const data = await googleGet<{ resourceNames?: string[] }>(workspace, "/customers:listAccessibleCustomers");
  return (data.resourceNames ?? []).map((name) => idOf(name)).filter((id): id is string => id !== null);
}

/** Calea până la cont, ținută câteva minute: verificarea și crearea o cer de mai multe ori. */
const accessCache = new Map<string, { at: number; account: GoogleAccount | null }>();
const ACCESS_TTL_MS = 5 * 60 * 1000;

/**
 * Contul din plan, cum îl vede cheia spațiului — direct sau prin contul
 * manager (MCC) în care e adăugat contul de serviciu. `null` = nu-l vede.
 */
export async function findGoogleAccount(workspace: AdsWorkspace, customerIdInput: string): Promise<GoogleAccount | null> {
  const customerId = customerDigits(customerIdInput);
  const key = `${workspace.id}:${customerId}`;
  const cached = accessCache.get(key);
  if (cached && Date.now() - cached.at < ACCESS_TTL_MS) return cached.account;

  const accessible = await listAccessibleCustomers(workspace);
  let account: GoogleAccount | null = null;
  if (accessible.includes(customerId)) {
    account = await readCustomer(workspace, customerId, null);
  } else {
    // Prin managerii pe care îi vede cheia: contul trebuie să fie printre clienții lor.
    for (const candidate of accessible.slice(0, 10)) {
      try {
        const rows = await googleSearch<{ customerClient?: { id?: string } }>(
          workspace,
          candidate,
          `SELECT customer_client.id FROM customer_client WHERE customer_client.id = ${customerId}`,
          { loginCustomerId: candidate }
        );
        if (rows.some((row) => row.customerClient?.id === customerId)) {
          account = await readCustomer(workspace, customerId, candidate);
          break;
        }
      } catch (error) {
        // Un cont care nu e manager nu are `customer_client` utilizabil — trecem la următorul.
        if (!(error instanceof GoogleAdsApiError)) throw error;
      }
    }
  }
  accessCache.set(key, { at: Date.now(), account });
  return account;
}

/** Conturile pe care le vede cheia — pentru contextul dat conversației. */
export async function listGoogleAccounts(workspace: AdsWorkspace): Promise<GoogleAccount[]> {
  const accessible = await listAccessibleCustomers(workspace);
  const accounts: GoogleAccount[] = [];
  for (const id of accessible.slice(0, 10)) {
    const account = await readCustomer(workspace, id, null).catch(() => null);
    if (!account) continue;
    if (!account.manager) {
      accounts.push(account);
      continue;
    }
    const rows = await googleSearch<{ customerClient?: { id?: string; manager?: boolean; level?: string } }>(
      workspace,
      id,
      "SELECT customer_client.id, customer_client.manager, customer_client.level FROM customer_client WHERE customer_client.level = 1",
      { loginCustomerId: id }
    ).catch(() => []);
    for (const row of rows.slice(0, 20)) {
      const clientId = row.customerClient?.id;
      if (!clientId || row.customerClient?.manager) continue;
      const client = await readCustomer(workspace, clientId, id).catch(() => null);
      if (client) accounts.push(client);
    }
  }
  return accounts;
}

// ---------------------------------------------------------------------------
// Acțiunile de conversie
// ---------------------------------------------------------------------------

interface RawConversionAction {
  conversionAction?: {
    id?: string;
    name?: string;
    status?: string;
    category?: string;
    type?: string;
    origin?: string;
    primaryForGoal?: boolean;
    tagSnippets?: Array<{ eventSnippet?: string }>;
  };
}

export interface GoogleConversionAction {
  id: string;
  name: string;
  category: string;
  type: string;
  /** WEBSITE = conversii de pe site (tag-ul Google). */
  origin: string;
  /** Intră în obiectivele contului — campaniile optimizează pe ea. */
  primary: boolean;
  /** `AW-123/AbC` din fragmentul de eveniment, pentru tag-urile pe site. */
  sendTo: string | null;
}

export async function listConversionActions(workspace: AdsWorkspace, account: GoogleAccount): Promise<GoogleConversionAction[]> {
  const rows = await googleSearch<RawConversionAction>(
    workspace,
    account.info.id,
    "SELECT conversion_action.id, conversion_action.name, conversion_action.status, conversion_action.category, conversion_action.type, conversion_action.origin, conversion_action.primary_for_goal, conversion_action.tag_snippets FROM conversion_action WHERE conversion_action.status = 'ENABLED'",
    { loginCustomerId: account.loginCustomerId }
  );
  return rows
    .map((row) => row.conversionAction)
    .filter((action): action is NonNullable<RawConversionAction["conversionAction"]> & { id: string } => Boolean(action?.id))
    .map((action) => {
      const snippet = action.tagSnippets?.map((item) => item.eventSnippet ?? "").join("\n") ?? "";
      const sendTo = /send_to['"]?\s*:\s*['"](AW-\d+\/[A-Za-z0-9_-]+)['"]/.exec(snippet)?.[1] ?? null;
      return {
        id: action.id,
        name: action.name?.trim() || action.id,
        category: action.category ?? "—",
        type: action.type ?? "—",
        origin: action.origin ?? "—",
        primary: action.primaryForGoal !== false,
        sendTo,
      };
    });
}

// ---------------------------------------------------------------------------
// Video-urile YouTube
// ---------------------------------------------------------------------------

function localBase(): string | null {
  const override = process.env.GOOGLE_ADS_API_URL?.trim();
  return override && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(override) ? override : null;
}

/** Coperta standard a unui video YouTube (480×360, există pentru orice video public sau nelistat). */
export function youtubeThumbnail(videoId: string): string {
  const local = localBase();
  return local ? `${local}/yt/${videoId}.png` : `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

export const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

/**
 * Un video YouTube, verificat fără cheie, prin oEmbed: 200 = public sau
 * nelistat (merge în reclame), 403 = privat (nu merge), 404 = șters, 400 =
 * nu există. Comportament observat, nu documentat de Google — de aceea
 * verificarea pe Google (`validateOnly`) rămâne cea care decide.
 */
export async function readYouTubeVideo(videoId: string): Promise<VideoInfo | "private" | null> {
  const local = localBase();
  const url = local
    ? `${local}/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}`
    : `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}&format=json`;
  let response: Response;
  try {
    response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(10_000) });
  } catch {
    // YouTube n-a răspuns: nu blocăm verificarea pentru asta — decide `validateOnly`.
    return { id: videoId, title: null, lengthSeconds: null, thumbnailUrl: youtubeThumbnail(videoId), ready: true };
  }
  if (response.status === 401 || response.status === 403) return "private";
  if (!response.ok) return null;
  const json = (await response.json().catch(() => null)) as { title?: string } | null;
  return { id: videoId, title: json?.title?.trim() || null, lengthSeconds: null, thumbnailUrl: youtubeThumbnail(videoId), ready: true };
}

interface RawVideoAsset {
  asset?: { id?: string; name?: string; youtubeVideoAsset?: { youtubeVideoId?: string; youtubeVideoTitle?: string } };
}

interface RawUpload {
  youTubeVideoUpload?: { resourceName?: string; videoId?: string; state?: string; videoTitle?: string };
}

const LIBRARY_LIMIT = 60;

/**
 * „Biblioteca" pe Google: video-urile YouTube deja folosite ca materiale în
 * cont, plus cele urcate din portal (sau din Google Ads) și procesate.
 */
export async function listGoogleLibrary(
  workspace: AdsWorkspace,
  account: GoogleAccount
): Promise<{ videos: LibraryVideo[]; truncated: boolean }> {
  const options = { loginCustomerId: account.loginCustomerId };
  const [assets, uploads] = await Promise.all([
    googleSearch<RawVideoAsset>(
      workspace,
      account.info.id,
      "SELECT asset.id, asset.name, asset.youtube_video_asset.youtube_video_id, asset.youtube_video_asset.youtube_video_title FROM asset WHERE asset.type = 'YOUTUBE_VIDEO' ORDER BY asset.id DESC LIMIT 200",
      options
    ),
    googleSearch<RawUpload>(
      workspace,
      account.info.id,
      "SELECT you_tube_video_upload.resource_name, you_tube_video_upload.video_id, you_tube_video_upload.state, you_tube_video_upload.video_title FROM you_tube_video_upload",
      options
    ).catch(() => [] as RawUpload[]),
  ]);

  const seen = new Set<string>();
  const videos: LibraryVideo[] = [];
  for (const row of uploads) {
    const upload = row.youTubeVideoUpload;
    if (!upload?.videoId || seen.has(upload.videoId)) continue;
    seen.add(upload.videoId);
    videos.push({
      id: upload.videoId,
      title: upload.videoTitle?.trim() || null,
      lengthSeconds: null,
      createdAt: null,
      thumbnailUrl: youtubeThumbnail(upload.videoId),
      ready: upload.state === "PROCESSED",
    });
  }
  for (const row of assets) {
    const id = row.asset?.youtubeVideoAsset?.youtubeVideoId;
    if (!id || seen.has(id)) continue;
    seen.add(id);
    videos.push({
      id,
      title: row.asset?.youtubeVideoAsset?.youtubeVideoTitle?.trim() || row.asset?.name?.trim() || null,
      lengthSeconds: null,
      createdAt: null,
      thumbnailUrl: youtubeThumbnail(id),
      ready: true,
    });
  }
  return { videos: videos.slice(0, LIBRARY_LIMIT), truncated: videos.length > LIBRARY_LIMIT };
}
