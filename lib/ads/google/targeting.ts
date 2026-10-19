import "server-only";

import { COUNTRY_LABEL } from "../constants";
import type { Plan, PlanLocation } from "../plan-schema";
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

/** Rezultatul rezolvării unei liste de locații: constantele, numele găsite, problemele. */
export interface ResolvedLocations {
  geoTargets: string[];
  names: ResolvedName[];
  errors: PlanProblem[];
  warnings: PlanProblem[];
}

/**
 * Locațiile unei liste din plan → constantele Google, în ordine. Lista se
 * modifică pe loc: fiecare locație găsită primește `key`. Căutările se țin
 * în `cache` (aceeași regiune în patru campanii = o singură căutare).
 * `radiusNote` — avertismentul pentru o rază pe care Google n-o folosește
 * (la căutare, raza e oricum refuzată de validare).
 */
export async function resolveLocations(
  workspace: AdsWorkspace,
  locations: PlanLocation[],
  pathPrefix: string,
  options: { radiusNote?: (index: number, radius: number) => string; cache?: Map<string, RawSuggestion[]> } = {}
): Promise<ResolvedLocations> {
  const errors: PlanProblem[] = [];
  const warnings: PlanProblem[] = [];
  const names: ResolvedName[] = [];
  const geoTargets: string[] = [];
  const lookup = async (name: string, country: string) => {
    const key = `${country}|${name}`;
    const cached = options.cache?.get(key);
    if (cached) return cached;
    const found = await suggest(workspace, name, country);
    options.cache?.set(key, found);
    return found;
  };

  for (const [index, location] of locations.entries()) {
    const path = `${pathPrefix}.${index}`;
    if (location.type === "country") {
      const id = COUNTRY_GEO[location.code];
      if (id) {
        names.push({ path, asked: location.code, found: COUNTRY_LABEL[location.code] ?? location.code, key: id, given: true });
        geoTargets.push(`geoTargetConstants/${id}`);
        continue;
      }
      const match = (await lookup(COUNTRY_LABEL[location.code] ?? location.code, location.code)).find(
        (item) => item.geoTargetConstant?.targetType === "Country"
      )?.geoTargetConstant;
      if (!match?.id) {
        names.push({ path, asked: location.code, found: null, key: null, given: false });
        errors.push({ path, message: `Google nu găsește țara ${location.code}.` });
        continue;
      }
      names.push({ path, asked: location.code, found: match.canonicalName ?? match.name ?? location.code, key: match.id, given: false });
      geoTargets.push(`geoTargetConstants/${match.id}`);
      continue;
    }

    const asked = location.name;
    if (location.key) {
      names.push({ path, asked, found: location.name, key: location.key, given: true });
      geoTargets.push(`geoTargetConstants/${location.key.replace(/^geoTargetConstants\//, "")}`);
      continue;
    }
    if (location.type === "city" && location.radius_km && options.radiusNote) {
      warnings.push({ path: `${path}.radius_km`, message: options.radiusNote(index, location.radius_km) });
    }
    const types = location.type === "city" ? CITY_TYPES : REGION_TYPES;
    const wanted = normalize(location.name);
    const candidates = (await lookup(location.name, location.country))
      .map((item) => item.geoTargetConstant)
      .filter((item): item is NonNullable<RawSuggestion["geoTargetConstant"]> => Boolean(item?.id && item.status !== "REMOVAL_PLANNED"))
      .filter((item) => !item.countryCode || item.countryCode === location.country)
      .filter((item) => types.has(item.targetType ?? ""));
    const match =
      candidates.find((item) => normalize(item.name ?? "") === wanted) ??
      (candidates.length === 1 ? candidates[0] : null);
    if (!match?.id) {
      names.push({ path, asked, found: null, key: null, given: false });
      errors.push({
        path: `${path}.name`,
        message: `Google nu găsește ${location.type === "city" ? "orașul" : "regiunea"} „${location.name}” în ${COUNTRY_LABEL[location.country] ?? location.country}. Verifică scrierea sau pune id-ul locației Google în "key".`,
      });
      continue;
    }
    location.key = match.id;
    names.push({ path, asked, found: match.canonicalName ?? match.name ?? asked, key: match.id, given: false });
    geoTargets.push(`geoTargetConstants/${match.id}`);
  }
  return { geoTargets, names, errors, warnings };
}

/** Limbile (coduri ISO) → constantele Google. O limbă necunoscută e eroare. */
export async function resolveLanguages(
  workspace: AdsWorkspace,
  account: GoogleAccount,
  codes: string[],
  pathPrefix: string
): Promise<{ languageConstants: string[]; names: ResolvedName[]; errors: PlanProblem[] }> {
  const languageConstants: string[] = [];
  const names: ResolvedName[] = [];
  const errors: PlanProblem[] = [];
  if (codes.length === 0) return { languageConstants, names, errors };
  const rows = await googleSearch<{ languageConstant?: { id?: string; code?: string; name?: string; targetable?: boolean } }>(
    workspace,
    account.info.id,
    `SELECT language_constant.id, language_constant.code, language_constant.name, language_constant.targetable FROM language_constant WHERE language_constant.code IN (${codes.map((code) => `'${code}'`).join(", ")})`,
    { loginCustomerId: account.loginCustomerId }
  );
  for (const [index, code] of codes.entries()) {
    const path = `${pathPrefix}.${index}`;
    const match = rows.map((row) => row.languageConstant).find((item) => item?.code?.toLowerCase() === code && item.targetable !== false);
    if (!match?.id) {
      names.push({ path, asked: code, found: null, key: null, given: false });
      errors.push({ path, message: `Google nu are limba „${code}” printre limbile de targetare.` });
      continue;
    }
    languageConstants.push(`languageConstants/${match.id}`);
    names.push({ path, asked: code, found: match.name ?? code, key: match.id, given: false });
  }
  return { languageConstants, names, errors };
}

export async function resolveGoogleTargeting(
  workspace: AdsWorkspace,
  account: GoogleAccount,
  input: Plan
): Promise<GoogleTargeting> {
  const plan: Plan = structuredClone(input);
  const interests: ResolvedName[] = [];
  const interestIds: string[] = [];

  // Locațiile, în ordinea planului. Demand Gen nu are rază pe grup.
  const located = await resolveLocations(workspace, plan.audience.locations, "audience.locations", {
    radiusNote: (index, radius) =>
      `Pe Google, campaniile Demand Gen țintesc orașul, nu o rază în jurul lui: locația ${index + 1} se ia fără cei ${radius} km.`,
  });
  const errors: PlanProblem[] = [...located.errors];
  const warnings: PlanProblem[] = [...located.warnings];
  const locations = located.names;
  const geoTargets = located.geoTargets;
  if (new Set(geoTargets).size !== geoTargets.length) {
    errors.push({ path: "audience.locations", message: "Aceeași locație apare de două ori în plan. Scoate dublura." });
  }

  // Limbile.
  const spoken = await resolveLanguages(workspace, account, plan.audience.languages, "audience.languages");
  errors.push(...spoken.errors);
  const languages = spoken.names;
  const languageConstants = spoken.languageConstants;

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
