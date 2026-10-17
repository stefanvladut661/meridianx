import "server-only";

import { GOOGLE_ADS_LEAD_SEND_TO } from "@/lib/google-tag";
import { SITE_URL } from "@/lib/site-url";
import { CONVERSION_EVENT_NAME, CURRENCY_LABEL, OBJECTIVES_WITH_CONVERSION } from "../constants";
import { planFingerprint } from "../fingerprint";
import { videosOf } from "../plan-derive";
import type { Plan } from "../plan-schema";
import { normalizeAdAccount, type PlanProblem } from "../plan-validate";
import type { PlatformCheck, VideoInfo } from "../types";
import type { AdsWorkspace } from "../workspaces";
import { workspaceName } from "../workspaces";
import { GoogleAdsApiError, googleMutate, googleSearch, serviceAccountEmail } from "./api";
import { buildGoogleOperations, type GoogleOperations } from "./build";
import { downloadLogo, LogoError, type Logo } from "./logo";
import {
  findGoogleAccount,
  listConversionActions,
  readYouTubeVideo,
  type GoogleAccount,
  type GoogleConversionAction,
} from "./lookup";
import { resolveGoogleTargeting, type GoogleTargeting } from "./targeting";

/**
 * Verificarea planului pe contul Google Ads real, înainte de creare — și
 * din nou, pe server, chiar în acțiunea de creare.
 *
 * Ce verifică: că cheia vede contul (direct sau prin managerul în care e
 * adăugat contul de serviciu) și că moneda e cea din plan; acțiunea de
 * conversie (există, intră în obiectivele contului, o trimite site-ul);
 * video-urile YouTube (publice sau nelistate); sigla; ce înseamnă fiecare
 * nume din targetare. La final, TOATĂ cererea de creare trece pe la Google
 * cu `validateOnly`: Google spune ce ar refuza, fără să creeze nimic.
 */

export interface GoogleCheckContext {
  check: PlatformCheck;
  account: GoogleAccount | null;
  targeting: GoogleTargeting | null;
  conversion: GoogleConversionAction | null;
  /** Operațiile exact cum vor pleca la creare (după verificare). */
  operations: GoogleOperations | null;
}

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/** O eroare Google pe operația N, mutată pe câmpul din plan care a produs-o. */
function problemsFrom(error: GoogleAdsApiError, operations: GoogleOperations): PlanProblem[] {
  if (error.info.errors.length === 0) {
    return [{ path: "", message: `Google a refuzat planul: ${error.info.message}${error.info.requestId ? ` (request ${error.info.requestId})` : ""}` }];
  }
  return error.info.errors.slice(0, 12).map((item) => {
    const role = item.operationIndex !== null ? operations.roles[item.operationIndex] : undefined;
    const where = role ? `la ${role.label}` : "";
    return {
      path: role?.planPath ?? "",
      message: `Google ${where ? `refuză ${where}` : "refuză planul"}: ${item.message || item.code}${item.trigger ? ` („${item.trigger}”)` : ""}. (${item.code})`,
    };
  });
}

/** Sigla deja urcată de portal în cont (același fișier) — o refolosim. */
async function existingLogo(workspace: AdsWorkspace, account: GoogleAccount, name: string): Promise<string | null> {
  const rows = await googleSearch<{ asset?: { resourceName?: string } }>(
    workspace,
    account.info.id,
    `SELECT asset.resource_name, asset.name FROM asset WHERE asset.type = 'IMAGE' AND asset.name = '${name.replace(/'/g, "\\'")}'`,
    { loginCustomerId: account.loginCustomerId }
  ).catch(() => []);
  return rows[0]?.asset?.resourceName ?? null;
}

