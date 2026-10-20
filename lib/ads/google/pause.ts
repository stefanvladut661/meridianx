import "server-only";

import type { AdsWorkspace } from "../workspaces";
import type { Level } from "../model/types";
import { googlePause, googleSearch } from "./api";
import { findGoogleAccount } from "./lookup";
import { GoogleAccountHiddenError } from "./video";

/**
 * „Pune pe pauză” din ecranul v2, pe Google: campanii, grupuri sau reclame.
 *
 * Starea se citește din nou chiar înainte (nu din sincronizarea de azi-dimineață):
 * se trimite doar ce e ACUM `ENABLED`; ce e deja oprit sau șters se sare, cu
 * motivul. O singură cerere, prin `googlePause` — singura actualizare a
 * portalului, cu garda ei (`status: PAUSED`, `updateMask: "status"`, nimic altceva).
 */

export interface PauseItem {
  level: Level;
  platformId: string;
}

export interface PlatformPauseOutcome {
  paused: Array<PauseItem & { name: string }>;
  skipped: Array<PauseItem & { name: string; why: string }>;
}

interface StateRow {
  campaign?: { id?: string; name?: string; status?: string };
  adGroup?: { id?: string; name?: string; status?: string };
  adGroupAd?: { status?: string; ad?: { id?: string; name?: string } };
}

const numeric = (list: string[]) => list.filter((id) => /^\d+$/.test(id));

export async function pauseOnGoogle(workspace: AdsWorkspace, customerId: string, items: PauseItem[]): Promise<PlatformPauseOutcome> {
  const account = await findGoogleAccount(workspace, customerId);
  if (!account) throw new GoogleAccountHiddenError(customerId);
  const options = { loginCustomerId: account.loginCustomerId };
  const states = new Map<string, { name: string; status: string }>();

  const campaigns = numeric(items.filter((item) => item.level === "campaign").map((item) => item.platformId));
  if (campaigns.length) {
    const rows = await googleSearch<StateRow>(workspace, account.info.id, `SELECT campaign.id, campaign.name, campaign.status FROM campaign WHERE campaign.id IN (${campaigns.join(", ")})`, options);
    for (const row of rows) if (row.campaign?.id) states.set(`campaign|${row.campaign.id}`, { name: row.campaign.name ?? row.campaign.id, status: row.campaign.status ?? "" });
  }
  const groups = numeric(items.filter((item) => item.level === "group").map((item) => item.platformId));
  if (groups.length) {
    const rows = await googleSearch<StateRow>(workspace, account.info.id, `SELECT ad_group.id, ad_group.name, ad_group.status FROM ad_group WHERE ad_group.id IN (${groups.join(", ")})`, options);
    for (const row of rows) if (row.adGroup?.id) states.set(`group|${row.adGroup.id}`, { name: row.adGroup.name ?? row.adGroup.id, status: row.adGroup.status ?? "" });
  }
  const ads = items.filter((item) => item.level === "ad" && /^\d+~\d+$/.test(item.platformId));
  if (ads.length) {
    const rows = await googleSearch<StateRow>(
      workspace,
      account.info.id,
      `SELECT ad_group.id, ad_group_ad.ad.id, ad_group_ad.ad.name, ad_group_ad.status FROM ad_group_ad WHERE ad_group_ad.ad.id IN (${ads.map((item) => item.platformId.split("~")[1]).join(", ")})`,
      options
    );
    for (const row of rows) {
      const id = row.adGroup?.id && row.adGroupAd?.ad?.id ? `${row.adGroup.id}~${row.adGroupAd.ad.id}` : null;
      if (id) states.set(`ad|${id}`, { name: row.adGroupAd?.ad?.name || `Reclama ${row.adGroupAd?.ad?.id}`, status: row.adGroupAd?.status ?? "" });
    }
  }

  const outcome: PlatformPauseOutcome = { paused: [], skipped: [] };
  for (const item of items) {
    const state = states.get(`${item.level}|${item.platformId}`);
    if (!state) outcome.skipped.push({ ...item, name: item.platformId, why: "nu mai e în cont" });
    else if (state.status === "PAUSED") outcome.skipped.push({ ...item, name: state.name, why: "era deja pe pauză" });
    else if (state.status !== "ENABLED") outcome.skipped.push({ ...item, name: state.name, why: `are starea ${state.status}` });
    else outcome.paused.push({ ...item, name: state.name });
  }

  const resource: Record<Level, string> = { campaign: "campaigns", group: "adGroups", ad: "adGroupAds" };
  if (outcome.paused.length > 0) {
    await googlePause(
      workspace,
      account.info.id,
      outcome.paused.map((item) => `customers/${account.info.id}/${resource[item.level]}/${item.platformId}`),
      { validateOnly: false, loginCustomerId: account.loginCustomerId }
    );
  }
  return outcome;
}
