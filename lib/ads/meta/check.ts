import "server-only";

import { createHash } from "node:crypto";
import { CURRENCY_LABEL, OBJECTIVES_WITH_CONVERSION } from "../constants";
import type { Plan } from "../plan-schema";
import { normalizeAdAccount, type PlanProblem } from "../plan-validate";
import type { AdsWorkspace } from "../workspaces";
import { workspaceName } from "../workspaces";
import { conversionDomain, type Dsa } from "./build";
import {
  listAdAccounts,
  readAccountDsa,
  readDsaSuggestions,
  readInstagram,
  readPage,
  readPixel,
  readVideo,
} from "./lookup";
import { resolveTargeting, type ResolvedTargeting } from "./targeting";
import type { MetaAccountInfo, MetaCheck, MetaVideoInfo } from "./types";

/**
 * Verificarea planului pe contul real, înainte de creare — și din nou, pe
 * server, chiar în acțiunea de creare.
 *
 * Ce verifică: că tokenul spațiului vede contul din plan și că moneda
 * contului e cea din plan; că vede pagina, contul de Instagram, pixelul și
 * video-ul (gata procesat); ce înseamnă fiecare nume din targetare; cine
 * apare ca beneficiar și plătitor (DSA) pe reclamele din UE.
 *
 * Amprenta leagă verificarea de creare: e calculată din planul cu cheile
 * rezolvate + contul + beneficiarul/plătitorul. Crearea o recalculează și
 * refuză dacă diferă — omul creează exact ce a văzut, nu ce a găsit Meta
 * un minut mai târziu.
 */

/** Statele UE: acolo DSA cere beneficiarul și plătitorul pe fiecare set. */
const EU = new Set([
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "GR", "DE", "HU", "IE",
  "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE",
]);

/** Coperta care intră în creativ: cea propusă de Meta (se urcă) sau cea din plan. */
export type ThumbnailSource = { kind: "meta"; uri: string } | { kind: "url"; url: string };

export interface MetaCheckContext {
  check: MetaCheck;
  resolved: ResolvedTargeting;
  account: MetaAccountInfo | null;
  video: MetaVideoInfo | null;
  thumbnail: ThumbnailSource | null;
  /** `null` = publicul nu e în UE. Când e cerut, e complet (altfel e eroare). */
  dsa: Dsa | null;
}

export function planFingerprint(input: {
  workspace: string;
  account: string;
  plan: Plan;
  locales: number[];
  dsa: Dsa | null;
}): string {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex");
}

function targetsEu(plan: Plan): boolean {
  return plan.audience.locations.some((location) =>
    EU.has(location.type === "country" ? location.code : location.country)
  );
}

