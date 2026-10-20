import { utmQuery } from "../../plan-derive";
import { GOOGLE_PAUSED } from "../../meta/paused";
import { EU_POLITICAL_NONE, toMicros } from "../build";
import {
  GOOGLE_DAY,
  GOOGLE_LOCATION_MODE,
  GOOGLE_MATCH_TYPE,
  SCHEDULE_MINUTES,
  snippetHeaderText,
} from "./limits";
import { checkPhone } from "./phone";
import type { SearchKeyword, SearchPlan, SearchSchedule } from "./schema";
import { cleanText } from "./text";

/**
 * Planul de căutare tradus în operațiile `googleAds:mutate` (Google Ads API
 * v26) — SINGURUL loc care construiește ce pleacă spre Google pentru căutare.
 *
 * O singură cerere, atomică, cu id-uri temporare (negative). Ordinea respectă
 * dependențele: o resursă se creează înaintea celor care o folosesc.
 *
 *   1. listele comune de negative și cuvintele lor;
 *   2. pe fiecare campanie: bugetul → campania (SEARCH, OPRITĂ) → criteriile
 *      campaniei (locații, excluderi, limbi, program, negative) → legarea
 *      listelor comune → grupurile (OPRITE) → cuvintele cheie și negativele
 *      grupurilor → anunțurile responsive (OPRITE);
 *   3. materialele (linkuri suplimentare, mesaje scurte, fragmente
 *      structurate, buton de apel), o singură dată fiecare, apoi legate de
 *      campaniile care le folosesc.
 *
 * Statusul vine dintr-o singură constantă (`PAUSED`) pe campanii, grupuri și
 * anunțuri. Criteriile, listele și legăturile pleacă FĂRĂ status. Fișierul e
 * pur și izomorf: previzualizarea îl folosește ca să numere operațiile, iar
 * `googleMutate` verifică oricum tot cu garda.
 */

export interface SearchBuildContext {
  /** Contul, doar cifre. */
  customerId: string;
  /** Pe campanie, în ordinea din plan: constantele locațiilor și limbilor, deja rezolvate. */
  campaigns: Array<{ geoTargets: string[]; excludedGeoTargets: string[]; languageConstants: string[] }>;
  /** Sufix unic pentru numele bugetelor (Google cere nume unice în cont). */
  uniqueSuffix: string;
}

export type SearchRoleKind =
  | "shared_set"
  | "shared_criterion"
  | "budget"
  | "campaign"
  | "campaign_criterion"
  | "campaign_negative"
  | "campaign_shared_set"
  | "ad_group"
  | "keyword"
  | "ad_group_negative"
  | "ad"
  | "asset"
  | "campaign_asset";

/** Ce reprezintă fiecare operație — o eroare Google pe operația N ajunge pe câmpul din plan. */
export interface SearchOperationRole {
  kind: SearchRoleKind;
  label: string;
  planPath: string | null;
  /** Campania din plan (`key`) de care ține operația; null pentru listele comune și materiale. */
  campaignKey: string | null;
}

export interface SearchOperations {
  operations: Array<Record<string, unknown>>;
  roles: SearchOperationRole[];
}

/** „07:30” → 7 și `THIRTY`; „24:00” → 24 și `ZERO`. */
export function scheduleTime(value: string): { hour: number; minute: string } | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]) as keyof typeof SCHEDULE_MINUTES;
  const name = SCHEDULE_MINUTES[minute];
  if (!name || hour > 24 || (hour === 24 && minute !== 0)) return null;
  return { hour, minute: name };
}

function keywordInfo(keyword: SearchKeyword) {
  return { text: cleanText(keyword.text), matchType: GOOGLE_MATCH_TYPE[keyword.match] };
}

function scheduleCriteria(item: SearchSchedule) {
  const from = scheduleTime(item.from);
  const to = scheduleTime(item.to);
  if (!from || !to) return [];
  return item.days.map((day) => ({
    day,
    adSchedule: {
      dayOfWeek: GOOGLE_DAY[day],
      startHour: from.hour,
      startMinute: from.minute,
      endHour: to.hour,
      endMinute: to.minute,
    },
  }));
}

