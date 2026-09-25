import "server-only";

import { COUNTRY_LABEL } from "../constants";
import type { Plan } from "../plan-schema";
import type { PlanProblem } from "../plan-validate";
import type { ResolvedName } from "../types";
import type { AdsWorkspace } from "../workspaces";
import { tiktokGet } from "./api";
import { TIKTOK_OBJECTIVE } from "./build";

/**
 * Numele din plan traduse în id-urile TikTok: țări, regiuni, orașe, limbi,
 * interese.
 *
 * Locațiile vin dintr-o singură citire (`/tool/region/`): lista locațiilor
 * în care TikTok livrează pentru obiectivul campaniei, cu părintele
 * fiecăreia — de acolo se știe în ce țară e un oraș și dacă două locații se
 * suprapun (TikTok le refuză). Potrivirea e exactă (fără diacritice, fără
 * majuscule); un nume negăsit e o eroare, nu se sare — ar lărgi publicul.
 *
 * Ce are deja id în plan (`key`, `id`) nu se mai caută.
 */

export interface TikTokTargeting {
  /** Planul cu id-urile completate — exact ce intră în grupul de reclame. */
  plan: Plan;
  locationIds: string[];
  languageCodes: string[];
  interestIds: string[];
  locations: ResolvedName[];
  languages: ResolvedName[];
  interests: ResolvedName[];
  errors: PlanProblem[];
}

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\b(judetul|county|municipiul|province)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// ---------------------------------------------------------------------------
// Locații
// ---------------------------------------------------------------------------

interface RawRegion {
  location_id?: string | number;
  name?: string;
  parent_id?: string | number | null;
  region_code?: string;
  level?: string;
}

interface Region {
  id: string;
  name: string;
  parentId: string | null;
  code: string | null;
  level: string;
}

class RegionIndex {
  private readonly byId = new Map<string, Region>();

  constructor(raw: RawRegion[]) {
    for (const item of raw) {
      if (item.location_id === undefined || !item.name) continue;
      const id = String(item.location_id);
      this.byId.set(id, {
        id,
        name: item.name,
        parentId: item.parent_id !== undefined && item.parent_id !== null && String(item.parent_id) !== "0" ? String(item.parent_id) : null,
        code: item.region_code ?? null,
        level: (item.level ?? "").toUpperCase(),
      });
    }
  }

  get(id: string): Region | undefined {
    return this.byId.get(id);
  }

  /** Strămoșii, de la părinte spre țară. */
  ancestors(region: Region): Region[] {
    const chain: Region[] = [];
    let current = region.parentId ? this.byId.get(region.parentId) : undefined;
    while (current && chain.length < 6) {
      chain.push(current);
      current = current.parentId ? this.byId.get(current.parentId) : undefined;
    }
    return chain;
  }

  countryOf(region: Region): Region | null {
    if (region.level === "COUNTRY") return region;
    return this.ancestors(region).find((item) => item.level === "COUNTRY") ?? null;
  }

  country(code: string): Region | null {
    for (const region of this.byId.values()) {
      if (region.level === "COUNTRY" && region.code?.toUpperCase() === code) return region;
    }
    return null;
  }

  /** Regiunile (`PROVINCE`) sau orașele (`CITY`) dintr-o țară. */
  inCountry(level: "PROVINCE" | "CITY", country: Region): Region[] {
    return [...this.byId.values()].filter((region) => region.level === level && this.countryOf(region)?.id === country.id);
  }

  label(region: Region): string {
    return [region.name, ...this.ancestors(region).map((item) => item.name)].join(", ");
  }
}

async function loadRegions(workspace: AdsWorkspace, advertiserId: string, plan: Plan, deep: boolean): Promise<RegionIndex> {
  const data = await tiktokGet<{ region_info?: RawRegion[] }>(workspace, "/tool/region/", {
    advertiser_id: advertiserId,
    placements: ["PLACEMENT_TIKTOK"],
    objective_type: TIKTOK_OBJECTIVE[plan.campaign.objective],
    level_range: deep ? "TO_CITY" : "TO_COUNTRY",
    language: "ro",
  });
  return new RegionIndex(data.region_info ?? []);
}

function matchByName(candidates: Region[], asked: string): Region | null {
  const wanted = normalize(asked);
  const exact = candidates.filter((region) => normalize(region.name) === wanted);
  if (exact.length === 1) return exact[0];
  if (exact.length > 1) return null;
  const partial = candidates.filter((region) => normalize(region.name).includes(wanted));
  return partial.length === 1 ? partial[0] : null;
}

// ---------------------------------------------------------------------------
// Limbi și interese
// ---------------------------------------------------------------------------

interface RawLanguage {
  code?: string;
  name?: string;
}

interface RawInterest {
  id?: string | number;
  interest_category_id?: string | number;
  name?: string;
  interest_category_name?: string;
  level?: number;
}

// ---------------------------------------------------------------------------
// Rezolvarea
// ---------------------------------------------------------------------------

