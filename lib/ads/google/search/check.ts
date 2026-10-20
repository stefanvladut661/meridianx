import "server-only";

import { planFingerprint } from "../../fingerprint";
import { portalCampaignsByName } from "../../store";
import type { PlanProblem } from "../../plan-validate";
import type { ResolvedName } from "../../types";
import type { AdsWorkspace } from "../../workspaces";
import { workspaceName } from "../../workspaces";
import { GoogleAdsApiError, customerDigits, googleMutate, googleSearch, serviceAccountEmail } from "../api";
import { findGoogleAccount, listConversionActions, type GoogleAccount } from "../lookup";
import { resolveLanguages, resolveLocations } from "../targeting";
import { buildSearchOperations, type SearchOperations } from "./build";
import type { SearchPlan } from "./schema";
import { readKeywordVolumes } from "./planner";
import type { SearchCheck, SearchVolumes } from "./types";
import { checkUrls } from "./urls";

/**
 * „Verifică în Google” pentru un plan de căutare — și din nou, pe server,
 * chiar în acțiunea de creare.
 *
 * Ce verifică: că cheia vede contul (direct sau prin managerul MCC) și că
 * moneda e cea din plan; că numele campaniilor și ale listelor comune nu
 * există deja în cont; că acțiunile de conversie ale butoanelor de apel există
 * și sunt active; ce înseamnă fiecare locație și limbă; cum răspund adresele
 * finale. La final, TOT planul pleacă la Google cu `validateOnly`: Google spune
 * ce ar refuza, cu locul exact, fără să creeze nimic.
 */

export interface SearchCheckContext {
  check: SearchCheck;
  account: GoogleAccount | null;
  /** Planul cu cheile locațiilor completate — exact ce se creează. */
  plan: SearchPlan;
  /** Operațiile exact cum vor pleca la creare (după o verificare fără erori). */
  operations: SearchOperations | null;
}

