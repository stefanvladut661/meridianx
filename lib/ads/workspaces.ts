import type { Currency, Platform } from "./constants";

/**
 * Spațiile de lucru ale portalului de reclame.
 *
 * Un spațiu = un business portfolio (Meta) sau un Business Center (TikTok)
 * = un token. Portalul le ține complet separate: fiecare operație primește
 * UN spațiu și folosește DOAR tokenul lui; nu există funcție care să
 * citească două tokenuri în același apel.
 *
 * ADĂUGAREA UNUI PORTOFOLIU NOU: un obiect nou în lista de mai jos + variabila
 * lui de mediu în Vercel. Nimic altceva.
 *
 * DE CE NU STĂ AICI LISTA DE CONTURI DE RECLAME: repo-ul e public, iar id-urile
 * de cont nu intră în cod. Lista vine din token, la conectare (faza 2):
 * un System User vede exact conturile care i-au fost atribuite în Business
 * Settings, deci izolarea o garantează chiar platforma — un token nu poate
 * atinge contul altui portofoliu, oricât ar greși codul nostru.
 *
 * Fișierul e izomorf: conține NUMELE variabilelor, nu valorile. Valorile se
 * citesc doar în `workspaces.server.ts`.
 */

export interface AdsWorkspace {
  /** Cheia din plan (`"workspace": "meta-meridian"`). Nu se schimbă după prima campanie. */
  id: string;
  /** Numele afișat, scurt. */
  label: string;
  /** Al cui e portofoliul — spune cui îi cheltui banii. */
  owner: "agentie" | "clienti";
  platform: Platform;
  /** Numele variabilei de mediu cu tokenul. Valoarea nu apare nicăieri în cod. */
  tokenEnv: string;
  /**
   * Plafonul de buget zilnic acceptat de portal, pe monedă. Prinde un zero
   * în plus scris din greșeală (500 în loc de 50). Campania se creează
   * oprită oricum, dar la activare Ads Manager nu mai întreabă.
   * Monedă lipsă din listă = planul se respinge pentru moneda aceea.
   */
  dailyBudgetCap: Partial<Record<Currency, number>>;
}

export const WORKSPACES = [
  {
    id: "meta-meridian",
    label: "Meridian",
    owner: "agentie",
    platform: "meta",
    tokenEnv: "META_TOKEN_MERIDIAN",
    dailyBudgetCap: { RON: 500, EUR: 100 },
  },
  {
    id: "meta-clienti",
    label: "Clienți",
    owner: "clienti",
    platform: "meta",
    tokenEnv: "META_TOKEN_CLIENTI",
    dailyBudgetCap: { RON: 2500, EUR: 500, USD: 500 },
  },
  {
    id: "tiktok-meridian",
    label: "Meridian",
    owner: "agentie",
    platform: "tiktok",
    tokenEnv: "TIKTOK_TOKEN_MERIDIAN",
    dailyBudgetCap: { RON: 500, EUR: 100 },
  },
  {
    id: "tiktok-clienti",
    label: "Clienți",
    owner: "clienti",
    platform: "tiktok",
    tokenEnv: "TIKTOK_TOKEN_CLIENTI",
    dailyBudgetCap: { RON: 2500, EUR: 500, USD: 500 },
  },
] as const satisfies readonly AdsWorkspace[];

export type WorkspaceId = (typeof WORKSPACES)[number]["id"];

export const WORKSPACE_IDS = WORKSPACES.map((workspace) => workspace.id) as [
  WorkspaceId,
  ...WorkspaceId[],
];

export function findWorkspace(id: unknown): AdsWorkspace | null {
  return WORKSPACES.find((workspace) => workspace.id === id) ?? null;
}

export function isWorkspaceId(id: unknown): id is WorkspaceId {
  return findWorkspace(id) !== null;
}

/** „Meridian · Meta" — cum apare spațiul în selector și în mesaje. */
export function workspaceName(workspace: Pick<AdsWorkspace, "label" | "platform">): string {
  return `${workspace.label} · ${workspace.platform === "meta" ? "Meta" : "TikTok"}`;
}

/**
 * Ce ajunge în browser despre un spațiu: configurația publică și DACĂ
 * tokenul e setat. Niciodată tokenul. Numele variabilei nu e secret (stă
 * în fișierul ăsta, într-un repo public) și îi spune omului ce să seteze.
 */
export interface WorkspaceSummary {
  id: WorkspaceId;
  label: string;
  owner: AdsWorkspace["owner"];
  platform: Platform;
  name: string;
  tokenEnv: string;
  tokenConfigured: boolean;
  dailyBudgetCap: AdsWorkspace["dailyBudgetCap"];
}
