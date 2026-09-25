import "server-only";

import { adSetName } from "../plan-derive";
import type { Plan } from "../plan-schema";
import { recordCampaign, type PlatformObjects } from "../store";
import type { CreateResponse, CreatedObject } from "../types";
import type { AdsWorkspace } from "../workspaces";
import { campaignUrl } from "../links";
import { tiktokCreate, tiktokGet } from "./api";
import { buildAdGroup, buildAds, buildCampaign, tiktokStartTime } from "./build";
import type { TikTokCheckContext } from "./check";
import { describeTikTokError } from "./errors";

/**
 * Crearea pe TikTok: copertă → campanie → grup de reclame → reclame.
 * Totul cu `operation_status: DISABLE`.
 *
 * Aceeași ordine și aceeași regulă ca pe Meta: coperta (o imagine în
 * biblioteca contului, nu costă nimic) întâi; campania e primul obiect
 * „adevărat"; de la ea încolo, o eroare lasă în urmă obiecte OPRITE, pe
 * care le arătăm cu link și le notăm ca „parțial" — nu le ștergem automat.
 *
 * Reclamele pleacă într-o singură cerere (`creatives: [...]`): TikTok le
 * creează pe toate sau niciuna.
 */

export interface TikTokCreateInput {
  workspace: AdsWorkspace;
  context: TikTokCheckContext;
  user: { id: string; email: string | null };
}

function idOf(value: unknown): string | null {
  return typeof value === "string" || typeof value === "number" ? String(value) : null;
}

/** Coperta propusă de TikTok pentru video (linkul expiră într-o oră — se ia acum). */
async function suggestedCover(workspace: AdsWorkspace, advertiserId: string, videoId: string): Promise<string | null> {
  const data = await tiktokGet<{ list?: Array<{ url?: string }> }>(workspace, "/file/video/suggestcover/", {
    advertiser_id: advertiserId,
    video_id: videoId,
    poster_number: 1,
  });
  return data.list?.find((item) => item.url)?.url ?? null;
}

/** Imaginea copertei, în biblioteca contului — TikTok o descarcă singur de la URL. */
async function uploadCover(workspace: AdsWorkspace, advertiserId: string, imageUrl: string, videoId: string): Promise<string> {
  const data = await tiktokCreate<{ image_id?: string }>(workspace, "/file/image/ad/upload/", {
    advertiser_id: advertiserId,
    upload_type: "UPLOAD_BY_URL",
    image_url: imageUrl,
    // Numele trebuie să fie unic în cont.
    file_name: `coperta-${videoId}-${Date.now().toString(36)}`,
  });
  if (!data.image_id) throw new Error("TikTok n-a întors id-ul imaginii.");
  return data.image_id;
}

