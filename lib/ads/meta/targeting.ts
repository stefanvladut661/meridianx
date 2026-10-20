import "server-only";

import { COUNTRY_LABEL } from "../constants";
import type { Plan } from "../plan-schema";
import type { PlanProblem } from "../plan-validate";
import type { AdsWorkspace } from "../workspaces";
import { metaGet } from "./graph";
import type { ResolvedName } from "../types";

/**
 * Numele din plan traduse în cheile Meta: orașe, regiuni, limbi, interese,
 * comportamente.
 *
 * Planul le scrie cum le spune omul („Cluj-Napoca", „Real estate"); Meta
 * targetează după chei. Căutarea alege potrivirea exactă (fără diacritice,
 * fără majuscule) și abia apoi primul rezultat — iar ce a ales se arată
 * omului, cu numele complet, ÎNAINTE de creare. Un nume negăsit e o eroare:
 * a-l sări în tăcere ar lărgi publicul fără să știe nimeni.
 *
 * Ce are deja cheie sau id în plan nu se mai caută.
 */

export interface ResolvedTargeting {
  /** Planul cu cheile și id-urile completate — exact ce intră în targetare. */
  plan: Plan;
  /** Cheile Meta ale limbilor (`locales`), în ordinea din plan. */
  locales: number[];
  locations: ResolvedName[];
  languages: ResolvedName[];
  interests: ResolvedName[];
  behaviors: ResolvedName[];
  errors: PlanProblem[];
}

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\b(judetul|county|municipiul)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function pick<T>(items: T[], name: (item: T) => string, asked: string): T | null {
  const wanted = normalize(asked);
  return items.find((item) => normalize(name(item)) === wanted) ?? items[0] ?? null;
}

// ---------------------------------------------------------------------------
// Locații
// ---------------------------------------------------------------------------

interface GeoResult {
  key: string;
  name: string;
  type?: string;
  country_code?: string;
  country_name?: string;
  region?: string;
}

async function searchGeo(workspace: AdsWorkspace, kind: "city" | "region", name: string, country: string) {
  const response = await metaGet<{ data?: GeoResult[] }>(workspace, "/search", {
    type: "adgeolocation",
    location_types: [kind],
    q: name,
    country_code: country,
    limit: 10,
  });
  // Meta întoarce uneori și rezultate din alte țări; le filtrăm noi.
  return (response.data ?? []).filter((item) => !item.country_code || item.country_code === country);
}

function geoLabel(result: GeoResult): string {
  return [result.name, result.region && result.region !== result.name ? result.region : null, result.country_name]
    .filter(Boolean)
    .join(", ");
}

// ---------------------------------------------------------------------------
// Limbi
// ---------------------------------------------------------------------------

const englishLanguage = new Intl.DisplayNames(["en"], { type: "language" });

async function resolveLocale(workspace: AdsWorkspace, code: string) {
  const english = englishLanguage.of(code) ?? code;
  const response = await metaGet<{ data?: Array<{ key: number; name: string }> }>(workspace, "/search", {
    type: "adlocale",
    q: english,
    limit: 25,
  });
  const results = response.data ?? [];
  const wanted = normalize(english);
  // „English" → „English (All)", nu doar „English (US)".
  return (
    results.find((item) => normalize(item.name) === wanted) ??
    results.find((item) => normalize(item.name) === `${wanted} (all)`) ??
    results.find((item) => normalize(item.name).startsWith(wanted)) ??
    null
  );
}

// ---------------------------------------------------------------------------
// Interese și comportamente
// ---------------------------------------------------------------------------

interface InterestResult {
  id: string;
  name: string;
  path?: string[];
}

async function searchInterest(workspace: AdsWorkspace, name: string) {
  const response = await metaGet<{ data?: InterestResult[] }>(workspace, "/search", {
    type: "adinterest",
    q: name,
    limit: 10,
  });
  return response.data ?? [];
}

async function listBehaviors(workspace: AdsWorkspace) {
  const response = await metaGet<{ data?: InterestResult[] }>(workspace, "/search", {
    type: "adTargetingCategory",
    class: "behaviors",
    limit: 1000,
  });
  return response.data ?? [];
}

function pathLabel(item: InterestResult): string {
  const trail = (item.path ?? []).filter((part) => part !== item.name);
  return trail.length > 0 ? `${item.name} (${trail.join(" › ")})` : item.name;
}

