import "server-only";

import { adSetName } from "../plan-derive";
import type { Plan } from "../plan-schema";
import { recordCampaign, type PlatformObjects } from "../store";
import type { AdsWorkspace } from "../workspaces";
import { buildAd, buildAdSet, buildCampaign, buildCreatives, type Thumbnail } from "./build";
import type { MetaCheckContext } from "./check";
import { describeMetaError } from "./errors";
import { metaCreate, metaUploadImage } from "./graph";
import { campaignUrl } from "../links";
import { ThumbnailError, downloadThumbnail } from "./thumbnail";
import type { CreateResponse, CreatedObject } from "../types";

/**
 * Crearea pe Meta: copertă → campanie → set → (creativ → reclamă) × N.
 * Totul pe pauză.
 *
 * Ordinea contează. Coperta se urcă prima: o imagine în biblioteca
 * contului nu e o reclamă și nu costă nimic, deci dacă pică aici, nu există
 * nimic de explicat. Campania e primul obiect „adevărat": dacă pică, nu
 * s-a creat nimic. De la campanie încolo, orice eroare lasă în urmă obiecte
 * OPRITE — nu le ștergem automat (o ștergere e încă o scriere care poate
 * pica), ci le arătăm omului, cu link, și le notăm în bază ca „parțial".
 *
 * Reclamele se creează una câte una, fiecare după creativul ei. La prima
 * eroare ne oprim: a continua ar crea o campanie cu o parte din texte,
 * despre care omul ar afla doar numărând.
 */

export interface CreateInput {
  workspace: AdsWorkspace;
  context: MetaCheckContext;
  user: { id: string; email: string | null };
}

export async function createPausedOnMeta(input: CreateInput): Promise<CreateResponse> {
  const { workspace, context, user } = input;
  const plan: Plan = context.resolved.plan;
  const { account, video } = context;
  if (!account || !video || !context.thumbnail || !context.check.ok) {
    return { ok: false, message: "Verificarea pe Meta nu e completă. Verifică din nou planul.", recheck: true };
  }

  const created: CreatedObject[] = [];
  const objects: PlatformObjects = { creatives: [], ads: [] };

  // 0. Coperta. Cea propusă de Meta se descarcă și se urcă în cont; cea din
  //    plan (un URL al tău) o descarcă Meta singur.
  let thumbnail: Thumbnail;
  if (context.thumbnail.kind === "url") {
    thumbnail = { url: context.thumbnail.url };
  } else {
    try {
      const image = await downloadThumbnail(context.thumbnail.uri, video.id);
      thumbnail = await metaUploadImage(workspace, account.id, image);
    } catch (error) {
      const message =
        error instanceof ThumbnailError
          ? `Coperta video-ului nu s-a putut pregăti: ${error.message}. Pune o imagine în creative.thumbnail: { "url": "https://…" } și verifică din nou.`
          : describeMetaError(error, "urcarea copertei video-ului", workspace.tokenEnv);
      return { ok: false, message };
    }
    created.push({ kind: "image", id: thumbnail.hash, name: "Coperta video-ului" });
  }

  // 1. Campania — dacă pică, nu există nicio campanie în Meta.
  let campaignId: string;
  try {
    campaignId = (await metaCreate(workspace, account.id, "campaigns", buildCampaign(plan))).id;
  } catch (error) {
    return { ok: false, message: describeMetaError(error, "crearea campaniei", workspace.tokenEnv) };
  }
  created.push({ kind: "campaign", id: campaignId, name: plan.campaign.name });
  const adsManagerUrl = campaignUrl("meta", account.id, campaignId);

  const save = (creation: "complete" | "partial", creationError: string | null) =>
    recordCampaign({
      workspace: workspace.id,
      platform: "meta",
      adAccount: account.id,
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

  // 2. Setul de reclame.
  let adSetId: string;
  try {
    const payload = buildAdSet(plan, { campaignId, locales: context.resolved.locales, dsa: context.dsa });
    adSetId = (await metaCreate(workspace, account.id, "adsets", payload)).id;
  } catch (error) {
    return stop(describeMetaError(error, "crearea setului de reclame", workspace.tokenEnv));
  }
  objects.adset = adSetId;
  created.push({ kind: "adset", id: adSetId, name: adSetName(plan.campaign.name) });

  // 3. Creativ + reclamă, pe rând.
  const planned = buildCreatives(plan, { videoId: video.id, thumbnail });
  for (const [index, ad] of planned.entries()) {
    const which = planned.length > 1 ? ` ${index + 1} din ${planned.length}` : "";
    let creativeId: string;
    try {
      creativeId = (await metaCreate(workspace, account.id, "adcreatives", ad.creative)).id;
    } catch (error) {
      return stop(describeMetaError(error, `crearea materialului pentru reclama${which}`, workspace.tokenEnv));
    }
    objects.creatives?.push(creativeId);
    created.push({ kind: "creative", id: creativeId, name: ad.name });

    let adId: string;
    try {
      const payload = buildAd(plan, { name: ad.name, adSetId, creativeId });
      adId = (await metaCreate(workspace, account.id, "ads", payload)).id;
    } catch (error) {
      return stop(describeMetaError(error, `crearea reclamei${which}`, workspace.tokenEnv));
    }
    objects.ads?.push(adId);
    created.push({ kind: "ad", id: adId, name: ad.name });
  }

  // 4. Notat în bază. Dacă pică, campania există totuși în Meta — o spunem.
  const stored = await save("complete", null);
  return {
    ok: true,
    recordId: stored.ok ? stored.data.id : null,
    adsManagerUrl,
    created,
    storeWarning: stored.ok
      ? null
      : "Campania e creată în Meta, dar n-a putut fi notată în baza portalului, deci nu va apărea în lista de campanii. Păstrează linkul de mai sus.",
  };
}
