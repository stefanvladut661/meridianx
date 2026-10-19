import { CURRENCIES, type Currency } from "../../constants";
import { formatMoney } from "../../plan-derive";

/**
 * Numele în română ale valorilor Google care apar în `/admin/ads/cont`.
 * O valoare necunoscută se arată ca atare — Google adaugă tipuri noi.
 */

export const CHANNEL_LABEL: Record<string, string> = {
  SEARCH: "Căutare",
  DISPLAY: "Display",
  PERFORMANCE_MAX: "Performance Max",
  VIDEO: "Video",
  DEMAND_GEN: "Demand Gen",
  SHOPPING: "Shopping",
  SMART: "Smart",
  MULTI_CHANNEL: "Aplicații",
  LOCAL: "Local",
  LOCAL_SERVICES: "Servicii locale",
  HOTEL: "Hoteluri",
  TRAVEL: "Călătorii",
};

export const CAMPAIGN_STATUS_LABEL: Record<string, string> = {
  ENABLED: "Activă",
  PAUSED: "Pe pauză",
  REMOVED: "Ștearsă",
};

export const BIDDING_STRATEGY_LABEL: Record<string, string> = {
  TARGET_SPEND: "Maximizează clicurile",
  MAXIMIZE_CONVERSIONS: "Maximizează conversiile",
  MAXIMIZE_CONVERSION_VALUE: "Maximizează valoarea conversiilor",
  MANUAL_CPC: "CPC manual",
  MANUAL_CPM: "CPM manual",
  MANUAL_CPV: "CPV manual",
  TARGET_CPA: "CPA țintă",
  TARGET_ROAS: "ROAS țintă",
  TARGET_IMPRESSION_SHARE: "Cotă de afișări țintă",
  TARGET_CPM: "CPM țintă",
  TARGET_CPV: "CPV țintă",
};

export const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Administrator",
  STANDARD: "Standard",
  READ_ONLY: "Doar citire",
  EMAIL_ONLY: "Doar email",
};

export const CHANGE_OPERATION_LABEL: Record<string, string> = {
  CREATE: "a creat",
  UPDATE: "a modificat",
  REMOVE: "a șters",
};

export const CHANGE_RESOURCE_LABEL: Record<string, string> = {
  CAMPAIGN: "campanie",
  CAMPAIGN_BUDGET: "buget",
  CAMPAIGN_CRITERION: "criteriu de campanie",
  CAMPAIGN_ASSET: "material de campanie",
  AD_GROUP: "grup",
  AD_GROUP_AD: "anunț",
  AD_GROUP_CRITERION: "cuvânt cheie / criteriu de grup",
  AD_GROUP_ASSET: "material de grup",
  AD_GROUP_BID_MODIFIER: "ajustare de licitare",
  AD: "anunț",
  ASSET: "material",
  ASSET_SET: "set de materiale",
  ASSET_SET_ASSET: "material din set",
  CAMPAIGN_ASSET_SET: "set de materiale al campaniei",
  CUSTOMER_ASSET: "material de cont",
  FEED: "feed",
  FEED_ITEM: "element de feed",
  AD_GROUP_FEED: "feed de grup",
  CAMPAIGN_FEED: "feed de campanie",
};

export const BILLING_STATUS_LABEL: Record<string, string> = {
  APPROVED: "aprobată",
  APPROVED_HELD: "aprobată, în așteptare",
  PENDING: "în așteptare",
  CANCELLED: "anulată",
};

export function label(map: Record<string, string>, value: string | null | undefined): string {
  if (!value) return "—";
  return map[value] ?? value;
}

/** Bani în moneda contului; o monedă fără etichetă se scrie cu codul ei. */
export function accountMoney(amount: number, currency: string): string {
  if ((CURRENCIES as readonly string[]).includes(currency)) return formatMoney(amount, currency as Currency);
  return `${formatMoney(amount, null)} ${currency}`;
}