export async function checkOnMeta(workspace: AdsWorkspace, plan: Plan): Promise<MetaCheckContext> {
  const errors: PlanProblem[] = [];
  const warnings: PlanProblem[] = [];
  const adAccount = normalizeAdAccount("meta", plan.ad_account);
  const meta = plan.meta;
  const needsPixel = OBJECTIVES_WITH_CONVERSION.includes(plan.campaign.objective);
  const videoId = plan.creative.video.source === "library" ? plan.creative.video.video_id : null;

  const [accounts, page, instagram, pixel, video, resolved] = await Promise.all([
    listAdAccounts(workspace),
    meta ? readPage(workspace, meta.page_id) : Promise.resolve(null),
    meta?.instagram_account_id ? readInstagram(workspace, meta.instagram_account_id) : Promise.resolve(null),
    needsPixel && plan.conversion ? readPixel(workspace, plan.conversion.pixel_id) : Promise.resolve(null),
    videoId ? readVideo(workspace, videoId) : Promise.resolve(null),
    resolveTargeting(workspace, plan),
  ]);

  // Contul și moneda ------------------------------------------------------------
  const account = accounts.find((item) => item.id === adAccount) ?? null;
  if (!account) {
    const visible = accounts.map((item) => `${item.name} (${item.id})`);
    errors.push({
      path: "ad_account",
      message: `Tokenul spațiului ${workspaceName(workspace)} nu vede contul ${adAccount}. ${
        visible.length > 0
          ? `Conturile lui: ${visible.join(", ")}.`
          : "Nu vede niciun cont — atribuie-l System User-ului în Business Settings → Assign assets."
      }`,
    });
  } else {
    if (!account.usable) {
      errors.push({
        path: "ad_account",
        message: `Contul ${account.name} e ${account.state}: Meta nu livrează din el. Rezolvă starea contului în Ads Manager.`,
      });
    }
    if (account.currency !== plan.campaign.currency) {
      const label = CURRENCY_LABEL[account.currency as keyof typeof CURRENCY_LABEL];
      errors.push({
        path: "campaign.currency",
        message: `Contul ${account.name} plătește în ${account.currency}${label && label !== account.currency ? ` (${label})` : ""}, iar planul spune ${plan.campaign.currency}. Bugetul s-ar citi în altă monedă — corectează moneda și verifică suma.`,
      });
    }
  }

  // DSA: beneficiarul și plătitorul ------------------------------------------------
  let dsa: Dsa | null = null;
  let dsaShown: MetaCheck["dsa"] = null;
  if (targetsEu(plan) && account) {
    const defaults = await readAccountDsa(workspace, adAccount);
    const beneficiary = meta?.dsa_beneficiary ?? defaults.beneficiary;
    const payor = meta?.dsa_payor ?? defaults.payor;
    const fromPlan = [meta?.dsa_beneficiary, meta?.dsa_payor].filter(Boolean).length;
    dsaShown = {
      beneficiary,
      payor,
      source: fromPlan === 2 ? "plan" : fromPlan === 0 ? "cont" : "plan și cont",
    };
    if (beneficiary && payor) {
      dsa = { beneficiary, payor };
    } else {
      const suggestions = await readDsaSuggestions(workspace, adAccount);
      errors.push({
        path: beneficiary ? "meta.dsa_payor" : "meta.dsa_beneficiary",
        message: `Publicul e în UE, deci Meta cere pe reclamă cine beneficiază și cine plătește (DSA), iar contul ${account.name} nu are valori implicite. Scrie în plan "dsa_beneficiary" și "dsa_payor" (în secțiunea meta) — de obicei numele firmei clientului și al celei care plătește reclama — sau setează-le o dată în Ads Manager, la setările contului.${
          suggestions.length > 0 ? ` Meta propune: ${suggestions.map((item) => `„${item}”`).join(", ")}.` : ""
        }`,
      });
    }
  }

  // Obiectele din plan ------------------------------------------------------------
  if (meta && !page) {
    errors.push({
      path: "meta.page_id",
      message: `Tokenul nu vede pagina ${meta.page_id}: id greșit sau pagina nu e atribuită System User-ului (Business Settings → System users → Assign assets → Pages).`,
    });
  }
  if (meta?.instagram_account_id && !instagram) {
    errors.push({
      path: "meta.instagram_account_id",
      message: `Tokenul nu vede contul de Instagram ${meta.instagram_account_id}. Atribuie-l System User-ului sau scoate-l din plan (atunci pe Instagram apare pagina).`,
    });
  }
  if (needsPixel && plan.conversion && !pixel) {
    errors.push({
      path: "conversion.pixel_id",
      message: `Tokenul nu vede pixelul ${plan.conversion.pixel_id}: atribuie-l System User-ului (Assign assets → Datasets) și verifică în Events Manager că e legat de contul de reclame.`,
    });
  }

  const domain = needsPixel ? conversionDomain(plan.destination.url) : null;

  let thumbnail: ThumbnailSource | null = null;
  if (plan.creative.video.source === "upload") {
    errors.push({
      path: "creative.video",
      message: "Video-ul nu e încă în contul de reclame. Urcă-l la „Materialul”: când Meta termină de procesat, planul trece singur pe el.",
    });
  } else if (!video) {
    errors.push({
      path: "creative.video.video_id",
      message: `Video-ul ${videoId} nu există sau tokenul nu-l vede. Alege-l din biblioteca contului.`,
    });
  } else {
    if (!video.ready) {
      errors.push({
        path: "creative.video.video_id",
        message: "Meta încă procesează video-ul. Reverifică în câteva minute — o reclamă cu el ar pica acum.",
      });
    }
    if (plan.creative.thumbnail !== "auto") {
      thumbnail = { kind: "url", url: plan.creative.thumbnail.url };
    } else if (video.thumbnailUrl) {
      thumbnail = { kind: "meta", uri: video.thumbnailUrl };
    } else {
      errors.push({
        path: "creative.thumbnail",
        message: "Meta n-a propus nicio copertă pentru video-ul ăsta. Pune o imagine în creative.thumbnail: { \"url\": \"https://…\" }.",
      });
    }
  }

  errors.push(...resolved.errors);

  const check: MetaCheck = {
    ok: errors.length === 0,
    fingerprint: planFingerprint({
      workspace: workspace.id,
      account: adAccount,
      plan: resolved.plan,
      locales: resolved.locales,
      dsa,
    }),
    checkedAt: new Date().toISOString(),
    account,
    page,
    instagram,
    pixel,
    video,
    dsa: dsaShown,
    conversionDomain: domain,
    locations: resolved.locations,
    languages: resolved.languages,
    interests: resolved.interests,
    behaviors: resolved.behaviors,
    errors,
    warnings,
  };

  return { check, resolved, account, video, thumbnail, dsa };
}
