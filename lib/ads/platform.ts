import "server-only";

import type { ConversionEvent, Objective, Platform } from "./constants";
import type { Plan } from "./plan-schema";
import type { AdAccountInfo, CreateResponse, LibraryVideo, PlatformCheck, UploadStatus } from "./types";
import type { AdsWorkspace } from "./workspaces";
import { checkOnMeta } from "./meta/check";
import { createPausedOnMeta } from "./meta/create";
import { describeMetaError } from "./meta/errors";
import { fetchCampaignInsights, fetchCampaignStatuses } from "./meta/insights";
import { listAdAccounts, listLibrary } from "./meta/lookup";
import { readVideoUploadStatus, sendVideoToMeta } from "./meta/video";
import { tiktokAdapter } from "./tiktok/adapter";

/**
 * Ce știe să facă fiecare platformă, sub același contract — acțiunile
 * portalului și sincronizarea aleg adaptorul după spațiul de lucru și nu
 * mai știu nimic despre Meta sau TikTok.
 *
 * Regula care nu se negociază rămâne în fiecare adaptor, la singura lui
 * cale de scriere: Meta creează cu `status: PAUSED`, TikTok cu
 * `operation_status: DISABLE`, amândouă verificate înainte de rețea.
 */

/** Ce a găsit platforma + crearea legată exact de verificarea asta. */
export interface PreparedCreation {
  check: PlatformCheck;
  create: (user: { id: string; email: string | null }) => Promise<CreateResponse>;
}

/** O zi de cifre pentru o campanie, cum o întoarce platforma. */
export interface DailyRow {
  platformId: string;
  date: string;
  spend: number;
  impressions: number;
  clicks: number;
  results: number;
  raw: unknown;
}

export interface SyncCampaign {
  platformId: string;
  objective: Objective;
  event: ConversionEvent | null;
}

export interface PlatformAdapter {
  platform: Platform;
  /** Forma canonică a contului din plan, sau null dacă nu e de forma platformei. */
  normalizeAccount(input: string): string | null;
  /** Contul, cum îl vede tokenul spațiului; `null` = tokenul nu-l vede. */
  findAccount(workspace: AdsWorkspace, adAccount: string): Promise<AdAccountInfo | null>;
  prepare(workspace: AdsWorkspace, plan: Plan): Promise<PreparedCreation>;
  listLibrary(workspace: AdsWorkspace, adAccount: string): Promise<{ videos: LibraryVideo[]; truncated: boolean }>;
  sendVideo(
    workspace: AdsWorkspace,
    adAccount: string,
    input: { fileUrl: string; title: string }
  ): Promise<{ videoId: string }>;
  videoStatus(workspace: AdsWorkspace, adAccount: string, videoId: string): Promise<UploadStatus>;
  fetchDaily(
    workspace: AdsWorkspace,
    adAccount: string,
    input: { campaigns: SyncCampaign[]; since: string; until: string }
  ): Promise<DailyRow[]>;
  fetchStatuses(workspace: AdsWorkspace, adAccount: string, platformIds: string[]): Promise<Map<string, string>>;
  describeError(error: unknown, what: string, tokenEnv: string): string;
}

const metaAdapter: PlatformAdapter = {
  platform: "meta",
  normalizeAccount(input) {
    const trimmed = input.trim();
    const account = /^\d+$/.test(trimmed) ? `act_${trimmed}` : trimmed;
    return /^act_\d{5,25}$/.test(account) ? account : null;
  },
  async findAccount(workspace, adAccount) {
    return (await listAdAccounts(workspace)).find((account) => account.id === adAccount) ?? null;
  },
  async prepare(workspace, plan) {
    const context = await checkOnMeta(workspace, plan);
    return { check: context.check, create: (user) => createPausedOnMeta({ workspace, context, user }) };
  },
  listLibrary,
  sendVideo: sendVideoToMeta,
  videoStatus: (workspace, _adAccount, videoId) => readVideoUploadStatus(workspace, videoId),
  fetchDaily: fetchCampaignInsights,
  fetchStatuses: fetchCampaignStatuses,
  describeError: describeMetaError,
};

export function adapterFor(platform: Platform): PlatformAdapter {
  return platform === "tiktok" ? tiktokAdapter : metaAdapter;
}