// ---------------------------------------------------------------------------
// Rezolvarea
// ---------------------------------------------------------------------------

export async function resolveTargeting(workspace: AdsWorkspace, input: Plan): Promise<ResolvedTargeting> {
  const plan: Plan = structuredClone(input);
  const errors: PlanProblem[] = [];
  const locations: ResolvedName[] = [];
  const languages: ResolvedName[] = [];
  const interests: ResolvedName[] = [];
  const behaviors: ResolvedName[] = [];
  const locales: number[] = [];

  // Locațiile — în serie, sunt puține și așa rămân în ordinea planului.
  for (const [index, location] of plan.audience.locations.entries()) {
    const path = `audience.locations.${index}`;
    if (location.type === "country") {
      locations.push({
        path,
        asked: location.code,
        found: COUNTRY_LABEL[location.code] ?? location.code,
        key: location.code,
        given: true,
      });
      continue;
    }
    const asked = `${location.name}${location.type === "city" && location.radius_km ? ` (+${location.radius_km} km)` : ""}`;
    if (location.key) {
      locations.push({ path, asked, found: location.name, key: location.key, given: true });
      continue;
    }
    const match = pick(await searchGeo(workspace, location.type, location.name, location.country), (item) => item.name, location.name);
    if (!match) {
      locations.push({ path, asked, found: null, key: null, given: false });
      errors.push({
        path: `${path}.name`,
        message: `Meta nu găsește ${location.type === "city" ? "orașul" : "regiunea"} „${location.name}” în ${COUNTRY_LABEL[location.country] ?? location.country}. Verifică scrierea (așa cum apare în Ads Manager) sau pune cheia în "key".`,
      });
      continue;
    }
    location.key = match.key;
    locations.push({ path, asked, found: geoLabel(match), key: match.key, given: false });
  }

  for (const [index, code] of plan.audience.languages.entries()) {
    const path = `audience.languages.${index}`;
    const match = await resolveLocale(workspace, code);
    if (!match) {
      languages.push({ path, asked: code, found: null, key: null, given: false });
      errors.push({ path, message: `Meta nu are limba „${code}” printre limbile de targetare.` });
      continue;
    }
    locales.push(match.key);
    languages.push({ path, asked: code, found: match.name, key: String(match.key), given: false });
  }

  for (const [index, item] of plan.audience.interests.entries()) {
    const path = `audience.interests.${index}`;
    if (item.id) {
      interests.push({ path, asked: item.name, found: item.name, key: item.id, given: true });
      continue;
    }
    const match = pick(await searchInterest(workspace, item.name), (result) => result.name, item.name);
    if (!match) {
      interests.push({ path, asked: item.name, found: null, key: null, given: false });
      errors.push({
        path: `${path}.name`,
        message: `Meta nu găsește interesul „${item.name}”. Interesele se caută în engleză, cu numele din Ads Manager; scoate-l sau scrie altul.`,
      });
      continue;
    }
    item.id = match.id;
    interests.push({ path, asked: item.name, found: pathLabel(match), key: match.id, given: false });
  }

  if (plan.audience.behaviors.length > 0) {
    const needsSearch = plan.audience.behaviors.some((item) => !item.id);
    const catalog = needsSearch ? await listBehaviors(workspace) : [];
    for (const [index, item] of plan.audience.behaviors.entries()) {
      const path = `audience.behaviors.${index}`;
      if (item.id) {
        behaviors.push({ path, asked: item.name, found: item.name, key: item.id, given: true });
        continue;
      }
      const wanted = normalize(item.name);
      const match =
        catalog.find((result) => normalize(result.name) === wanted) ??
        catalog.find((result) => normalize(result.name).includes(wanted)) ??
        null;
      if (!match) {
        behaviors.push({ path, asked: item.name, found: null, key: null, given: false });
        errors.push({
          path: `${path}.name`,
          message: `Meta nu are comportamentul „${item.name}”. Numele trebuie să fie cel din Ads Manager, în engleză.`,
        });
        continue;
      }
      item.id = match.id;
      behaviors.push({ path, asked: item.name, found: pathLabel(match), key: match.id, given: false });
    }
  }

  return { plan, locales, locations, languages, interests, behaviors, errors };
}