export function buildSearchOperations(plan: SearchPlan, context: SearchBuildContext): SearchOperations {
  const cid = context.customerId;
  const operations: Array<Record<string, unknown>> = [];
  const roles: SearchOperationRole[] = [];
  const push = (operation: Record<string, unknown>, role: SearchOperationRole) => {
    operations.push(operation);
    roles.push(role);
  };
  let nextId = -1;
  const temp = (collection: string) => `customers/${cid}/${collection}/${nextId--}`;

  // 1. Listele comune de negative ----------------------------------------------------------
  const sharedSets = new Map<string, string>();
  plan.shared_negative_lists.forEach((list, listIndex) => {
    const sharedSet = temp("sharedSets");
    sharedSets.set(list.key, sharedSet);
    push(
      { sharedSetOperation: { create: { resourceName: sharedSet, name: cleanText(list.name), type: "NEGATIVE_KEYWORDS" } } },
      { kind: "shared_set", label: `lista „${list.name}”`, planPath: `shared_negative_lists.${listIndex}.name`, campaignKey: null }
    );
    list.keywords.forEach((keyword, keywordIndex) =>
      push(
        { sharedCriterionOperation: { create: { sharedSet, keyword: keywordInfo(keyword) } } },
        {
          kind: "shared_criterion",
          label: `negativul „${keyword.text}” din lista „${list.name}”`,
          planPath: `shared_negative_lists.${listIndex}.keywords.${keywordIndex}`,
          campaignKey: null,
        }
      )
    );
  });

  // 2. Campaniile ---------------------------------------------------------------------------
  const campaignNames = new Map<string, string>();
  plan.campaigns.forEach((campaign, campaignIndex) => {
    const at = `campaigns.${campaignIndex}`;
    const own = context.campaigns[campaignIndex] ?? { geoTargets: [], excludedGeoTargets: [], languageConstants: [] };
    const named = `„${campaign.name}”`;
    const role = (kind: SearchRoleKind, label: string, planPath: string | null): SearchOperationRole => ({
      kind,
      label,
      planPath,
      campaignKey: campaign.key,
    });

    const budget = temp("campaignBudgets");
    push(
      {
        campaignBudgetOperation: {
          create: {
            resourceName: budget,
            name: `${cleanText(campaign.name)} · buget · ${context.uniqueSuffix}`,
            amountMicros: toMicros(campaign.daily_budget),
            deliveryMethod: "STANDARD",
            period: "DAILY",
            explicitlyShared: false,
          },
        },
      },
      role("budget", `bugetul campaniei ${named}`, `${at}.daily_budget`)
    );

    const resource = temp("campaigns");
    campaignNames.set(campaign.key, resource);
    const suffix = utmQuery(campaign.utm ?? null);
    const cap = campaign.bidding.max_cpc;
    push(
      {
        campaignOperation: {
          create: {
            resourceName: resource,
            name: cleanText(campaign.name),
            status: GOOGLE_PAUSED,
            advertisingChannelType: "SEARCH",
            campaignBudget: budget,
            networkSettings: {
              targetGoogleSearch: true,
              targetSearchNetwork: campaign.networks.search_partners,
              targetContentNetwork: campaign.networks.display,
              targetPartnerSearchNetwork: false,
            },
            ...(campaign.bidding.strategy === "maximize_clicks"
              ? { targetSpend: cap ? { cpcBidCeilingMicros: toMicros(cap) } : {} }
              : { manualCpc: { enhancedCpcEnabled: false } }),
            geoTargetTypeSetting: {
              positiveGeoTargetType: GOOGLE_LOCATION_MODE[campaign.location_mode],
              negativeGeoTargetType: "PRESENCE",
            },
            containsEuPoliticalAdvertising: EU_POLITICAL_NONE,
            ...(suffix ? { finalUrlSuffix: suffix } : {}),
          },
        },
      },
      role("campaign", `campania ${named}`, at)
    );

    // Criteriile campaniei — fără status (active: publicul rămâne cel din plan).
    own.geoTargets.forEach((geoTargetConstant, index) =>
      push(
        { campaignCriterionOperation: { create: { campaign: resource, location: { geoTargetConstant } } } },
        role("campaign_criterion", `locația ${index + 1} a campaniei ${named}`, `${at}.locations.${index}`)
      )
    );
    own.excludedGeoTargets.forEach((geoTargetConstant, index) =>
      push(
        { campaignCriterionOperation: { create: { campaign: resource, negative: true, location: { geoTargetConstant } } } },
        role("campaign_criterion", `locația exclusă ${index + 1} a campaniei ${named}`, `${at}.excluded_locations.${index}`)
      )
    );
    own.languageConstants.forEach((languageConstant, index) =>
      push(
        { campaignCriterionOperation: { create: { campaign: resource, language: { languageConstant } } } },
        role("campaign_criterion", `limba ${index + 1} a campaniei ${named}`, `${at}.languages.${index}`)
      )
    );
    campaign.schedule.forEach((item, index) =>
      scheduleCriteria(item).forEach(({ adSchedule }) =>
        push(
          { campaignCriterionOperation: { create: { campaign: resource, adSchedule } } },
          role("campaign_criterion", `programul ${index + 1} al campaniei ${named}`, `${at}.schedule.${index}`)
        )
      )
    );
    campaign.negatives.forEach((keyword, index) =>
      push(
        { campaignCriterionOperation: { create: { campaign: resource, negative: true, keyword: keywordInfo(keyword) } } },
        role("campaign_negative", `negativul „${keyword.text}” al campaniei ${named}`, `${at}.negatives.${index}`)
      )
    );
    campaign.negative_lists.forEach((key, index) => {
      const sharedSet = sharedSets.get(key);
      if (!sharedSet) return; // validarea refuză o cheie necunoscută
      push(
        { campaignSharedSetOperation: { create: { campaign: resource, sharedSet } } },
        role("campaign_shared_set", `legarea listei „${key}” de campania ${named}`, `${at}.negative_lists.${index}`)
      );
    });

    // Grupurile, cuvintele și anunțurile.
    campaign.ad_groups.forEach((group, groupIndex) => {
      const groupAt = `${at}.ad_groups.${groupIndex}`;
      const adGroup = temp("adGroups");
      const groupSuffix = utmQuery(group.utm ?? null);
      const bid = campaign.bidding.strategy === "manual_cpc" ? (group.max_cpc ?? campaign.bidding.max_cpc) : undefined;
      push(
        {
          adGroupOperation: {
            create: {
              resourceName: adGroup,
              name: cleanText(group.name),
              campaign: resource,
              status: GOOGLE_PAUSED,
              type: "SEARCH_STANDARD",
              ...(bid ? { cpcBidMicros: toMicros(bid) } : {}),
              ...(groupSuffix ? { finalUrlSuffix: groupSuffix } : {}),
            },
          },
        },
        role("ad_group", `grupul „${group.name}”`, groupAt)
      );
      group.keywords.forEach((keyword, index) =>
        push(
          { adGroupCriterionOperation: { create: { adGroup, keyword: keywordInfo(keyword) } } },
          role("keyword", `cuvântul cheie „${keyword.text}” din grupul „${group.name}”`, `${groupAt}.keywords.${index}`)
        )
      );
      group.negatives.forEach((keyword, index) =>
        push(
          { adGroupCriterionOperation: { create: { adGroup, negative: true, keyword: keywordInfo(keyword) } } },
          role("ad_group_negative", `negativul „${keyword.text}” din grupul „${group.name}”`, `${groupAt}.negatives.${index}`)
        )
      );
      group.ads.forEach((ad, adIndex) => {
        const finalUrl = ad.final_url ?? group.final_url;
        push(
          {
            adGroupAdOperation: {
              create: {
                adGroup,
                status: GOOGLE_PAUSED,
                ad: {
                  finalUrls: [finalUrl],
                  responsiveSearchAd: {
                    headlines: ad.headlines.map((headline) => ({
                      text: cleanText(headline.text),
                      ...(headline.pin ? { pinnedField: `HEADLINE_${headline.pin}` } : {}),
                    })),
                    descriptions: ad.descriptions.map((description) => ({
                      text: cleanText(description.text),
                      ...(description.pin ? { pinnedField: `DESCRIPTION_${description.pin}` } : {}),
                    })),
                    ...(ad.path1 ? { path1: cleanText(ad.path1) } : {}),
                    ...(ad.path2 ? { path2: cleanText(ad.path2) } : {}),
                  },
                },
              },
            },
          },
          role("ad", `anunțul ${adIndex + 1} din grupul „${group.name}”`, `${groupAt}.ads.${adIndex}`)
        );
      });
    });
  });

  // 3. Materialele: o singură dată fiecare, legate de toate campaniile care le folosesc ------
  const assets = new Map<string, string>();
  const links: Array<{ campaignKey: string; campaignIndex: number; asset: string; fieldType: string; label: string; planPath: string }> = [];
  const asset = (key: string, create: Record<string, unknown>, label: string, planPath: string): string => {
    const existing = assets.get(key);
    if (existing) return existing;
    const resourceName = temp("assets");
    assets.set(key, resourceName);
    push({ assetOperation: { create: { resourceName, ...create } } }, { kind: "asset", label, planPath, campaignKey: null });
    return resourceName;
  };

  plan.campaigns.forEach((campaign, campaignIndex) => {
    const at = `campaigns.${campaignIndex}.assets`;
    const linked = new Set<string>();
    const link = (resourceName: string, fieldType: string, label: string, planPath: string) => {
      const key = `${resourceName}|${fieldType}`;
      if (linked.has(key)) return;
      linked.add(key);
      links.push({ campaignKey: campaign.key, campaignIndex, asset: resourceName, fieldType, label, planPath });
    };

    campaign.assets.sitelinks.forEach((sitelink, index) => {
      const info = {
        linkText: cleanText(sitelink.text),
        ...(sitelink.description1 ? { description1: cleanText(sitelink.description1) } : {}),
        ...(sitelink.description2 ? { description2: cleanText(sitelink.description2) } : {}),
      };
      const name = asset(
        `sitelink|${JSON.stringify(info)}|${sitelink.url}`,
        { finalUrls: [sitelink.url], sitelinkAsset: info },
        `linkul suplimentar „${sitelink.text}”`,
        `${at}.sitelinks.${index}`
      );
      link(name, "SITELINK", `linkul suplimentar „${sitelink.text}”`, `${at}.sitelinks.${index}`);
    });
    campaign.assets.callouts.forEach((callout, index) => {
      const text = cleanText(callout);
      const name = asset(`callout|${text}`, { calloutAsset: { calloutText: text } }, `mesajul scurt „${callout}”`, `${at}.callouts.${index}`);
      link(name, "CALLOUT", `mesajul scurt „${callout}”`, `${at}.callouts.${index}`);
    });
    campaign.assets.snippets.forEach((snippet, index) => {
      const info = { header: snippetHeaderText(snippet.header, campaign.languages), values: snippet.values.map(cleanText) };
      const name = asset(
        `snippet|${JSON.stringify(info)}`,
        { structuredSnippetAsset: info },
        `fragmentul structurat ${index + 1}`,
        `${at}.snippets.${index}`
      );
      link(name, "STRUCTURED_SNIPPET", `fragmentul structurat ${index + 1}`, `${at}.snippets.${index}`);
    });
    const call = campaign.assets.call;
    if (call) {
      const phone = checkPhone(call.country, call.phone);
      const info = {
        countryCode: call.country,
        phoneNumber: phone.ok ? phone.national : call.phone,
        ...(call.conversion_action_id
          ? {
              callConversionReportingState: "USE_RESOURCE_LEVEL_CALL_CONVERSION_ACTION",
              callConversionAction: `customers/${cid}/conversionActions/${call.conversion_action_id}`,
            }
          : { callConversionReportingState: "USE_ACCOUNT_LEVEL_CALL_CONVERSION_ACTION" }),
      };
      const name = asset(`call|${JSON.stringify(info)}`, { callAsset: info }, "butonul de apel", `${at}.call`);
      link(name, "CALL", "butonul de apel", `${at}.call`);
    }
  });

  for (const item of links) {
    const campaign = campaignNames.get(item.campaignKey);
    if (!campaign) continue;
    push(
      { campaignAssetOperation: { create: { campaign, asset: item.asset, fieldType: item.fieldType } } },
      {
        kind: "campaign_asset",
        label: `legarea: ${item.label} → campania „${plan.campaigns[item.campaignIndex]?.name ?? item.campaignKey}”`,
        planPath: item.planPath,
        campaignKey: item.campaignKey,
      }
    );
  }

  return { operations, roles };
}

/**
 * Câte operații ar trimite planul — fără să rezolve nimic la Google:
 * fiecare locație și limbă din plan e câte o constantă. Pentru
 * previzualizare și pentru limita de operații pe cerere.
 */
export function countSearchOperations(plan: SearchPlan): number {
  return buildSearchOperations(plan, {
    customerId: "0000000000",
    campaigns: plan.campaigns.map((campaign) => ({
      geoTargets: campaign.locations.map(() => "geoTargetConstants/0"),
      excludedGeoTargets: campaign.excluded_locations.map(() => "geoTargetConstants/0"),
      languageConstants: campaign.languages.map(() => "languageConstants/0"),
    })),
    uniqueSuffix: "numărătoare",
  }).operations.length;
}
