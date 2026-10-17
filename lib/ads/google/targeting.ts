import "server-only";

import { COUNTRY_LABEL } from "../constants";
import type { Plan } from "../plan-schema";
import type { PlanProblem } from "../plan-validate";
import type { ResolvedName } from "../types";
import type { AdsWorkspace } from "../workspaces";
import { googleReadPost, googleSearch } from "./api";
import type { GoogleAccount } from "./lookup";

/**
 * Numele din plan traduse în constantele Google: locații (geo target
 * constants), limbi (language constants), interese (segmentele de public
 * Google — affinity și in-market).
 *
 * Țările au id fix (2000 + codul numeric ISO: România = 2642); orașele și
 * regiunile se caută cu `geoTargetConstants:suggest`, iar potrivirea e
 * exactă (fără diacritice, fără majuscule). Un nume negăsit e o eroare, nu
 * se sare — ar lărgi publicul. Ce are deja `key` / `id` în plan nu se caută.
 */

export interface GoogleTargeting {
  /** Planul cu cheile completate — exact ce intră în grupul de anunțuri. */
  plan: Plan;
  /** `geoTargetConstants/2642`, în ordinea din plan. */
  geoTargets: string[];
  /** `languageConstants/1032`. */
  languageConstants: string[];
  /** Id-urile segmentelor de interes (`user_interest`). */
  interestIds: string[];
  locations: ResolvedName[];
  languages: ResolvedName[];
  interests: ResolvedName[];
  errors: PlanProblem[];
  warnings: PlanProblem[];
}

