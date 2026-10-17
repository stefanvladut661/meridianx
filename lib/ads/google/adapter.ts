import "server-only";

import type { PlatformAdapter } from "../platform";
import { checkOnGoogle } from "./check";
import { createPausedOnGoogle } from "./create";
import { describeGoogleError } from "./errors";
import { fetchGoogleDaily, fetchGoogleStatuses } from "./insights";
import { findGoogleAccount, listGoogleLibrary } from "./lookup";
import { GoogleAccountHiddenError, readGoogleUploadStatus, sendVideoToGoogle } from "./video";

/** Google Ads sub contractul comun al platformelor (`lib/ads/platform.ts`). */
export const googleAdapter: PlatformAdapter = {
  platform: "google",
  normalizeAccount(input) {
    const digits = input.trim().replace(/[\s-]/g, "");
    return /^\d{10}$/.test(digits) ? digits : null;
  },
  async findAccount(workspace, adAccount) {
    return (await findGoogleAccount(workspace, adAccount))?.info ?? null;
  },
  async prepare(workspace, plan) {
    const context = await checkOnGoogle(workspace, plan);
    return { check: context.check, create: (user) => createPausedOnGoogle({ workspace, context, user }) };
  },
  async listLibrary(workspace, adAccount) {
    const account = await findGoogleAccount(workspace, adAccount);
    if (!account) throw new GoogleAccountHiddenError(adAccount);
    return listGoogleLibrary(workspace, account);
  },
  sendVideo: sendVideoToGoogle,
  videoStatus: readGoogleUploadStatus,
  fetchDaily: fetchGoogleDaily,
  fetchStatuses: fetchGoogleStatuses,
  describeError(error, what, tokenEnv) {
    if (error instanceof GoogleAccountHiddenError) {
      return `${error.message} Adaugă contul de serviciu ca utilizator în contul Google Ads (Admin → Acces și securitate) și verifică id-ul din plan.`;
    }
    return describeGoogleError(error, what, tokenEnv);
  },
};
