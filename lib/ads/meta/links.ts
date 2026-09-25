/**
 * Linkurile spre Ads Manager. Izomorf: se construiesc din id-uri, fără token.
 *
 * `act` primește doar cifrele contului; `selected_campaign_ids` deschide
 * lista filtrată pe campanie, de unde omul o verifică și o pornește.
 */

function accountDigits(adAccount: string): string {
  return adAccount.replace(/^act_/, "");
}

export function adsManagerCampaignUrl(adAccount: string, campaignId: string): string {
  const params = new URLSearchParams({
    act: accountDigits(adAccount),
    selected_campaign_ids: campaignId,
  });
  return `https://adsmanager.facebook.com/adsmanager/manage/campaigns?${params}`;
}

export function adsManagerAccountUrl(adAccount: string): string {
  return `https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${encodeURIComponent(accountDigits(adAccount))}`;
}
