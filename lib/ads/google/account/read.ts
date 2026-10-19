import "server-only";

import { addDays, todayInBucharest } from "../../metrics";
import type { AdsWorkspace } from "../../workspaces";
import { GoogleAdsApiError, googleSearch } from "../api";
import type { GoogleAccount } from "../lookup";
import type { MatchType } from "../search/limits";
import { buildSignals } from "./signals";
import type {
  AccountAudit,
  AccountCampaign,
  AccountHeader,
  AuditBilling,
  AuditBlock,
  AuditChange,
  AuditConversion,
  AuditUser,
  NegativeListInfo,
} from "./types";

/**
 * Citirile pe un cont Google existent, pentru `/admin/ads/cont` — doar GAQL,
 * doar citire. Fiecare funcție ia contul cum îl vede cheia (direct sau prin
 * MCC) și trimite `login-customer-id` când e cazul.
 */

const num = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};
const micros = (value: unknown): number => Math.round((num(value) / 1_000_000) * 100) / 100;

export function matchOf(value: unknown): MatchType | null {
  return value === "EXACT" ? "exact" : value === "PHRASE" ? "phrase" : value === "BROAD" ? "broad" : null;
}

export function accountHeader(account: GoogleAccount): AccountHeader {
  return {
    id: account.info.id,
    name: account.info.name,
    currency: account.info.currency,
    state: account.info.state,
    usable: account.info.usable,
    manager: account.loginCustomerId,
  };
}

interface RawCampaign {
  campaign?: {
    id?: string;
    name?: string;
    status?: string;
    advertisingChannelType?: string;
    biddingStrategyType?: string;
    startDateTime?: string;
    primaryStatus?: string;
  };
  campaignBudget?: { amountMicros?: string };
  metrics?: { costMicros?: string; clicks?: string; conversions?: number | string };
}

const CAMPAIGN_FIELDS =
  "campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type, campaign.bidding_strategy_type, campaign.start_date_time, campaign.primary_status, campaign_budget.amount_micros, metrics.cost_micros, metrics.clicks, metrics.conversions";

/**
 * Toate campaniile contului, în toate stările (Google întoarce și campaniile
 * șterse dacă nu le filtrăm), cu cifrele pe ultimele 30 de zile și pe tot
 * istoricul. Fără `segments.date` în SELECT, o campanie fără cifre vine cu zero.
 */
export async function readAccountCampaigns(
  workspace: AdsWorkspace,
  account: GoogleAccount,
  portalIds: Map<string, string>
): Promise<AccountCampaign[]> {
  const options = { loginCustomerId: account.loginCustomerId };
  const [recent, lifetime] = await Promise.all([
    googleSearch<RawCampaign>(workspace, account.info.id, `SELECT ${CAMPAIGN_FIELDS} FROM campaign WHERE segments.date DURING LAST_30_DAYS`, options),
    googleSearch<RawCampaign>(workspace, account.info.id, `SELECT ${CAMPAIGN_FIELDS} FROM campaign`, options),
  ]);
  const recentById = new Map(recent.map((row) => [row.campaign?.id ?? "", row]));
  return lifetime
    .filter((row) => row.campaign?.id)
    .map((row) => {
      const campaign = row.campaign ?? {};
      const last = recentById.get(campaign.id ?? "");
      return {
        id: campaign.id as string,
        name: campaign.name?.trim() || `Campania ${campaign.id}`,
        status: campaign.status ?? "UNKNOWN",
        type: campaign.advertisingChannelType ?? "UNKNOWN",
        bidding: campaign.biddingStrategyType ?? null,
        startDate: campaign.startDateTime?.slice(0, 10) ?? null,
        primaryStatus: campaign.primaryStatus ?? null,
        budget: row.campaignBudget?.amountMicros ? micros(row.campaignBudget.amountMicros) : null,
        cost30: micros(last?.metrics?.costMicros),
        clicks30: num(last?.metrics?.clicks),
        conversions30: Math.round(num(last?.metrics?.conversions) * 100) / 100,
        costAll: micros(row.metrics?.costMicros),
        clicksAll: num(row.metrics?.clicks),
        conversionsAll: Math.round(num(row.metrics?.conversions) * 100) / 100,
        portalRecordId: portalIds.get(campaign.id as string) ?? null,
      };
    });
}