export async function createPausedOnTikTok(input: TikTokCreateInput): Promise<CreateResponse> {
  const { workspace, context, user } = input;
  const plan: Plan = context.targeting.plan;
  const { account, video } = context;
  if (!account || !video || !context.check.ok) {
    return { ok: false, message: "Verificarea pe TikTok nu e completă. Verifică din nou planul.", recheck: true };
  }
  const advertiserId = account.id;
  const created: CreatedObject[] = [];
  const objects: PlatformObjects = { ads: [] };

  // 0. Coperta: cea din plan sau cea propusă de TikTok.
  let coverImageId: string;
  try {
    const coverUrl =
      plan.creative.thumbnail !== "auto"
        ? plan.creative.thumbnail.url
        : (await suggestedCover(workspace, advertiserId, video.id)) ?? video.thumbnailUrl;
    if (!coverUrl) {
      return {
        ok: false,
        message: "TikTok n-a propus nicio copertă pentru video-ul ăsta. Pune o imagine în creative.thumbnail: { \"url\": \"https://…\" }, cu aceleași proporții ca video-ul.",
      };
    }
    coverImageId = await uploadCover(workspace, advertiserId, coverUrl, video.id);
  } catch (error) {
    return { ok: false, message: describeTikTokError(error, "pregătirea copertei video-ului", workspace.tokenEnv) };
  }
  created.push({ kind: "image", id: coverImageId, name: "Coperta video-ului" });

  // 1. Campania — dacă pică, nu există nicio campanie în TikTok.
  let campaignId: string | null;
  try {
    const data = await tiktokCreate<{ campaign_id?: unknown }>(workspace, "/campaign/create/", buildCampaign(plan, advertiserId));
    campaignId = idOf(data.campaign_id);
  } catch (error) {
    return { ok: false, message: describeTikTokError(error, "crearea campaniei", workspace.tokenEnv) };
  }
  if (!campaignId) {
    return { ok: false, message: "TikTok a răspuns fără id de campanie. Caută campania în TikTok Ads Manager înainte să încerci din nou." };
  }
  created.push({ kind: "campaign", id: campaignId, name: plan.campaign.name });
  const adsManagerUrl = campaignUrl("tiktok", advertiserId, campaignId);

  const save = (creation: "complete" | "partial", creationError: string | null) =>
    recordCampaign({
      workspace: workspace.id,
      platform: "tiktok",
      adAccount: advertiserId,
      platformCampaignId: campaignId,
      plan,
      fingerprint: context.check.fingerprint,
      creation,
      creationError,
      platformObjects: objects,
      createdBy: user,
    });

  const stop = async (message: string): Promise<CreateResponse> => {
    const stored = await save("partial", message);
    return {
      ok: false,
      message: stored.ok
        ? message
        : `${message} În plus, campania n-a putut fi notată în baza portalului — linkul de mai jos e singurul drum spre ea.`,
      partial: { adsManagerUrl, created, recordId: stored.ok ? stored.data.id : null },
    };
  };

  // 2. Grupul de reclame.
  let adGroupId: string | null;
  try {
    const payload = buildAdGroup(plan, advertiserId, {
      campaignId,
      locationIds: context.targeting.locationIds,
      languageCodes: context.targeting.languageCodes,
      interestIds: context.targeting.interestIds,
      pixelId: context.pixel?.id ?? null,
      startTime: tiktokStartTime(),
    });
    adGroupId = idOf((await tiktokCreate<{ adgroup_id?: unknown }>(workspace, "/adgroup/create/", payload)).adgroup_id);
  } catch (error) {
    return stop(describeTikTokError(error, "crearea grupului de reclame", workspace.tokenEnv));
  }
  if (!adGroupId) return stop("TikTok a răspuns fără id de grup de reclame.");
  objects.adset = adGroupId;
  created.push({ kind: "adset", id: adGroupId, name: adSetName(plan.campaign.name) });

  // 3. Reclamele, toate într-o cerere.
  const payload = buildAds(plan, advertiserId, {
    adGroupId,
    videoId: video.id,
    coverImageId,
    pixelId: context.pixel?.id ?? null,
  });
  let adIds: string[];
  try {
    const data = await tiktokCreate<{ ad_ids?: unknown[] }>(workspace, "/ad/create/", payload);
    adIds = (data.ad_ids ?? []).map(idOf).filter((id): id is string => id !== null);
  } catch (error) {
    return stop(describeTikTokError(error, "crearea reclamelor", workspace.tokenEnv));
  }
  const names = (payload.creatives as Array<{ ad_name: string }>).map((creative) => creative.ad_name);
  objects.ads = adIds;
  adIds.forEach((id, index) => created.push({ kind: "ad", id, name: names[index] ?? `Reclama ${index + 1}` }));
  if (adIds.length !== names.length) {
    return stop(`TikTok a creat ${adIds.length} reclame din ${names.length}. Verifică grupul în TikTok Ads Manager.`);
  }

  // 4. Notat în bază. Dacă pică, campania există totuși în TikTok — o spunem.
  const stored = await save("complete", null);
  return {
    ok: true,
    recordId: stored.ok ? stored.data.id : null,
    adsManagerUrl,
    created,
    storeWarning: stored.ok
      ? null
      : "Campania e creată în TikTok, dar n-a putut fi notată în baza portalului, deci nu va apărea în lista de campanii. Păstrează linkul de mai sus.",
  };
}
