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
  if (platform === "google") {
    // Google nu documentează un link spre o campanie anume (id-ul intern `ocid`
    // nu se poate citi din API): deschidem lista de campanii a contului, cu
    // id-ul campaniei — dacă Google ignoră parametrii, campania se caută după nume.
    const params = new URLSearchParams({ campaignId, __e: adAccount.replace(/\D/g, "") });
    return `https://ads.google.com/aw/campaigns?${params}`;
  }
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
  return platform === "tiktok" ? "TikTok Ads Manager" : platform === "google" ? "Google Ads" : "Ads Manager";
}