/** Statusul și numele unor campanii anume — chiar înainte de o pauză. */
export async function readCampaignStates(
  workspace: AdsWorkspace,
  account: GoogleAccount,
  ids: string[]
): Promise<Map<string, { name: string; status: string; type: string }>> {
  const found = new Map<string, { name: string; status: string; type: string }>();
  const clean = ids.filter((id) => /^\d+$/.test(id));
  if (clean.length === 0) return found;
  const rows = await googleSearch<RawCampaign>(
    workspace,
    account.info.id,
    `SELECT campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type FROM campaign WHERE campaign.id IN (${clean.join(", ")})`,
    { loginCustomerId: account.loginCustomerId }
  );
  for (const row of rows) {
    if (row.campaign?.id) {
      found.set(row.campaign.id, { name: row.campaign.name ?? row.campaign.id, status: row.campaign.status ?? "UNKNOWN", type: row.campaign.advertisingChannelType ?? "UNKNOWN" });
    }
  }
  return found;
}

export interface ExistingKeyword {
  text: string;
  match: MatchType;
  /** Grupul (la cuvintele pozitive). */
  group: string | null;
}

/** Cuvintele cheie POZITIVE active ale unor campanii, pe campanie. */
export async function readPositiveKeywords(
  workspace: AdsWorkspace,
  account: GoogleAccount,
  campaignIds: string[]
): Promise<Map<string, ExistingKeyword[]>> {
  const result = new Map<string, ExistingKeyword[]>();
  const clean = campaignIds.filter((id) => /^\d+$/.test(id));
  if (clean.length === 0) return result;
  const rows = await googleSearch<{
    campaign?: { id?: string };
    adGroup?: { name?: string };
    adGroupCriterion?: { keyword?: { text?: string; matchType?: string } };
  }>(
    workspace,
    account.info.id,
    `SELECT campaign.id, ad_group.name, ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type FROM ad_group_criterion WHERE ad_group_criterion.type = 'KEYWORD' AND ad_group_criterion.negative = FALSE AND ad_group_criterion.status != 'REMOVED' AND campaign.id IN (${clean.join(", ")})`,
    { loginCustomerId: account.loginCustomerId }
  );
  for (const row of rows) {
    const id = row.campaign?.id;
    const text = row.adGroupCriterion?.keyword?.text;
    const match = matchOf(row.adGroupCriterion?.keyword?.matchType);
    if (!id || !text || !match) continue;
    result.set(id, [...(result.get(id) ?? []), { text, match, group: row.adGroup?.name ?? null }]);
  }
  return result;
}

/** Negativele existente pe campanii (nivel de campanie), ca să nu le adăugăm a doua oară. */
export async function readCampaignNegatives(
  workspace: AdsWorkspace,
  account: GoogleAccount,
  campaignIds: string[]
): Promise<Map<string, ExistingKeyword[]>> {
  const result = new Map<string, ExistingKeyword[]>();
  const clean = campaignIds.filter((id) => /^\d+$/.test(id));
  if (clean.length === 0) return result;
  const rows = await googleSearch<{ campaign?: { id?: string }; campaignCriterion?: { keyword?: { text?: string; matchType?: string } } }>(
    workspace,
    account.info.id,
    `SELECT campaign.id, campaign_criterion.keyword.text, campaign_criterion.keyword.match_type FROM campaign_criterion WHERE campaign_criterion.type = 'KEYWORD' AND campaign_criterion.negative = TRUE AND campaign.id IN (${clean.join(", ")})`,
    { loginCustomerId: account.loginCustomerId }
  );
  for (const row of rows) {
    const id = row.campaign?.id;
    const text = row.campaignCriterion?.keyword?.text;
    const match = matchOf(row.campaignCriterion?.keyword?.matchType);
    if (!id || !text || !match) continue;
    result.set(id, [...(result.get(id) ?? []), { text, match, group: null }]);
  }
  return result;
}

