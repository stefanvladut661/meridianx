import {
  CEILING,
  FEATURES,
  FLOOR,
  INTEGRATIONS,
  MAINTENANCE,
  MULTILINGUAL,
  PROJECT_TYPES,
  ROUNDING,
  UNCERTAINTY,
  type ProjectTypeId,
} from "@/lib/estimator-config";

/**
 * Calculul estimării (FAZA 5) — funcții pure, fără React.
 *
 * Regula instrumentului: rezultatul e ÎNTOTDEAUNA un interval, iar
 * lățimea lui spune cât de puțin știm încă. Pe măsură ce brief-ul se
 * completează, banda se strânge. Nu iese niciodată un preț.
 */

/** Cât de departe a ajuns omul în brief — determină incertitudinea. */
export type EstimateStage = "type" | "composition" | "context";

export interface EstimatorInput {
  type: ProjectTypeId | null;
  /** Numărul total de pagini/ecrane dorite. */
  screens: number | null;
  features: string[];
  integrations: string[];
  /** Câte limbi are proiectul. 1 = doar română. */
  languages: number;
  maintenance: boolean;
  stage: EstimateStage;
}

export interface Estimate {
  /** false când tipul lipsește sau nu se poate estima dintr-un formular. */
  ok: boolean;
  low: number;
  high: number;
  /** ±procent, ca număr între 0 și 1. */
  uncertainty: number;
  /** Mentenanța e recurentă — se afișează separat, nu se adună. */
  monthly: [number, number] | null;
  /** Capătul de sus a atins plafonul: peste atât nu mai estimăm din formular. */
  aboveCeiling: boolean;
}

export const EMPTY_ESTIMATE: Estimate = {
  ok: false,
  low: 0,
  high: 0,
  uncertainty: UNCERTAINTY.type,
  monthly: null,
  aboveCeiling: false,
};

function addonRange(ids: string[], catalog: typeof FEATURES): [number, number] {
  return ids.reduce<[number, number]>(
    (total, id) => {
      const addon = catalog.find((item) => item.id === id);
      if (!addon) return total;
      return [total[0] + addon.range[0], total[1] + addon.range[1]];
    },
    [0, 0]
  );
}

function roundDown(value: number): number {
  return Math.floor(value / ROUNDING) * ROUNDING;
}

function roundUp(value: number): number {
  return Math.ceil(value / ROUNDING) * ROUNDING;
}

export function calculate(input: EstimatorInput): Estimate {
  const type = PROJECT_TYPES.find((item) => item.id === input.type);
  if (!type || !type.estimable) {
    return { ...EMPTY_ESTIMATE, uncertainty: UNCERTAINTY[input.stage] };
  }

  let low = type.base[0];
  let high = type.base[1];

  // ecrane peste cele incluse în bază
  if (input.screens !== null && input.screens > type.includedScreens) {
    const extra = input.screens - type.includedScreens;
    low += extra * type.perScreen[0];
    high += extra * type.perScreen[1];
  }

  const features = addonRange(input.features, FEATURES);
  const integrations = addonRange(input.integrations, INTEGRATIONS);
  low += features[0] + integrations[0];
  high += features[1] + integrations[1];

  // multilingv — procent peste subtotal, nu sumă fixă
  if (input.languages >= 2) {
    let lowPercent = MULTILINGUAL.secondLanguage[0];
    let highPercent = MULTILINGUAL.secondLanguage[1];
    const extraLanguages = input.languages - 2;
    lowPercent += extraLanguages * MULTILINGUAL.extraLanguage[0];
    highPercent += extraLanguages * MULTILINGUAL.extraLanguage[1];
    low *= 1 + lowPercent;
    high *= 1 + highPercent;
  }

  // banda de incertitudine: cu cât știm mai puțin, cu atât e mai lată
  const uncertainty = UNCERTAINTY[input.stage];
  low *= 1 - uncertainty;
  high *= 1 + uncertainty;

  low = Math.max(FLOOR, roundDown(low));
  high = Math.max(low + ROUNDING, roundUp(high));

  const aboveCeiling = high > CEILING;
  if (aboveCeiling) high = CEILING;

  return {
    ok: true,
    low,
    high,
    uncertainty,
    monthly: input.maintenance ? MAINTENANCE.monthly : null,
    aboveCeiling,
  };
}

/**
 * Formatare în stil românesc, fără `Intl`: aceeași ieșire pe server și
 * în browser, deci zero riscuri de hidratare.
 */
export function formatEuro(value: number): string {
  const digits = Math.round(value).toString();
  const groups: string[] = [];
  for (let index = digits.length; index > 0; index -= 3) {
    groups.unshift(digits.slice(Math.max(0, index - 3), index));
  }
  return `${groups.join(".")} €`;
}

/** Opțiunile de addon valabile pentru tipul ales. */
export function availableAddons(
  catalog: typeof FEATURES,
  type: ProjectTypeId | null
) {
  return catalog.filter(
    (addon) => !addon.appliesTo || (type !== null && addon.appliesTo.includes(type))
  );
}