/** Video-urile YouTube deja materiale în cont — se refolosesc, nu se creează din nou. */
async function existingVideoAssets(workspace: AdsWorkspace, account: GoogleAccount, youtubeIds: string[]): Promise<Map<string, string>> {
  const found = new Map<string, string>();
  if (youtubeIds.length === 0) return found;
  const rows = await googleSearch<{ asset?: { resourceName?: string; youtubeVideoAsset?: { youtubeVideoId?: string } } }>(
    workspace,
    account.info.id,
    `SELECT asset.resource_name, asset.youtube_video_asset.youtube_video_id FROM asset WHERE asset.type = 'YOUTUBE_VIDEO' AND asset.youtube_video_asset.youtube_video_id IN (${youtubeIds.map((id) => `'${id}'`).join(", ")})`,
    { loginCustomerId: account.loginCustomerId }
  ).catch(() => []);
  for (const row of rows) {
    const id = row.asset?.youtubeVideoAsset?.youtubeVideoId;
    if (id && row.asset?.resourceName && !found.has(id)) found.set(id, row.asset.resourceName);
  }
  return found;
}

export async function checkOnGoogle(workspace: AdsWorkspace, plan: Plan): Promise<GoogleCheckContext> {
  const errors: PlanProblem[] = [];
  const warnings: PlanProblem[] = [];
  const customerId = normalizeAdAccount("google", plan.ad_account);
  const google = plan.google;
  const needsConversion = OBJECTIVES_WITH_CONVERSION.includes(plan.campaign.objective);
  const planned = videosOf(plan.creative);
  const single = !plan.creative.videos;

  // Contul întâi: fără el, nicio altă citire nu are sens.
  const account = await findGoogleAccount(workspace, customerId);
  if (!account) {
    const email = serviceAccountEmail(workspace);
    errors.push({
      path: "ad_account",
      message: `Cheia spațiului ${workspaceName(workspace)} nu vede contul Google Ads ${customerId}. ${
        email ? `Adaugă contul de serviciu ${email}` : "Adaugă contul de serviciu"
      } în Google Ads → Admin → Acces și securitate → Utilizatori (nivel „Standard”) — în contul ăsta sau în contul manager de deasupra lui.`,
    });
    return emptyContext(workspace, plan, customerId, errors);
  }
  if (account.manager) {
    errors.push({
      path: "ad_account",
      message: `${account.info.name} e un cont manager (MCC): Google nu pune campanii în el. Scrie în plan contul clientului de sub manager.`,
    });
  } else if (!account.info.usable) {
    errors.push({
      path: "ad_account",
      message: `Contul ${account.info.name} e ${account.info.state}: Google nu livrează din el. Rezolvă starea contului în Google Ads.`,
    });
  }
  if (account.info.currency !== plan.campaign.currency) {
    const label = CURRENCY_LABEL[account.info.currency as keyof typeof CURRENCY_LABEL];
    errors.push({
      path: "campaign.currency",
      message: `Contul ${account.info.name} plătește în ${account.info.currency}${label && label !== account.info.currency ? ` (${label})` : ""}, iar planul spune ${plan.campaign.currency}. Bugetul s-ar citi în altă monedă — corectează moneda și verifică suma.`,
    });
  }

  const [conversions, found, logoResult, targeting] = await Promise.all([
    needsConversion ? listConversionActions(workspace, account) : Promise.resolve([] as GoogleConversionAction[]),
    Promise.all(planned.map((video) => (video.source === "library" ? readYouTubeVideo(video.video_id) : Promise.resolve(null)))),
    google
      ? downloadLogo(google.logo_url).then(
          (logo) => ({ ok: true as const, logo }),
          (error: unknown) => ({ ok: false as const, message: error instanceof LogoError ? error.message : "sigla nu s-a putut citi" })
        )
      : Promise.resolve(null),
    resolveGoogleTargeting(workspace, account, plan),
  ]);

  // Conversia -----------------------------------------------------------------------
  let conversion: GoogleConversionAction | null = null;
  if (needsConversion && plan.conversion) {
    conversion = conversions.find((action) => action.id === plan.conversion?.pixel_id) ?? null;
    const primary = conversions.filter((action) => action.primary);
    if (!conversion) {
      errors.push({
        path: "conversion.pixel_id",
        message: `Contul nu are acțiunea de conversie ${plan.conversion.pixel_id} (activă). ${
          conversions.length > 0
            ? `Acțiunile lui: ${conversions.slice(0, 6).map((action) => `${action.name} (${action.id})`).join(", ")}.`
            : "Contul n-are nicio acțiune de conversie: creeaz-o în Google Ads → Obiective → Conversii (pașii din lib/ads/GHID.md)."
        }`,
      });
    } else {
      if (!conversion.primary) {
        errors.push({
          path: "conversion.pixel_id",
          message: `Acțiunea „${conversion.name}” e secundară: Google o raportează, dar nu optimizează pe ea. Fă-o principală (Google Ads → Obiective → Conversii → acțiunea → „Principală”) sau alege alta.`,
        });
      }
      if (conversion.origin !== "WEBSITE" && conversion.origin !== "—") {
        warnings.push({
          path: "conversion.pixel_id",
          message: `Acțiunea „${conversion.name}” nu vine de pe site (sursa: ${conversion.origin}). Pentru lead-urile din formularul site-ului, alege acțiunea care vine din tag-ul Google.`,
        });
      }
      const expected = CONVERSION_EVENT_NAME[plan.conversion.event].google;
      if (expected && conversion.category !== expected) {
        warnings.push({
          path: "conversion.event",
          message: `Acțiunea „${conversion.name}” are categoria ${conversion.category}, iar planul spune ${plan.conversion.event} (${expected}). Verifică să fie conversia pe care o vrei.`,
        });
      }
      const others = primary.filter((action) => action.id !== conversion?.id);
      if (others.length > 0) {
        warnings.push({
          path: "conversion.pixel_id",
          message: `Google optimizează pe TOATE conversiile principale ale contului, nu doar pe „${conversion.name}”: ${others
            .slice(0, 4)
            .map((action) => action.name)
            .join(", ")}. Dacă vrei doar lead-uri, fă-le pe celelalte secundare în Google Ads.`,
        });
      }
      const ownSite = hostOf(plan.destination.url) !== null && hostOf(plan.destination.url) === hostOf(SITE_URL);
      if (ownSite && !GOOGLE_ADS_LEAD_SEND_TO) {
        warnings.push({
          path: "conversion.pixel_id",
          message:
            "Site-ul nu are încă tag-ul Google Ads: NEXT_PUBLIC_GOOGLE_ADS_LEAD nu e setat în Vercel, deci campania nu va vedea niciun lead. Pune acolo eticheta conversiei (AW-…/…) și fă redeploy.",
        });
      } else if (ownSite && conversion.sendTo && GOOGLE_ADS_LEAD_SEND_TO !== conversion.sendTo) {
        warnings.push({
          path: "conversion.pixel_id",
          message: `Site-ul trimite conversia „Lead” spre ${GOOGLE_ADS_LEAD_SEND_TO}, iar acțiunea „${conversion.name}” are eticheta ${conversion.sendTo}. Cu altă etichetă, campania nu vede lead-urile site-ului.`,
        });
      }
    }
  }

  // Video-urile ------------------------------------------------------------------------
  const videos: VideoInfo[] = [];
  planned.forEach((planVideo, index) => {
    const path = single ? "creative.video" : `creative.videos.${index}`;
    const which = single ? "Video-ul" : `Video-ul ${index + 1}`;
    const video = found[index];
    if (planVideo.source === "upload") {
      errors.push({ path, message: `${which} nu e încă pe YouTube. Urcă-l la „Materialul”: portalul îl pune pe YouTube, nelistat, prin Google Ads.` });
    } else if (video === "private") {
      errors.push({
        path: `${path}.video_id`,
        message: `${which} (${planVideo.video_id}) e privat pe YouTube: Google nu folosește video-uri private în reclame. Fă-l „Nelistat” sau „Public” în YouTube Studio.`,
      });
    } else if (!video) {
      errors.push({
        path: `${path}.video_id`,
        message: `${which} (${planVideo.video_id}) nu există pe YouTube sau a fost șters. Verifică id-ul din link (youtube.com/watch?v=…).`,
      });
    } else {
      videos.push(video);
    }
  });

  // Sigla --------------------------------------------------------------------------------
  let logo: Logo | null = null;
  if (logoResult && !logoResult.ok) {
    errors.push({ path: "google.logo_url", message: `Sigla nu merge: ${logoResult.message}.` });
  } else if (logoResult?.ok) {
    logo = logoResult.logo;
  }

  errors.push(...targeting.errors);
  warnings.push(...targeting.warnings);

  // Google însuși: toată crearea, cu validateOnly -------------------------------------
  let operations: GoogleOperations | null = null;
  if (errors.length === 0 && google && logo) {
    const logoName = `Siglă · ${google.business_name} · ${logo.hash}`;
    const [reuse, videoAssets] = await Promise.all([
      existingLogo(workspace, account, logoName),
      existingVideoAssets(workspace, account, videos.map((video) => video.id)),
    ]);
    operations = buildGoogleOperations(targeting.plan, {
      customerId: account.info.id,
      geoTargets: targeting.geoTargets,
      languageConstants: targeting.languageConstants,
      interestIds: targeting.interestIds,
      videos: videos.map((video) => ({ youtubeId: video.id, asset: videoAssets.get(video.id) ?? null })),
      logo: reuse ? { resourceName: reuse } : { data: logo.data, hash: logo.hash },
      uniqueSuffix: Date.now().toString(36),
    });
    try {
      await googleMutate(workspace, account.info.id, operations.operations, {
        validateOnly: true,
        loginCustomerId: account.loginCustomerId,
      });
    } catch (error) {
      if (!(error instanceof GoogleAdsApiError) || error.info.status === 0 || error.info.status >= 500 || error.info.status === 401) {
        throw error;
      }
      errors.push(...problemsFrom(error, operations));
    }
  }

  const check: PlatformCheck = {
    platform: "google",
    fingerprint: planFingerprint({
      workspace: workspace.id,
      account: account.info.id,
      plan: targeting.plan,
      geo: targeting.geoTargets,
      languages: targeting.languageConstants,
      interests: targeting.interestIds,
      conversion: conversion?.id ?? null,
      logo: logo?.hash ?? null,
      videos: videos.map((video) => video.id),
    }),
    checkedAt: new Date().toISOString(),
    ok: errors.length === 0,
    account: account.info,
    identity: google ? { id: account.info.id, name: google.business_name } : null,
    instagram: null,
    pixel: conversion ? { id: conversion.id, name: `${conversion.name} · ${conversion.category}` } : null,
    video: found.find((video): video is VideoInfo => Boolean(video && video !== "private")) ?? null,
    videos: found.map((video) => (video && video !== "private" ? video : null)),
    dsa: null,
    conversionDomain: null,
    locations: targeting.locations,
    languages: targeting.languages,
    interests: targeting.interests,
    behaviors: [],
    errors,
    warnings,
  };

  return { check, account, targeting, conversion, operations: errors.length === 0 ? operations : null };
}

function emptyContext(workspace: AdsWorkspace, plan: Plan, customerId: string, errors: PlanProblem[]): GoogleCheckContext {
  return {
    check: {
      platform: "google",
      fingerprint: planFingerprint({ workspace: workspace.id, account: customerId, plan }),
      checkedAt: new Date().toISOString(),
      ok: false,
      account: null,
      identity: null,
      instagram: null,
      pixel: null,
      video: null,
      videos: [],
      dsa: null,
      conversionDomain: null,
      locations: [],
      languages: [],
      interests: [],
      behaviors: [],
      errors,
      warnings: [],
    },
    account: null,
    targeting: null,
    conversion: null,
    operations: null,
  };
}
