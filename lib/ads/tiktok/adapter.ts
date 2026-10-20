import "server-only";

import type { PlatformAdapter } from "../platform";
import { checkOnTikTok } from "./check";
import { createPausedOnTikTok } from "./create";
import { describeTikTokError } from "./errors";
import { fetchTikTokDaily, fetchTikTokStatuses } from "./insights";
import { listLibrary, readAdvertiser } from "./lookup";
import { readTikTokUploadStatus, sendVideoToTikTok } from "./video";

/** TikTok sub contractul comun al platformelor (`lib/ads/platform.ts`). */
export const tiktokAdapter: PlatformAdapter = {
  platform: "tiktok",
  normalizeAccount(input) {
    const trimmed = input.trim();
    return /^\d{5,25}$/.test(trimmed) ? trimmed : null;
  },
  findAccount: readAdvertiser,
  async prepare(workspace, plan) {
    const context = await checkOnTikTok(workspace, plan);
    return { check: context.check, create: (user) => createPausedOnTikTok({ workspace, context, user }) };
  },
  listLibrary,
  sendVideo: sendVideoToTikTok,
  videoStatus: readTikTokUploadStatus,
  fetchDaily: fetchTikTokDaily,
  fetchStatuses: fetchTikTokStatuses,
  describeError: describeTikTokError,
};
