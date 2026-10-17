import "server-only";

import { adSetName } from "../plan-derive";
import type { Plan } from "../plan-schema";
import { recordCampaign } from "../store";
import type { CreateResponse, CreatedObject } from "../types";
import type { AdsWorkspace } from "../workspaces";
import { campaignUrl } from "../links";
import { googleMutate, idOf } from "./api";
import type { GoogleCheckContext } from "./check";
import { describeGoogleError } from "./errors";

/**
 * Crearea pe Google: O SINGURĂ cerere `googleAds:mutate`, atomică — bugetul,
 * campania Demand Gen, grupul, criteriile, materialele și reclamele se
 * creează împreună sau deloc. Campania, grupul și reclamele pleacă `PAUSED`.
 *
 * Spre deosebire de Meta și TikTok, nu există „creată pe jumătate": dacă
 * Google refuză ceva, contul rămâne exact cum era.
 */

export interface GoogleCreateInput {
  workspace: AdsWorkspace;
  context: GoogleCheckContext;
  user: { id: string; email: string | null };
}

export async function createPausedOnGoogle(input: GoogleCreateInput): Promise<CreateResponse> {
  const { workspace, context, user } = input;
  const { account, operations, targeting } = context;
  if (!account || !operations || !targeting || !context.check.ok) {
    return { ok: false, message: "Verificarea pe Google nu e completă. Verifică din nou planul.", recheck: true };
  }
  const plan: Plan = targeting.plan;

  let resourceNames: Array<string | null>;
  try {
    ({ resourceNames } = await googleMutate(workspace, account.info.id, operations.operations, {
      validateOnly: false,
      loginCustomerId: account.loginCustomerId,
    }));
  } catch (error) {
    return { ok: false, message: describeGoogleError(error, "crearea campaniei", workspace.tokenEnv) };
  }

  const nameAt = (kind: string) => resourceNames[operations.roles.findIndex((role) => role.kind === kind)] ?? null;
  const campaignId = idOf(nameAt("campaign"));
  const adGroupId = idOf(nameAt("adgroup"));
  if (!campaignId) {
    return {
      ok: false,
      message: "Google a răspuns fără id de campanie. Caută campania în Google Ads (după nume) înainte să încerci din nou.",
    };
  }
  // `customers/1/adGroupAds/{grup}~{reclamă}` → id-ul reclamei.
  const adIds = operations.roles
    .map((role, index) => (role.kind === "ad" ? resourceNames[index] : null))
    .filter((name): name is string => Boolean(name))
    .map((name) => name.split("~").pop() ?? name);

  const created: CreatedObject[] = [
    { kind: "campaign", id: campaignId, name: plan.campaign.name },
    ...(adGroupId ? [{ kind: "adset" as const, id: adGroupId, name: adSetName(plan.campaign.name) }] : []),
    ...adIds.map((id, index) => ({ kind: "ad" as const, id, name: operations.adNames[index] ?? `Reclama ${index + 1}` })),
  ];
  const adsManagerUrl = campaignUrl("google", account.info.id, campaignId);

  const stored = await recordCampaign({
    workspace: workspace.id,
    platform: "google",
    adAccount: account.info.id,
    platformCampaignId: campaignId,
    plan,
    fingerprint: context.check.fingerprint,
    creation: "complete",
    creationError: null,
    platformObjects: { ...(adGroupId ? { adset: adGroupId } : {}), ads: adIds },
    createdBy: user,
  });

  return {
    ok: true,
    recordId: stored.ok ? stored.data.id : null,
    adsManagerUrl,
    created,
    storeWarning: stored.ok
      ? null
      : "Campania e creată în Google Ads, dar n-a putut fi notată în baza portalului, deci nu va apărea în lista de campanii. Păstrează linkul de mai sus.",
  };
}
