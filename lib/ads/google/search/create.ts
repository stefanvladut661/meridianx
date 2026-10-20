import "server-only";

import { randomUUID } from "node:crypto";
import { campaignUrl } from "../../links";
import { recordSearchCampaigns, STORE_FAILURE_MESSAGE } from "../../store";
import type { AdsWorkspace } from "../../workspaces";
import { googleMutate, idOf } from "../api";
import { describeGoogleError } from "../errors";
import type { SearchCheckContext } from "./check";
import type { SearchPlan } from "./schema";
import type { CreatedSearchCampaign, SearchCreateResponse } from "./types";

/**
 * Crearea planului de căutare: O SINGURĂ cerere `googleAds:mutate`, atomică —
 * listele comune, bugetele, campaniile, criteriile, grupurile, cuvintele,
 * anunțurile și materialele se creează împreună sau deloc. Campaniile,
 * grupurile și anunțurile pleacă `PAUSED`. Nu există „creat pe jumătate”.
 *
 * În `ads_campaigns`: un rând pe campanie, cu planul ei (campania + listele pe
 * care le folosește), legate prin `plan_group_id`.
 */

export interface SearchCreateInput {
  workspace: AdsWorkspace;
  context: SearchCheckContext;
  user: { id: string; email: string | null };
}

/** Planul unei singure campanii: rădăcina, listele ei, campania. Pentru fișa din portal. */
function planOf(plan: SearchPlan, key: string): Record<string, unknown> {
  const campaign = plan.campaigns.find((item) => item.key === key);
  return {
    format: plan.format,
    workspace: plan.workspace,
    ad_account: plan.ad_account,
    currency: plan.currency,
    shared_negative_lists: plan.shared_negative_lists.filter((list) => campaign?.negative_lists.includes(list.key)),
    campaigns: campaign ? [campaign] : [],
  };
}

export async function createSearchOnGoogle(input: SearchCreateInput): Promise<SearchCreateResponse> {
  const { workspace, context, user } = input;
  const { account, operations, plan } = context;
  if (!account || !operations || !context.check.ok) {
    return { ok: false, message: "Verificarea pe Google nu e completă. Verifică din nou planul.", recheck: true };
  }

  let resourceNames: Array<string | null>;
  try {
    ({ resourceNames } = await googleMutate(workspace, account.info.id, operations.operations, {
      validateOnly: false,
      loginCustomerId: account.loginCustomerId,
    }));
  } catch (error) {
    return { ok: false, message: describeGoogleError(error, "crearea planului de căutare", workspace.tokenEnv) };
  }

  // Ce s-a creat, pe campanie: id-ul campaniei, al grupurilor, al anunțurilor.
  const byCampaign = new Map<string, { id: string | null; adGroups: string[]; ads: string[] }>();
  operations.roles.forEach((role, index) => {
    if (!role.campaignKey) return;
    const entry = byCampaign.get(role.campaignKey) ?? { id: null, adGroups: [], ads: [] };
    const name = resourceNames[index] ?? null;
    if (role.kind === "campaign") entry.id = idOf(name);
    if (role.kind === "ad_group" && idOf(name)) entry.adGroups.push(idOf(name) as string);
    // `customers/1/adGroupAds/{grup}~{anunț}` → id-ul anunțului.
    if (role.kind === "ad" && name) entry.ads.push(name.split("~").pop() ?? name);
    byCampaign.set(role.campaignKey, entry);
  });
  const missing = plan.campaigns.filter((campaign) => !byCampaign.get(campaign.key)?.id);
  if (missing.length > 0) {
    return {
      ok: false,
      message: `Google a răspuns fără id pentru ${missing.map((campaign) => `„${campaign.name}”`).join(", ")}. Caută campaniile în Google Ads (după nume) înainte să încerci din nou — crearea e atomică, deci ori există toate, ori niciuna.`,
    };
  }

  const groupId = randomUUID();
  const stored = await recordSearchCampaigns({
    workspace: workspace.id,
    adAccount: account.info.id,
    currency: plan.currency,
    fingerprint: context.check.fingerprint,
    groupId,
    createdBy: user,
    campaigns: plan.campaigns.map((campaign) => {
      const created = byCampaign.get(campaign.key);
      return {
        platformCampaignId: created?.id as string,
        name: campaign.name,
        dailyBudget: campaign.daily_budget,
        plan: planOf(plan, campaign.key),
        platformObjects: { adGroups: created?.adGroups ?? [], ads: created?.ads ?? [] },
      };
    }),
  });
  const recordIds = new Map(stored.ok ? stored.data.map((row) => [row.platformCampaignId, row.id]) : []);

  const campaigns: CreatedSearchCampaign[] = plan.campaigns.map((campaign) => {
    const id = byCampaign.get(campaign.key)?.id as string;
    return { key: campaign.key, name: campaign.name, id, recordId: recordIds.get(id) ?? null, url: campaignUrl("google", account.info.id, id) };
  });
  const count = (kind: string) => operations.roles.filter((role) => role.kind === kind).length;

  return {
    ok: true,
    groupId,
    campaigns,
    accountUrl: `https://ads.google.com/aw/campaigns?${new URLSearchParams({ __e: account.info.id })}`,
    counts: {
      adGroups: count("ad_group"),
      keywords: count("keyword"),
      ads: count("ad"),
      negatives: count("shared_criterion") + count("campaign_negative") + count("ad_group_negative"),
      assets: count("asset"),
      operations: operations.operations.length,
    },
    storeWarning: stored.ok
      ? null
      : `Campaniile sunt create în Google Ads, dar n-au putut fi notate în baza portalului (${STORE_FAILURE_MESSAGE[stored.reason]}), deci nu vor apărea în listă și în statistici. Păstrează linkurile de mai sus.`,
  };
}