/** Un text pus într-o interogare GAQL, între apostrofuri. */
function gaql(value: string): string {
  return `'${value.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
}

/** O eroare Google pe operația N, mutată pe câmpul din plan care a produs-o. */
function problemsFrom(error: GoogleAdsApiError, operations: SearchOperations): PlanProblem[] {
  if (error.info.errors.length === 0) {
    return [{ path: "", message: `Google a refuzat planul: ${error.info.message}${error.info.requestId ? ` (request ${error.info.requestId})` : ""}` }];
  }
  const shown = error.info.errors.slice(0, 25).map((item) => {
    const role = item.operationIndex !== null ? operations.roles[item.operationIndex] : undefined;
    return {
      path: role?.planPath ?? "",
      message: `Google refuză ${role ? role.label : "planul"}: ${item.message || item.code}${item.trigger ? ` („${item.trigger}”)` : ""}. (${item.code})`,
    };
  });
  if (error.info.errors.length > shown.length) {
    shown.push({ path: "", message: `Și încă ${error.info.errors.length - shown.length} refuzuri de același fel — corectează-le pe acestea și verifică din nou.` });
  }
  return shown;
}

/**
 * `volumes`: și volumele din Keyword Planner (doar la „Verifică în Google”; la
 * verificarea refăcută de creare nu — nu schimbă ce se creează).
 */
export async function checkSearchOnGoogle(workspace: AdsWorkspace, input: SearchPlan, wanted: { volumes?: boolean } = {}): Promise<SearchCheckContext> {
  const plan: SearchPlan = structuredClone(input);
  const errors: PlanProblem[] = [];
  const warnings: PlanProblem[] = [];
  const customerId = customerDigits(plan.ad_account);
  const checkedAt = new Date().toISOString();
  const empty = (account: SearchCheck["account"]): SearchCheckContext => ({
    check: {
      ok: false,
      fingerprint: planFingerprint({ workspace: workspace.id, account: customerId, plan }),
      checkedAt,
      account,
      manager: null,
      operations: 0,
      campaigns: [],
      callConversions: [],
      urls: [],
      volumes: null,
      errors,
      warnings,
    },
    account: null,
    plan,
    operations: null,
  });

  // Contul întâi: fără el, nicio altă citire nu are sens.
  const account = await findGoogleAccount(workspace, customerId);
  if (!account) {
    const email = serviceAccountEmail(workspace);
    errors.push({
      path: "ad_account",
      message: `Cheia spațiului ${workspaceName(workspace)} nu vede contul Google Ads ${customerId}. ${
        email ? `Adaugă contul de serviciu ${email}` : "Adaugă contul de serviciu"
      } în Google Ads → Admin → Acces și securitate → Utilizatori (nivel „Standard”) — în contul ăsta sau în contul manager (MCC) de deasupra lui.`,
    });
    return empty(null);
  }
  if (account.manager) {
    errors.push({ path: "ad_account", message: `${account.info.name} e un cont manager (MCC): Google nu pune campanii în el. Scrie în plan contul clientului de sub manager.` });
  } else if (!account.info.usable) {
    errors.push({ path: "ad_account", message: `Contul ${account.info.name} e ${account.info.state}: Google nu livrează din el. Rezolvă starea contului în Google Ads.` });
  }
  if (account.info.currency !== plan.currency) {
    errors.push({
      path: "currency",
      message: `Contul ${account.info.name} plătește în ${account.info.currency}, iar planul spune ${plan.currency}. Bugetele s-ar citi în altă monedă — corectează moneda și verifică sumele.`,
    });
  }
  if (errors.length > 0) return { ...empty(account.info), account };

  const options = { loginCustomerId: account.loginCustomerId };
  const campaignNames = plan.campaigns.map((campaign) => campaign.name.trim());
  const listNames = plan.shared_negative_lists.map((list) => list.name.trim());
  const callIds = [...new Set(plan.campaigns.flatMap((campaign) => (campaign.assets.call?.conversion_action_id ? [campaign.assets.call.conversion_action_id] : [])))];
  const urls = [
    ...plan.campaigns.flatMap((campaign) => [
      ...campaign.ad_groups.flatMap((group) => [group.final_url, ...group.ads.flatMap((ad) => (ad.final_url ? [ad.final_url] : []))]),
      ...campaign.assets.sitelinks.map((sitelink) => sitelink.url),
    ]),
  ];
  const cache = new Map();

  const [existingCampaigns, existingLists, conversions, urlChecks, places] = await Promise.all([
    googleSearch<{ campaign?: { name?: string; status?: string } }>(
      workspace,
      account.info.id,
      `SELECT campaign.name, campaign.status FROM campaign WHERE campaign.name IN (${campaignNames.map(gaql).join(", ")}) AND campaign.status != 'REMOVED'`,
      options
    ),
    listNames.length > 0
      ? googleSearch<{ sharedSet?: { name?: string; type?: string } }>(
          workspace,
          account.info.id,
          `SELECT shared_set.name, shared_set.type, shared_set.status FROM shared_set WHERE shared_set.name IN (${listNames.map(gaql).join(", ")}) AND shared_set.status = 'ENABLED'`,
          options
        )
      : Promise.resolve([]),
    callIds.length > 0 ? listConversionActions(workspace, account) : Promise.resolve([]),
    checkUrls(urls),
    // Locațiile, pe rând (aceeași regiune în mai multe campanii se caută o dată).
    (async () => {
      const resolved = [];
      for (const [index, campaign] of plan.campaigns.entries()) {
        const included = await resolveLocations(workspace, campaign.locations, `campaigns.${index}.locations`, { cache });
        const excluded = await resolveLocations(workspace, campaign.excluded_locations, `campaigns.${index}.excluded_locations`, { cache });
        const languages = await resolveLanguages(workspace, account, campaign.languages, `campaigns.${index}.languages`);
        resolved.push({ included, excluded, languages });
      }
      return resolved;
    })(),
  ]);

  // Numele deja folosite în cont ---------------------------------------------------------
  const takenCampaigns = new Map(existingCampaigns.map((row) => [row.campaign?.name ?? "", row.campaign?.status ?? ""]));
  const fromPortal = takenCampaigns.size > 0 ? await portalCampaignsByName(account.info.id, [...takenCampaigns.keys()]) : new Map<string, string>();
  plan.campaigns.forEach((campaign, index) => {
    const status = takenCampaigns.get(campaign.name.trim());
    if (status === undefined) return;
    const created = fromPortal.get(campaign.name.trim());
    errors.push({
      path: `campaigns.${index}.name`,
      message: created
        ? `Campania „${campaign.name}” e deja în cont (${status === "PAUSED" ? "pe pauză" : "activă"}), creată din portal pe ${new Intl.DateTimeFormat("ro-RO", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Bucharest" }).format(new Date(created))} — din planul ăsta sau dintr-unul cu același nume. Nu se creează a doua oară; pentru o campanie nouă, schimbă numele.`
        : `Contul are deja o campanie „${campaign.name}” (${status === "PAUSED" ? "pe pauză" : "activă"}). Google cere nume unice: redenumește campania din plan — de exemplu cu luna sau „v2”.`,
    });
  });
  const takenLists = new Set(existingLists.map((row) => row.sharedSet?.name ?? ""));
  plan.shared_negative_lists.forEach((list, index) => {
    if (takenLists.has(list.name.trim())) {
      errors.push({
        path: `shared_negative_lists.${index}.name`,
        message: `Contul are deja o listă comună „${list.name}”. Redenumește lista din plan; o listă existentă se leagă de campanii din „Cont” → „Negative”.`,
      });
    }
  });

  // Butoanele de apel ---------------------------------------------------------------------------
  const callConversions: SearchCheck["callConversions"] = [];
  for (const id of callIds) {
    const action = conversions.find((item) => item.id === id);
    const paths = plan.campaigns.flatMap((campaign, index) => (campaign.assets.call?.conversion_action_id === id ? [`campaigns.${index}.assets.call.conversion_action_id`] : []));
    if (!action) {
      errors.push({
        path: paths[0] ?? "",
        message: `Contul nu are acțiunea de conversie ${id} (activă). ${
          conversions.length > 0
            ? `Acțiunile lui: ${conversions.slice(0, 6).map((item) => `${item.name} (${item.id}, ${item.type})`).join(", ")}.`
            : "Creeaz-o din „Conversii”."
        }`,
      });
      continue;
    }
    const isCall = action.type === "AD_CALL";
    callConversions.push({ id, name: action.name, type: action.type, ok: isCall });
    if (!isCall) {
      warnings.push({
        path: paths[0] ?? "",
        message: `Acțiunea „${action.name}” e de tipul ${action.type}, nu „apeluri din anunțuri” (AD_CALL): apelurile de pe butonul de apel s-ar număra pe o acțiune făcută pentru altceva.`,
      });
    }
  }

  // Adresele -----------------------------------------------------------------------------------
  for (const check of urlChecks) {
    if (check.verdict === "ok") continue;
    const path = findUrlPath(plan, check.url);
    (check.verdict === "error" ? errors : warnings).push({ path, message: `${check.url}: ${check.status ?? "fără răspuns"} — ${check.note ?? "verific-o în browser."}` });
  }

  // Locațiile și limbile ----------------------------------------------------------------------------
  const campaigns: SearchCheck["campaigns"] = plan.campaigns.map((campaign, index) => {
    const resolved = places[index];
    errors.push(...resolved.included.errors, ...resolved.excluded.errors, ...resolved.languages.errors);
    warnings.push(...resolved.included.warnings, ...resolved.excluded.warnings);
    if (new Set(resolved.included.geoTargets).size !== resolved.included.geoTargets.length) {
      errors.push({ path: `campaigns.${index}.locations`, message: `Campania „${campaign.name}”: două locații din plan sunt, pentru Google, aceeași locație.` });
    }
    const overlap = resolved.excluded.geoTargets.filter((geo) => resolved.included.geoTargets.includes(geo));
    if (overlap.length > 0) {
      errors.push({ path: `campaigns.${index}.excluded_locations`, message: `Campania „${campaign.name}”: o locație e și țintită, și exclusă.` });
    }
    return {
      key: campaign.key,
      name: campaign.name,
      locations: resolved.included.names,
      excluded: resolved.excluded.names,
      languages: resolved.languages.names as ResolvedName[],
    };
  });

  // Google însuși: tot planul, cu validateOnly ------------------------------------------------------
  const context = {
    customerId: account.info.id,
    campaigns: places.map((resolved) => ({
      geoTargets: resolved.included.geoTargets,
      excludedGeoTargets: resolved.excluded.geoTargets,
      languageConstants: resolved.languages.languageConstants,
    })),
    uniqueSuffix: Date.now().toString(36),
  };
  let operations: SearchOperations | null = null;
  let count = 0;
  const volumesRead: Promise<SearchVolumes | null> = wanted.volumes
    ? readKeywordVolumes(workspace, account, plan, context.campaigns).catch(() => ({ error: "Keyword Planner n-a răspuns." }))
    : Promise.resolve(null);
  if (errors.length === 0) {
    operations = buildSearchOperations(plan, context);
    count = operations.operations.length;
    try {
      await googleMutate(workspace, account.info.id, operations.operations, { validateOnly: true, loginCustomerId: account.loginCustomerId });
    } catch (error) {
      if (!(error instanceof GoogleAdsApiError) || error.info.status === 0 || error.info.status >= 500 || error.info.status === 401) throw error;
      errors.push(...problemsFrom(error, operations));
    }
  }
  const volumes = await volumesRead;

  const check: SearchCheck = {
    ok: errors.length === 0,
    fingerprint: planFingerprint({
      workspace: workspace.id,
      account: account.info.id,
      plan,
      geo: context.campaigns,
      calls: callConversions.map((item) => item.id),
    }),
    checkedAt,
    account: account.info,
    manager: account.loginCustomerId,
    operations: count,
    campaigns,
    callConversions,
    urls: urlChecks,
    volumes,
    errors,
    warnings,
  };
  return { check, account, plan, operations: errors.length === 0 ? operations : null };
}

/** Calea din plan a primei adrese egale cu `url` — ca eroarea să ducă la ea. */
function findUrlPath(plan: SearchPlan, url: string): string {
  for (const [campaignIndex, campaign] of plan.campaigns.entries()) {
    for (const [groupIndex, group] of campaign.ad_groups.entries()) {
      if (group.final_url === url) return `campaigns.${campaignIndex}.ad_groups.${groupIndex}.final_url`;
      for (const [adIndex, ad] of group.ads.entries()) {
        if (ad.final_url === url) return `campaigns.${campaignIndex}.ad_groups.${groupIndex}.ads.${adIndex}.final_url`;
      }
    }
    for (const [index, sitelink] of campaign.assets.sitelinks.entries()) {
      if (sitelink.url === url) return `campaigns.${campaignIndex}.assets.sitelinks.${index}.url`;
    }
  }
  return "";
}