export async function resolveTikTokTargeting(
  workspace: AdsWorkspace,
  advertiserId: string,
  input: Plan
): Promise<TikTokTargeting> {
  const plan: Plan = structuredClone(input);
  const errors: PlanProblem[] = [];
  const locations: ResolvedName[] = [];
  const languages: ResolvedName[] = [];
  const interests: ResolvedName[] = [];
  const locationIds: string[] = [];
  const languageCodes: string[] = [];
  const interestIds: string[] = [];

  const needsLookup = plan.audience.locations.some((location) => !(location.type !== "country" && location.key));
  const deep = plan.audience.locations.some((location) => location.type !== "country" && !location.key);
  const regions = needsLookup ? await loadRegions(workspace, advertiserId, plan, deep) : new RegionIndex([]);

  // Locațiile, în ordinea planului.
  const chosen: Array<{ path: string; region: Region | null; id: string }> = [];
  for (const [index, location] of plan.audience.locations.entries()) {
    const path = `audience.locations.${index}`;
    const countryName = COUNTRY_LABEL[location.type === "country" ? location.code : location.country] ?? (location.type === "country" ? location.code : location.country);

    if (location.type !== "country" && location.key) {
      locations.push({ path, asked: location.name, found: regions.get(location.key) ? regions.label(regions.get(location.key)!) : location.name, key: location.key, given: true });
      locationIds.push(location.key);
      chosen.push({ path, region: regions.get(location.key) ?? null, id: location.key });
      continue;
    }

    const country = regions.country(location.type === "country" ? location.code : location.country);
    if (!country) {
      locations.push({ path, asked: location.type === "country" ? location.code : location.name, found: null, key: null, given: false });
      errors.push({
        path,
        message: `TikTok nu livrează în ${countryName} pentru obiectivul ales (nu apare în lista lor de locații).`,
      });
      continue;
    }

    if (location.type === "country") {
      locations.push({ path, asked: location.code, found: regions.label(country), key: country.id, given: false });
      locationIds.push(country.id);
      chosen.push({ path, region: country, id: country.id });
      continue;
    }

    const level = location.type === "region" ? "PROVINCE" : "CITY";
    const candidates = regions.inCountry(level, country);
    const what = location.type === "region" ? "regiunea" : "orașul";
    if (candidates.length === 0) {
      locations.push({ path, asked: location.name, found: null, key: null, given: false });
      errors.push({
        path: `${path}.name`,
        message: `TikTok nu targetează pe ${location.type === "region" ? "regiuni" : "orașe"} în ${countryName} — doar țara întreagă. Pune { "type": "country", "code": "${location.country}" } în loc.`,
      });
      continue;
    }
    const match = matchByName(candidates, location.name);
    if (!match) {
      locations.push({ path, asked: location.name, found: null, key: null, given: false });
      errors.push({
        path: `${path}.name`,
        message: `TikTok nu găsește ${what} „${location.name}” în ${countryName}. Verifică scrierea (așa cum apare în TikTok Ads Manager) sau pune id-ul locației în "key".`,
      });
      continue;
    }
    location.key = match.id;
    locations.push({ path, asked: location.name, found: regions.label(match), key: match.id, given: false });
    locationIds.push(match.id);
    chosen.push({ path, region: match, id: match.id });
  }

  // TikTok refuză locațiile care se suprapun (un oraș și țara lui).
  const ids = new Set(chosen.map((item) => item.id));
  for (const item of chosen) {
    const covering = item.region ? regions.ancestors(item.region).find((ancestor) => ids.has(ancestor.id)) : undefined;
    if (covering) {
      errors.push({
        path: item.path,
        message: `Locația se suprapune cu ${covering.name}, care e deja în plan — TikTok refuză locațiile suprapuse. Păstrează doar una dintre ele.`,
      });
    }
  }
  if (new Set(locationIds).size !== locationIds.length) {
    errors.push({ path: "audience.locations", message: "Aceeași locație apare de două ori în plan. Scoate dublura." });
  }

  // Limbile.
  if (plan.audience.languages.length > 0) {
    const data = await tiktokGet<{ languages?: RawLanguage[] }>(workspace, "/tool/language/", { advertiser_id: advertiserId });
    const available = (data.languages ?? []).filter((item): item is Required<RawLanguage> => Boolean(item.code && item.name));
    for (const [index, code] of plan.audience.languages.entries()) {
      const path = `audience.languages.${index}`;
      const match = available.find((item) => item.code.toLowerCase() === code) ?? null;
      if (!match) {
        languages.push({ path, asked: code, found: null, key: null, given: false });
        errors.push({ path, message: `TikTok nu are limba „${code}” printre limbile de targetare.` });
        continue;
      }
      languageCodes.push(match.code);
      languages.push({ path, asked: code, found: match.name, key: match.code, given: false });
    }
  }

  // Interesele.
  if (plan.audience.interests.length > 0) {
    const needsSearch = plan.audience.interests.some((item) => !item.id);
    const catalog = needsSearch
      ? (
          await tiktokGet<{ interest_categories?: RawInterest[] }>(workspace, "/tool/interest_category/", {
            advertiser_id: advertiserId,
            version: 2,
          })
        ).interest_categories ?? []
      : [];
    const named = catalog
      .map((item) => ({ id: item.interest_category_id ?? item.id, name: item.interest_category_name ?? item.name }))
      .filter((item): item is { id: string | number; name: string } => item.id !== undefined && Boolean(item.name));

    for (const [index, item] of plan.audience.interests.entries()) {
      const path = `audience.interests.${index}`;
      if (item.id) {
        interests.push({ path, asked: item.name, found: item.name, key: item.id, given: true });
        interestIds.push(item.id);
        continue;
      }
      const wanted = normalize(item.name);
      const match = named.find((candidate) => normalize(candidate.name) === wanted) ?? null;
      if (!match) {
        interests.push({ path, asked: item.name, found: null, key: null, given: false });
        errors.push({
          path: `${path}.name`,
          message: `TikTok nu are categoria de interes „${item.name}”. Numele se scriu în engleză, ca în TikTok Ads Manager (de exemplu „Real Estate”); scoate-l sau scrie altul.`,
        });
        continue;
      }
      item.id = String(match.id);
      interests.push({ path, asked: item.name, found: match.name, key: String(match.id), given: false });
      interestIds.push(String(match.id));
    }
  }

  return { plan, locationIds, languageCodes, interestIds, locations, languages, interests, errors };
}
