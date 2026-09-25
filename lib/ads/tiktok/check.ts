import "server-only";

import { CURRENCY_LABEL, OBJECTIVES_WITH_CONVERSION } from "../constants";
import { planFingerprint } from "../fingerprint";
import type { Plan } from "../plan-schema";
import { normalizeAdAccount, type PlanProblem } from "../plan-validate";
import type { AdAccountInfo, PlatformCheck, VideoInfo } from "../types";
import type { AdsWorkspace } from "../workspaces";
import { workspaceName } from "../workspaces";
import { TIKTOK_OPTIMIZATION_EVENT } from "./build";
import { findPixel, listIdentities, readAdvertiser, readVideo, type TikTokIdentity, type TikTokPixel } from "./lookup";
import { resolveTikTokTargeting, type TikTokTargeting } from "./targeting";

/**
 * Verificarea planului pe contul TikTok real, înainte de creare — și din
 * nou, pe server, chiar în acțiunea de creare.
 *
 * Ce verifică: că tokenul vede contul și că moneda e cea din plan; că
 * identitatea (contul TikTok de pe reclamă) există și primește video urcat
 * de noi; pixelul (după id sau după cod) și evenimentul lui; video-ul
 * (convertit complet); ce înseamnă fiecare nume din targetare.
 *
 * Amprenta leagă verificarea de creare, ca pe Meta: crearea o recalculează
 * și refuză dacă diferă.
 */

/** Statele UE: acolo TikTok cere plătitorul pe reclamă (DSA). */
const EU = new Set([
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "GR", "DE", "HU", "IE",
  "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE",
]);

export interface TikTokCheckContext {
  check: PlatformCheck;
  targeting: TikTokTargeting;
  account: AdAccountInfo | null;
  identity: TikTokIdentity | null;
  pixel: TikTokPixel | null;
  video: VideoInfo | null;
}

function targetsEu(plan: Plan): boolean {
  return plan.audience.locations.some((location) =>
    EU.has(location.type === "country" ? location.code : location.country)
  );
}

