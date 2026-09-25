import type { Platform } from "./constants";

/**
 * Linkurile spre Ads Manager (Meta) și TikTok Ads Manager. Izomorf: se
 * construiesc din id-uri, fără token. Deschid lista filtrată pe campanie,
 * de unde omul o verifică și o pornește.
 */

function metaAccountDigits(adAccount: string): string {
  return adAccount.replace(/^act_/, "");
}

export function campaignUrl(platform: Platform, adAccount: string, campaignId: string): string {
  if (platform === "tiktok") {
    const params = new URLSearchParams({ aadvid: adAccount, keyword: campaignId });
    return `https://ads.tiktok.com/i18n/perf/campaign?${params}`;
  }
  const params = new URLSearchParams({
    act: metaAccountDigits(adAccount),
    selected_campaign_ids: campaignId,
  });
  return `https://adsmanager.facebook.com/adsmanager/manage/campaigns?${params}`;
}

/** Numele aplicației în care se pornește campania, pentru butoane și texte. */
export function managerName(platform: Platform): string {
  return platform === "tiktok" ? "TikTok Ads Manager" : "Ads Manager";
}