/** Listele comune de negative active ale contului și campaniile de care sunt legate. */
export async function readNegativeLists(workspace: AdsWorkspace, account: GoogleAccount): Promise<NegativeListInfo[]> {
  const options = { loginCustomerId: account.loginCustomerId };
  const [sets, links] = await Promise.all([
    googleSearch<{ sharedSet?: { resourceName?: string; id?: string; name?: string; type?: string; status?: string; memberCount?: string } }>(
      workspace,
      account.info.id,
      "SELECT shared_set.resource_name, shared_set.id, shared_set.name, shared_set.type, shared_set.status, shared_set.member_count FROM shared_set WHERE shared_set.type = 'NEGATIVE_KEYWORDS' AND shared_set.status = 'ENABLED'",
      options
    ),
    googleSearch<{ campaign?: { id?: string }; sharedSet?: { id?: string } }>(
      workspace,
      account.info.id,
      "SELECT campaign.id, shared_set.id FROM campaign_shared_set WHERE campaign_shared_set.status = 'ENABLED'",
      options
    ).catch(() => []),
  ]);
  return sets
    .filter((row) => row.sharedSet?.id && row.sharedSet.type === "NEGATIVE_KEYWORDS")
    .map((row) => {
      const id = row.sharedSet?.id as string;
      return {
        id,
        resourceName: row.sharedSet?.resourceName ?? `customers/${account.info.id}/sharedSets/${id}`,
        name: row.sharedSet?.name ?? id,
        count: num(row.sharedSet?.memberCount),
        campaigns: links.filter((link) => link.sharedSet?.id === id && link.campaign?.id).map((link) => link.campaign?.id as string),
      };
    });
}

/** Cuvintele dintr-o listă comună. */
export async function readListKeywords(workspace: AdsWorkspace, account: GoogleAccount, listId: string): Promise<ExistingKeyword[]> {
  if (!/^\d+$/.test(listId)) return [];
  const rows = await googleSearch<{ sharedCriterion?: { keyword?: { text?: string; matchType?: string } } }>(
    workspace,
    account.info.id,
    `SELECT shared_set.id, shared_criterion.keyword.text, shared_criterion.keyword.match_type FROM shared_criterion WHERE shared_set.id = ${listId}`,
    { loginCustomerId: account.loginCustomerId }
  );
  return rows.flatMap((row) => {
    const text = row.sharedCriterion?.keyword?.text;
    const match = matchOf(row.sharedCriterion?.keyword?.matchType);
    return text && match ? [{ text, match, group: null }] : [];
  });
}

// ---------------------------------------------------------------------------
// Auditul
// ---------------------------------------------------------------------------

function blockError(error: unknown, what: string): { ok: false; message: string } {
  if (error instanceof GoogleAdsApiError) {
    if (error.has("USER_PERMISSION_DENIED") || error.has("SERVICE_ACCESS_DENIED") || error.info.status === 403) {
      return {
        ok: false,
        message: `Google nu lasă cheia să citească ${what} (${error.info.errors[0]?.code ?? `HTTP ${error.info.status}`}). De obicei cere acces de administrator în cont sau un nivel de acces API peste Explorer.`,
      };
    }
    return { ok: false, message: `Google n-a dat ${what}: ${error.info.errors[0]?.message ?? error.info.message}.` };
  }
  return { ok: false, message: `${what.charAt(0).toUpperCase()}${what.slice(1)} nu s-a putut citi.` };
}

const CHANGE_LIMIT = 10_000;

async function readChanges(workspace: AdsWorkspace, account: GoogleAccount): Promise<AuditBlock<{ items: AuditChange[]; from: string; to: string; truncated: boolean }>> {
  // Google: o fereastră de cel mult 30 de zile, în ultimele 30 de zile, și LIMIT obligatoriu.
  const to = todayInBucharest();
  const from = addDays(to, -29);
  try {
    const rows = await googleSearch<{
      changeEvent?: {
        changeDateTime?: string;
        userEmail?: string;
        clientType?: string;
        changeResourceType?: string;
        resourceChangeOperation?: string;
        changedFields?: string;
        campaign?: string;
      };
    }>(
      workspace,
      account.info.id,
      `SELECT change_event.change_date_time, change_event.user_email, change_event.client_type, change_event.change_resource_type, change_event.resource_change_operation, change_event.changed_fields, change_event.campaign FROM change_event WHERE change_event.change_date_time >= '${from}' AND change_event.change_date_time <= '${to} 23:59:59' ORDER BY change_event.change_date_time DESC LIMIT ${CHANGE_LIMIT}`,
      { loginCustomerId: account.loginCustomerId }
    );
    const items = rows.map((row) => ({
      at: row.changeEvent?.changeDateTime ?? "",
      user: row.changeEvent?.userEmail ?? null,
      client: row.changeEvent?.clientType ?? "UNKNOWN",
      resource: row.changeEvent?.changeResourceType ?? "UNKNOWN",
      operation: row.changeEvent?.resourceChangeOperation ?? "UNKNOWN",
      campaign: row.changeEvent?.campaign?.split("/").pop() ?? null,
      fields: row.changeEvent?.changedFields ?? null,
    }));
    return { ok: true, data: { items, from, to, truncated: items.length >= CHANGE_LIMIT } };
  } catch (error) {
    return blockError(error, "istoricul modificărilor (change_event)");
  }
}