export async function checkOnTikTok(workspace: AdsWorkspace, plan: Plan): Promise<TikTokCheckContext> {
  const errors: PlanProblem[] = [];
  const warnings: PlanProblem[] = [];
  const advertiserId = normalizeAdAccount("tiktok", plan.ad_account);
  const tiktok = plan.tiktok;
  const conversion = OBJECTIVES_WITH_CONVERSION.includes(plan.campaign.objective) ? plan.conversion : undefined;
  const videoId = plan.creative.video.source === "library" ? plan.creative.video.video_id : null;

  // Contul întâi: dacă tokenul nu-l vede, restul citirilor ar pica toate
  // cu aceeași eroare de permisiune.
  const account = await readAdvertiser(workspace, advertiserId);
  if (!account) {
    errors.push({
      path: "ad_account",
      message: `Tokenul spațiului ${workspaceName(workspace)} nu vede contul TikTok ${advertiserId}. Contul trebuie bifat când autorizezi aplicația (pașii din lib/ads/README.md → „Tokenurile TikTok”); dacă l-ai adăugat după, refă autorizarea și pune tokenul nou în Vercel.`,
    });
    return emptyContext(workspace, plan, advertiserId, errors);
  }

  if (!account.usable) {
    errors.push({
      path: "ad_account",
      message: `Contul ${account.name} e ${account.state}: TikTok nu livrează din el. Rezolvă starea contului în TikTok Ads Manager.`,
    });
  }
  if (account.currency !== plan.campaign.currency) {
    const label = CURRENCY_LABEL[account.currency as keyof typeof CURRENCY_LABEL];
    errors.push({
      path: "campaign.currency",
      message: `Contul ${account.name} plătește în ${account.currency}${label && label !== account.currency ? ` (${label})` : ""}, iar planul spune ${plan.campaign.currency}. Bugetul s-ar citi în altă monedă — corectează moneda și verifică suma.`,
    });
  }

  const [identities, pixel, video, targeting] = await Promise.all([
    tiktok ? listIdentities(workspace, advertiserId, tiktok.identity_type, tiktok.identity_bc_id) : Promise.resolve([]),
    conversion ? findPixel(workspace, advertiserId, conversion.pixel_id) : Promise.resolve(null),
    videoId ? readVideo(workspace, advertiserId, videoId) : Promise.resolve(null),
    resolveTikTokTargeting(workspace, advertiserId, plan),
  ]);

  // Identitatea ------------------------------------------------------------------
  const identity = tiktok ? identities.find((item) => item.id === tiktok.identity_id) ?? null : null;
  if (tiktok && !identity) {
    const visible = identities.slice(0, 5).map((item) => `${item.name} (${item.id})`);
    errors.push({
      path: "tiktok.identity_id",
      message: `Contul nu vede identitatea ${tiktok.identity_id} de tipul ${tiktok.identity_type}. ${
        visible.length > 0
          ? `Identitățile lui de tipul ăsta: ${visible.join(", ")}.`
          : tiktok.identity_type === "BC_AUTH_TT"
            ? "Nu vede niciuna — verifică identity_bc_id și că contul TikTok e autorizat în Business Center pentru contul ăsta de reclame."
            : "Nu vede niciuna — leagă contul TikTok de contul de reclame în TikTok Ads Manager, la Identities."
      }`,
    });
  } else if (identity && !identity.available) {
    errors.push({
      path: "tiktok.identity_id",
      message: `Identitatea ${identity.name} nu e disponibilă acum pentru reclame (autorizarea a expirat sau a fost retrasă). Refă autorizarea contului TikTok.`,
    });
  } else if (identity && !identity.canPushVideo) {
    errors.push({
      path: "tiktok.identity_id",
      message: `Contul TikTok ${identity.name} nu primește video urcat de agenție (TikTok: can_push_video = false). Cere autorizarea „push” pentru contul ăsta în Business Center sau alege altă identitate.`,
    });
  }

  // Pixelul -----------------------------------------------------------------------
  if (conversion && !pixel) {
    errors.push({
      path: "conversion.pixel_id",
      message: `Contul nu vede pixelul ${conversion.pixel_id}. Verifică în TikTok Ads Manager, la Events, că pixelul e al contului ăstuia (id-ul sau codul, cel care începe cu litere).`,
    });
  }
  const optimizationEvent = conversion ? TIKTOK_OPTIMIZATION_EVENT[conversion.event] : null;
  if (pixel && optimizationEvent && pixel.events && !pixel.events.includes(optimizationEvent)) {
    warnings.push({
      path: "conversion.event",
      message: `Pixelul ${pixel.name} n-a primit încă evenimentul pe care optimizează campania (${optimizationEvent}). TikTok actualizează lista la 2–4 ore; dacă evenimentul nu apare deloc, TikTok poate refuza grupul de reclame sau n-are pe ce optimiza.`,
    });
  }

  // Video-ul ----------------------------------------------------------------------
  if (plan.creative.video.source === "upload") {
    errors.push({
      path: "creative.video",
      message: "Video-ul nu e încă în contul de reclame. Urcă-l la „Materialul”: când TikTok termină de procesat, planul trece singur pe el.",
    });
  } else if (!video) {
    errors.push({
      path: "creative.video.video_id",
      message: `Video-ul ${videoId} nu există în contul ăsta. Alege-l din biblioteca contului.`,
    });
  } else if (!video.ready) {
    errors.push({
      path: "creative.video.video_id",
      message: "TikTok încă procesează video-ul. Reverifică în câteva minute — o reclamă cu el ar pica acum.",
    });
  }

  // DSA: TikTok nu are câmp în API pentru plătitor — se setează pe cont.
  if (targetsEu(plan)) {
    warnings.push({
      path: "audience.locations",
      message:
        "Publicul e în UE: TikTok cere pe reclamă cine plătește (DSA), iar API-ul nu-l poate trimite. Verifică o dată, în TikTok Ads Manager, că informațiile despre plătitor (Payer information) sunt completate pe contul ăsta — fără ele, TikTok nu publică reclama când o pornești.",
    });
  }

  errors.push(...targeting.errors);

  const check: PlatformCheck = {
    platform: "tiktok",
    fingerprint: planFingerprint({
      workspace: workspace.id,
      account: advertiserId,
      plan: targeting.plan,
      locationIds: targeting.locationIds,
      languageCodes: targeting.languageCodes,
      interestIds: targeting.interestIds,
      pixel: pixel?.id ?? null,
      identity: identity?.id ?? null,
    }),
    checkedAt: new Date().toISOString(),
    ok: errors.length === 0,
    account,
    identity: identity ? { id: identity.id, name: identity.name } : null,
    instagram: null,
    pixel: pixel ? { id: pixel.id, name: pixel.code ? `${pixel.name} · ${pixel.code}` : pixel.name } : null,
    video,
    dsa: null,
    conversionDomain: null,
    locations: targeting.locations,
    languages: targeting.languages,
    interests: targeting.interests,
    behaviors: [],
    errors,
    warnings,
  };

  return { check, targeting, account, identity, pixel, video };
}

/** Contul nu se vede: nimic de citit mai departe, doar eroarea contului. */
function emptyContext(workspace: AdsWorkspace, plan: Plan, advertiserId: string, errors: PlanProblem[]): TikTokCheckContext {
  const targeting: TikTokTargeting = {
    plan,
    locationIds: [],
    languageCodes: [],
    interestIds: [],
    locations: [],
    languages: [],
    interests: [],
    errors: [],
  };
  return {
    check: {
      platform: "tiktok",
      fingerprint: planFingerprint({ workspace: workspace.id, account: advertiserId, plan }),
      checkedAt: new Date().toISOString(),
      ok: false,
      account: null,
      identity: null,
      instagram: null,
      pixel: null,
      video: null,
      dsa: null,
      conversionDomain: null,
      locations: [],
      languages: [],
      interests: [],
      behaviors: [],
      errors,
      warnings: [],
    },
    targeting,
    account: null,
    identity: null,
    pixel: null,
    video: null,
  };
}
