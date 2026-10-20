import "server-only";

import type { AdsWorkspace } from "../../workspaces";
import { googleSearch } from "../api";
import type { GoogleAccount } from "../lookup";
import { sendToOf } from "./standard";
import type { ConversionActionInfo, ConversionOwner, ConversionSetup } from "./types";

/**
 * Citirile pentru `/admin/ads/conversii` (faza 13), GAQL v26, fără efect:
 * cine gestionează conversiile contului, raportarea apelurilor și acțiunile de
 * conversie cu fragmentele lor de cod (de unde iese eticheta AW-…/…).
 */

interface CustomerRow {
  customer?: {
    conversionTrackingSetting?: {
      conversionTrackingId?: string;
      crossAccountConversionTrackingId?: string;
      googleAdsConversionCustomer?: string;
      conversionTrackingStatus?: string;
    };
    callReportingSetting?: { callReportingEnabled?: boolean; callConversionReportingEnabled?: boolean };
  };
}

interface ActionRow {
  conversionAction?: {
    id?: string;
    name?: string;
    type?: string;
    category?: string;
    status?: string;
    primaryForGoal?: boolean;
    countingType?: string;
    clickThroughLookbackWindowDays?: string;
    viewThroughLookbackWindowDays?: string;
    phoneCallDurationSeconds?: string;
    tagSnippets?: Array<{ type?: string; pageFormat?: string; eventSnippet?: string; globalSiteTag?: string }>;
  };
}

const CUSTOMER_FIELDS = [
  "customer.conversion_tracking_setting.conversion_tracking_id",
  "customer.conversion_tracking_setting.cross_account_conversion_tracking_id",
  "customer.conversion_tracking_setting.google_ads_conversion_customer",
  "customer.conversion_tracking_setting.conversion_tracking_status",
  "customer.call_reporting_setting.call_reporting_enabled",
  "customer.call_reporting_setting.call_conversion_reporting_enabled",
].join(", ");

const ACTION_FIELDS = [
  "conversion_action.id",
  "conversion_action.name",
  "conversion_action.type",
  "conversion_action.category",
  "conversion_action.status",
  "conversion_action.primary_for_goal",
  "conversion_action.counting_type",
  "conversion_action.click_through_lookback_window_days",
  "conversion_action.view_through_lookback_window_days",
  "conversion_action.phone_call_duration_seconds",
  "conversion_action.tag_snippets",
].join(", ");

const OWNER: Record<string, ConversionOwner> = {
  CONVERSION_TRACKING_MANAGED_BY_SELF: "self",
  CONVERSION_TRACKING_MANAGED_BY_THIS_MANAGER: "manager",
  CONVERSION_TRACKING_MANAGED_BY_ANOTHER_MANAGER: "manager",
  NOT_CONVERSION_TRACKED: "none",
};

const whole = (value: string | undefined): number | null => {
  const parsed = Number(value);
  return value !== undefined && Number.isFinite(parsed) ? parsed : null;
};

export async function readConversionActions(workspace: AdsWorkspace, account: GoogleAccount): Promise<ConversionActionInfo[]> {
  const rows = await googleSearch<ActionRow>(
    workspace,
    account.info.id,
    `SELECT ${ACTION_FIELDS} FROM conversion_action WHERE conversion_action.status != 'REMOVED'`,
    { loginCustomerId: account.loginCustomerId }
  );
  return rows
    .filter((row) => row.conversionAction?.id)
    .map(({ conversionAction: action = {} }) => ({
      id: action.id as string,
      name: action.name ?? "—",
      type: action.type ?? "UNKNOWN",
      category: action.category ?? "UNKNOWN",
      status: action.status ?? "UNKNOWN",
      primary: action.primaryForGoal !== false,
      counting: action.countingType ?? null,
      clickWindowDays: whole(action.clickThroughLookbackWindowDays),
      viewWindowDays: whole(action.viewThroughLookbackWindowDays),
      callSeconds: action.type === "AD_CALL" || action.type === "WEBSITE_CALL" ? whole(action.phoneCallDurationSeconds) : null,
      sendTo: sendToOf(action.tagSnippets ?? []),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "ro"));
}

export async function readConversionSetup(workspace: AdsWorkspace, account: GoogleAccount): Promise<ConversionSetup> {
  const [customerRows, actions] = await Promise.all([
    googleSearch<CustomerRow>(workspace, account.info.id, `SELECT ${CUSTOMER_FIELDS} FROM customer`, { loginCustomerId: account.loginCustomerId }),
    readConversionActions(workspace, account),
  ]);
  const customer = customerRows[0]?.customer ?? {};
  const tracking = customer.conversionTrackingSetting ?? {};
  // Contul unde se creează conversiile: dacă nu e chiar acesta, urmărirea e între conturi (în manager).
  const conversionCustomer = tracking.googleAdsConversionCustomer?.split("/").pop() ?? null;
  return {
    trackingId: tracking.crossAccountConversionTrackingId ?? tracking.conversionTrackingId ?? null,
    owner: OWNER[tracking.conversionTrackingStatus ?? ""] ?? "unknown",
    conversionAccount: conversionCustomer && conversionCustomer !== account.info.id ? conversionCustomer : null,
    callReporting: {
      enabled: customer.callReportingSetting?.callReportingEnabled === true,
      conversions: customer.callReportingSetting?.callConversionReportingEnabled === true,
    },
    actions,
  };
}