async function readUsers(workspace: AdsWorkspace, account: GoogleAccount): Promise<AuditBlock<AuditUser[]>> {
  const options = { loginCustomerId: account.loginCustomerId };
  try {
    const [users, invitations] = await Promise.all([
      googleSearch<{
        customerUserAccess?: { emailAddress?: string; accessRole?: string; accessCreationDateTime?: string; inviterUserEmailAddress?: string };
      }>(
        workspace,
        account.info.id,
        "SELECT customer_user_access.user_id, customer_user_access.email_address, customer_user_access.access_role, customer_user_access.access_creation_date_time, customer_user_access.inviter_user_email_address FROM customer_user_access",
        options
      ),
      googleSearch<{ customerUserAccessInvitation?: { emailAddress?: string; accessRole?: string; creationDateTime?: string; invitationStatus?: string } }>(
        workspace,
        account.info.id,
        "SELECT customer_user_access_invitation.email_address, customer_user_access_invitation.access_role, customer_user_access_invitation.creation_date_time, customer_user_access_invitation.invitation_status FROM customer_user_access_invitation",
        options
      ).catch(() => []),
    ]);
    return {
      ok: true,
      data: [
        ...users.map((row) => ({
          email: row.customerUserAccess?.emailAddress ?? "—",
          role: row.customerUserAccess?.accessRole ?? "UNKNOWN",
          since: row.customerUserAccess?.accessCreationDateTime ?? null,
          inviter: row.customerUserAccess?.inviterUserEmailAddress ?? null,
          pending: false,
        })),
        ...invitations
          .filter((row) => row.customerUserAccessInvitation?.invitationStatus === "PENDING")
          .map((row) => ({
            email: row.customerUserAccessInvitation?.emailAddress ?? "—",
            role: row.customerUserAccessInvitation?.accessRole ?? "UNKNOWN",
            since: row.customerUserAccessInvitation?.creationDateTime ?? null,
            inviter: null,
            pending: true,
          })),
      ],
    };
  } catch (error) {
    return blockError(error, "utilizatorii contului (customer_user_access)");
  }
}

async function readBilling(workspace: AdsWorkspace, account: GoogleAccount): Promise<AuditBlock<AuditBilling>> {
  const options = { loginCustomerId: account.loginCustomerId };
  try {
    const [setups, budgets] = await Promise.all([
      googleSearch<{
        billingSetup?: {
          id?: string;
          status?: string;
          startDateTime?: string;
          endDateTime?: string;
          paymentsAccountInfo?: { paymentsAccountName?: string; paymentsProfileName?: string };
        };
      }>(
        workspace,
        account.info.id,
        "SELECT billing_setup.id, billing_setup.status, billing_setup.start_date_time, billing_setup.end_date_time, billing_setup.payments_account_info.payments_account_name, billing_setup.payments_account_info.payments_profile_name FROM billing_setup",
        options
      ),
      googleSearch<{
        accountBudget?: {
          status?: string;
          approvedSpendingLimitMicros?: string;
          approvedSpendingLimitType?: string;
          approvedStartDateTime?: string;
          approvedEndDateTime?: string;
          approvedEndTimeType?: string;
          amountServedMicros?: string;
        };
      }>(
        workspace,
        account.info.id,
        "SELECT account_budget.status, account_budget.approved_spending_limit_micros, account_budget.approved_spending_limit_type, account_budget.approved_start_date_time, account_budget.approved_end_date_time, account_budget.approved_end_time_type, account_budget.amount_served_micros FROM account_budget",
        options
      ).catch(() => []),
    ]);
    return {
      ok: true,
      data: {
        setups: setups.map((row) => ({
          id: row.billingSetup?.id ?? "—",
          status: row.billingSetup?.status ?? "UNKNOWN",
          account: row.billingSetup?.paymentsAccountInfo?.paymentsAccountName ?? null,
          profile: row.billingSetup?.paymentsAccountInfo?.paymentsProfileName ?? null,
          start: row.billingSetup?.startDateTime ?? null,
          end: row.billingSetup?.endDateTime ?? null,
        })),
        budgets: budgets.map((row) => ({
          status: row.accountBudget?.status ?? "UNKNOWN",
          limit:
            row.accountBudget?.approvedSpendingLimitType === "INFINITE"
              ? "fără limită"
              : row.accountBudget?.approvedSpendingLimitMicros
                ? String(micros(row.accountBudget.approvedSpendingLimitMicros))
                : "—",
          start: row.accountBudget?.approvedStartDateTime ?? null,
          end: row.accountBudget?.approvedEndTimeType === "FOREVER" ? "fără sfârșit" : (row.accountBudget?.approvedEndDateTime ?? null),
          served: row.accountBudget?.amountServedMicros ? micros(row.accountBudget.amountServedMicros) : null,
        })),
      },
    };
  } catch (error) {
    return blockError(error, "facturarea (billing_setup)");
  }
}