/** Id-urile Google ale țărilor: 2000 + codul numeric ISO 3166-1. */
const COUNTRY_GEO: Record<string, string> = {
  RO: "2642",
  MD: "2498",
  HU: "2348",
  BG: "2100",
  DE: "2276",
  AT: "2040",
  IT: "2380",
  ES: "2724",
  FR: "2250",
  GB: "2826",
};

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\b(judetul|county|municipiul|province)\b/g, "")
    .replace(/[-–]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

interface RawSuggestion {
  geoTargetConstant?: {
    resourceName?: string;
    id?: string;
    name?: string;
    countryCode?: string;
    targetType?: string;
    status?: string;
    canonicalName?: string;
  };
}

const CITY_TYPES = new Set(["City", "Municipality", "Borough", "Neighborhood"]);
const REGION_TYPES = new Set(["County", "Region", "Province", "State", "Department", "Prefecture", "Autonomous Community"]);

async function suggest(workspace: AdsWorkspace, name: string, country: string): Promise<RawSuggestion[]> {
  const data = await googleReadPost<{ geoTargetConstantSuggestions?: RawSuggestion[] }>(workspace, "/geoTargetConstants:suggest", {
    locale: "ro",
    countryCode: country,
    locationNames: { names: [name] },
  });
  return data.geoTargetConstantSuggestions ?? [];
}

/** Segmentele de interes Google, ținute în memoria procesului (lista e mare și se schimbă rar). */
let interestCatalog: { at: number; items: Array<{ id: string; name: string; type: string }> } | null = null;

async function interestsOf(workspace: AdsWorkspace, account: GoogleAccount) {
  if (interestCatalog && Date.now() - interestCatalog.at < 6 * 60 * 60 * 1000) return interestCatalog.items;
  const rows = await googleSearch<{ userInterest?: { userInterestId?: string; name?: string; taxonomyType?: string } }>(
    workspace,
    account.info.id,
    "SELECT user_interest.user_interest_id, user_interest.name, user_interest.taxonomy_type FROM user_interest WHERE user_interest.taxonomy_type IN ('AFFINITY', 'IN_MARKET')",
    { loginCustomerId: account.loginCustomerId }
  );
  const items = rows
    .map((row) => row.userInterest)
    .filter((item): item is { userInterestId: string; name: string; taxonomyType?: string } => Boolean(item?.userInterestId && item?.name))
    .map((item) => ({ id: item.userInterestId, name: item.name, type: item.taxonomyType ?? "" }));
  interestCatalog = { at: Date.now(), items };
  return items;
}

const TAXONOMY_LABEL: Record<string, string> = { AFFINITY: "afinitate", IN_MARKET: "în piață" };

export async function resolveGoogleTargeting(
  workspace: AdsWorkspace,
  account: GoogleAccount,
  input: Plan
): Promise<GoogleTargeting> {
  const plan: Plan = structuredClone(input);
  const errors: PlanProblem[] = [];
  const warnings: PlanProblem[] = [];
  const locations: ResolvedName[] = [];
  const languages: ResolvedName[] = [];
  const interests: ResolvedName[] = [];
  const geoTargets: string[] = [];
  const languageConstants: string[] = [];
  const interestIds: string[] = [];

  // Locațiile, în ordinea planului.
  for (const [index, location] of plan.audience.locations.entries()) {
    const path = `audience.locations.${index}`;
    if (location.type === "country") {
      const id = COUNTRY_GEO[location.code];
      if (id) {
        locations.push({ path, asked: location.code, found: COUNTRY_LABEL[location.code] ?? location.code, key: id, given: true });
        geoTargets.push(`geoTargetConstants/${id}`);
        continue;
      }
      const match = (await suggest(workspace, COUNTRY_LABEL[location.code] ?? location.code, location.code)).find(
        (item) => item.geoTargetConstant?.targetType === "Country"
      )?.geoTargetConstant;
      if (!match?.id) {
        locations.push({ path, asked: location.code, found: null, key: null, given: false });
        errors.push({ path, message: `Google nu găsește țara ${location.code}.` });
        continue;
      }
      locations.push({ path, asked: location.code, found: match.canonicalName ?? match.name ?? location.code, key: match.id, given: false });
      geoTargets.push(`geoTargetConstants/${match.id}`);
      continue;
    }

    const asked = location.name;
    if (location.key) {
      locations.push({ path, asked, found: location.name, key: location.key, given: true });
      geoTargets.push(`geoTargetConstants/${location.key.replace(/^geoTargetConstants\//, "")}`);
      continue;
    }
    if (location.type === "city" && location.radius_km) {
      warnings.push({
        path: `${path}.radius_km`,
        message: `Pe Google, campaniile Demand Gen țintesc orașul, nu o rază în jurul lui: locația ${index + 1} se ia fără cei ${location.radius_km} km.`,
      });
    }
    const types = location.type === "city" ? CITY_TYPES : REGION_TYPES;
    const wanted = normalize(location.name);
    const candidates = (await suggest(workspace, location.name, location.country))
      .map((item) => item.geoTargetConstant)
      .filter((item): item is NonNullable<RawSuggestion["geoTargetConstant"]> => Boolean(item?.id && item.status !== "REMOVAL_PLANNED"))
      .filter((item) => !item.countryCode || item.countryCode === location.country)
      .filter((item) => types.has(item.targetType ?? ""));
    const match =
      candidates.find((item) => normalize(item.name ?? "") === wanted) ??
      (candidates.length === 1 ? candidates[0] : null);
    if (!match?.id) {
      locations.push({ path, asked, found: null, key: null, given: false });
      errors.push({
        path: `${path}.name`,
        message: `Google nu găsește ${location.type === "city" ? "orașul" : "regiunea"} „${location.name}” în ${COUNTRY_LABEL[location.country] ?? location.country}. Verifică scrierea sau pune id-ul locației Google în "key".`,
      });
      continue;
    }
    location.key = match.id;
    locations.push({ path, asked, found: match.canonicalName ?? match.name ?? asked, key: match.id, given: false });
    geoTargets.push(`geoTargetConstants/${match.id}`);
  }
  if (new Set(geoTargets).size !== geoTargets.length) {
    errors.push({ path: "audience.locations", message: "Aceeași locație apare de două ori în plan. Scoate dublura." });
  }

  // Limbile.
  if (plan.audience.languages.length > 0) {
    const codes = plan.audience.languages.map((code) => `'${code}'`).join(", ");
    const rows = await googleSearch<{ languageConstant?: { id?: string; code?: string; name?: string; targetable?: boolean } }>(
      workspace,
      account.info.id,
      `SELECT language_constant.id, language_constant.code, language_constant.name, language_constant.targetable FROM language_constant WHERE language_constant.code IN (${codes})`,
      { loginCustomerId: account.loginCustomerId }
    );
    for (const [index, code] of plan.audience.languages.entries()) {
      const path = `audience.languages.${index}`;
      const match = rows.map((row) => row.languageConstant).find((item) => item?.code?.toLowerCase() === code && item.targetable !== false);
      if (!match?.id) {
        languages.push({ path, asked: code, found: null, key: null, given: false });
        errors.push({ path, message: `Google nu are limba „${code}” printre limbile de targetare.` });
        continue;
      }
      languageConstants.push(`languageConstants/${match.id}`);
      languages.push({ path, asked: code, found: match.name ?? code, key: match.id, given: false });
    }
  }

  // Interesele: segmentele Google de afinitate și „în piață".
  if (plan.audience.interests.length > 0) {
    const needsSearch = plan.audience.interests.some((item) => !item.id);
    const catalog = needsSearch ? await interestsOf(workspace, account) : [];
    for (const [index, item] of plan.audience.interests.entries()) {
      const path = `audience.interests.${index}`;
      if (item.id) {
        interests.push({ path, asked: item.name, found: item.name, key: item.id, given: true });
        interestIds.push(item.id);
        continue;
      }
      const wanted = normalize(item.name);
      const exact = catalog.filter((candidate) => normalize(candidate.name) === wanted);
      const partial = exact.length > 0 ? exact : catalog.filter((candidate) => normalize(candidate.name).includes(wanted));
      // La același nume în ambele liste, „în piață" (oameni care caută acum) bate „afinitate".
      const match =
        partial.find((candidate) => candidate.type === "IN_MARKET") && partial.length <= 3
          ? partial.find((candidate) => candidate.type === "IN_MARKET")
          : partial.length === 1
            ? partial[0]
            : null;
      if (!match) {
        interests.push({ path, asked: item.name, found: null, key: null, given: false });
        errors.push({
          path: `${path}.name`,
          message:
            partial.length > 3
              ? `„${item.name}” se potrivește cu prea multe segmente Google (${partial.slice(0, 4).map((candidate) => candidate.name).join(", ")}…). Scrie numele exact sau pune id-ul segmentului.`
              : `Google nu are segmentul de interes „${item.name}”. Numele sunt în engleză, ca în Google Ads (de exemplu „Real Estate”); scoate-l sau scrie altul.`,
        });
        continue;
      }
      item.id = match.id;
      interests.push({ path, asked: item.name, found: `${match.name} (${TAXONOMY_LABEL[match.type] ?? match.type})`, key: match.id, given: false });
      interestIds.push(match.id);
    }
  }

  return { plan, geoTargets, languageConstants, interestIds, locations, languages, interests, errors, warnings };
}
