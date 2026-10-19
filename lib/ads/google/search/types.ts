import type { PlanProblem } from "../../plan-validate";
import type { AdAccountInfo, ResolvedName } from "../../types";

/**
 * Ce ajunge în browser din verificarea și crearea unui plan de căutare.
 * Fișier izomorf, doar tipuri — nimic din răspunsurile brute ale Google în
 * afara câmpurilor alese aici.
 */

export interface SearchUrlCheck {
  url: string;
  /** Statusul HTTP; null = n-a răspuns. */
  status: number | null;
  verdict: "ok" | "redirect" | "error";
  /** Unde duce redirecționarea, sau ce n-a mers. */
  note: string | null;
}

export interface SearchCheck {
  ok: boolean;
  /** Amprenta planului verificat + ce a găsit Google; crearea o recalculează și refuză dacă diferă. */
  fingerprint: string;
  checkedAt: string;
  account: AdAccountInfo | null;
  /** Prin ce cont manager vede cheia contul (null = direct). Nu e secret: e id-ul MCC-ului. */
  manager: string | null;
  operations: number;
  campaigns: Array<{
    key: string;
    name: string;
    locations: ResolvedName[];
    excluded: ResolvedName[];
    languages: ResolvedName[];
  }>;
  /** Acțiunile de conversie de pe butoanele de apel. */
  callConversions: Array<{ id: string; name: string; type: string; ok: boolean }>;
  urls: SearchUrlCheck[];
  errors: PlanProblem[];
  warnings: PlanProblem[];
}

export type SearchCheckResponse = { ok: true; check: SearchCheck } | { ok: false; message: string; problems?: PlanProblem[] };

export interface CreatedSearchCampaign {
  key: string;
  name: string;
  /** Id-ul Google al campaniei. */
  id: string;
  /** Rândul din `ads_campaigns`; null dacă salvarea în bază a eșuat. */
  recordId: string | null;
  url: string;
}

export type SearchCreateResponse =
  | {
      ok: true;
      /** Leagă rândurile din `ads_campaigns` create din același plan. */
      groupId: string;
      campaigns: CreatedSearchCampaign[];
      /** Lista de campanii a contului în Google Ads. */
      accountUrl: string;
      counts: { adGroups: number; keywords: number; ads: number; negatives: number; assets: number; operations: number };
      storeWarning: string | null;
    }
  | {
      ok: false;
      message: string;
      problems?: PlanProblem[];
      recheck?: boolean;
      duplicate?: { createdAt: string; adsManagerUrl: string; recordId: string };
    };