async function readConversions(workspace: AdsWorkspace, account: GoogleAccount): Promise<AuditBlock<AuditConversion[]>> {
  const options = { loginCustomerId: account.loginCustomerId };
  try {
    const [actions, counts] = await Promise.all([
      googleSearch<{ conversionAction?: { id?: string; name?: string; type?: string; category?: string; status?: string; primaryForGoal?: boolean } }>(
        workspace,
        account.info.id,
        "SELECT conversion_action.id, conversion_action.name, conversion_action.type, conversion_action.category, conversion_action.status, conversion_action.primary_for_goal FROM conversion_action WHERE conversion_action.status != 'REMOVED'",
        options
      ),
      // Conversiile pe acțiune se segmentează din `customer` (din `conversion_action` nu se poate cere metrics.conversions).
      googleSearch<{ segments?: { conversionAction?: string }; metrics?: { conversions?: number | string } }>(
        workspace,
        account.info.id,
        "SELECT segments.conversion_action, metrics.conversions FROM customer WHERE segments.date DURING LAST_30_DAYS",
        options
      ).catch(() => []),
    ]);
    const byAction = new Map<string, number>();
    for (const row of counts) {
      const id = row.segments?.conversionAction?.split("/").pop();
      if (id) byAction.set(id, (byAction.get(id) ?? 0) + num(row.metrics?.conversions));
    }
    return {
      ok: true,
      data: actions
        .filter((row) => row.conversionAction?.id)
        .map((row) => ({
          id: row.conversionAction?.id as string,
          name: row.conversionAction?.name ?? "—",
          type: row.conversionAction?.type ?? "—",
          category: row.conversionAction?.category ?? "—",
          status: row.conversionAction?.status ?? "—",
          primary: row.conversionAction?.primaryForGoal !== false,
          conversions30: Math.round((byAction.get(row.conversionAction?.id as string) ?? 0) * 100) / 100,
        })),
    };
  } catch (error) {
    return blockError(error, "acțiunile de conversie");
  }
}

/**
 * Auditul contului (doar citire): cine a schimbat ce în ultimele 30 de zile,
 * cine are acces, facturarea, conversiile — și semnalele care merită o privire.
 * `knownAdmins` = adresele adminilor portalului și contul de serviciu.
 */
export async function readAudit(
  workspace: AdsWorkspace,
  account: GoogleAccount,
  input: { knownAdmins: string[]; campaigns: AccountCampaign[]; currency: string }
): Promise<AccountAudit> {
  const [changes, users, billing, conversions] = await Promise.all([
    readChanges(workspace, account),
    readUsers(workspace, account),
    readBilling(workspace, account),
    readConversions(workspace, account),
  ]);
  return {
    changes,
    users,
    billing,
    conversions,
    signals: buildSignals({ changes, users, billing, conversions, campaigns: input.campaigns, knownAdmins: input.knownAdmins, currency: input.currency }),
  };
}
