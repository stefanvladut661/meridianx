import "server-only";

import { planFingerprint } from "../../fingerprint";
import type { AdsWorkspace } from "../../workspaces";
import { GoogleAdsApiError, googleMutate, googlePause } from "../api";
import type { GoogleAccount } from "../lookup";
import { planNegatives, parseNegativeInput, usableNegatives, NEGATIVES_PER_REQUEST_MAX, type NegativesMode, type NegativeTarget } from "./negatives";
import { readCampaignNegatives, readCampaignStates, readListKeywords, readNegativeLists, readPositiveKeywords } from "./read";
import type { NegativesPreview } from "./types";

/**
 * Scrierile pe un cont existent, din `/admin/ads/cont` și `/admin/ads/termeni`:
 * pauza (prin `googlePause`, cu garda ei) și negativele (prin `googleMutate`,
 * cu garda creării: doar negative pe campanii, doar liste de negative citite
 * chiar acum din cont). Totul se pregătește întâi — conflictele, `validateOnly`,
 * amprenta — și se trimite abia după ce omul vede exact ce pleacă.
 */

// ---------------------------------------------------------------------------
// Pauza
// ---------------------------------------------------------------------------

export interface PauseOutcome {
  paused: Array<{ id: string; name: string }>;
  skipped: Array<{ id: string; name: string; why: string }>;
}

/**
 * Pune pe pauză campaniile cerute care sunt ACUM active în cont (citite chiar
 * înainte). Cele deja oprite sau șterse se sar, cu motivul. O singură cerere.
 */
export async function pauseCampaigns(workspace: AdsWorkspace, account: GoogleAccount, ids: string[]): Promise<PauseOutcome> {
  const states = await readCampaignStates(workspace, account, ids);
  const paused: PauseOutcome["paused"] = [];
  const skipped: PauseOutcome["skipped"] = [];
  for (const id of ids) {
    const state = states.get(id);
    if (!state) skipped.push({ id, name: id, why: "nu e în cont" });
    else if (state.status === "PAUSED") skipped.push({ id, name: state.name, why: "era deja pe pauză" });
    else if (state.status !== "ENABLED") skipped.push({ id, name: state.name, why: `are statusul ${state.status}` });
    else paused.push({ id, name: state.name });
  }
  if (paused.length > 0) {
    await googlePause(
      workspace,
      account.info.id,
      paused.map((item) => `customers/${account.info.id}/campaigns/${item.id}`),
      { validateOnly: false, loginCustomerId: account.loginCustomerId }
    );
  }
  return { paused, skipped };
}

// ---------------------------------------------------------------------------
// Negativele
// ---------------------------------------------------------------------------

export interface NegativesRequest {
  mode: NegativesMode;
  /** Lista lipită (moduri `campaigns` și `list`). */
  text: string;
  campaignIds: string[];
  /** Lista comună (modurile `list` și `link`). */
  listId: string | null;
}

export interface PreparedNegatives {
  preview: NegativesPreview;
  operations: Array<Record<string, unknown>>;
  negativeSharedSets: string[];
}

export async function prepareNegatives(workspace: AdsWorkspace, account: GoogleAccount, request: NegativesRequest): Promise<PreparedNegatives> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const parsed = request.mode === "link" ? [] : parseNegativeInput(request.text);
  const keywords = usableNegatives(parsed);
  const ids = [...new Set(request.campaignIds.filter((id) => /^\d+$/.test(id)))];

  if (request.mode !== "link" && keywords.length === 0) errors.push("Niciun cuvânt bun în listă: un cuvânt pe rând, [exactă], \"frază\" sau doar cuvintele (amplă).");
  if (keywords.length > NEGATIVES_PER_REQUEST_MAX) errors.push(`${keywords.length} de cuvinte; o trimitere primește cel mult ${NEGATIVES_PER_REQUEST_MAX}.`);
  const badLines = parsed.filter((item) => item.problem).length;
  if (badLines > 0) warnings.push(`${badLines === 1 ? "Un rând nu" : `${badLines} rânduri nu`} se adaugă — vezi problemele de pe rânduri.`);
  if (request.mode === "campaigns" && ids.length === 0) errors.push("Alege cel puțin o campanie.");
  if (request.mode === "link" && ids.length === 0) errors.push("Alege campaniile de care se leagă lista.");

  const [states, lists] = await Promise.all([readCampaignStates(workspace, account, ids), readNegativeLists(workspace, account)]);
  const list = request.listId ? (lists.find((item) => item.id === request.listId) ?? null) : null;
  if (request.mode !== "campaigns" && !list) errors.push("Lista comună aleasă nu mai e în cont (sau nu e o listă de negative).");

  // Doar campanii de căutare, nesterse: acolo au sens negativele de campanie.
  const eligible = ids.filter((id) => {
    const state = states.get(id);
    if (!state) {
      errors.push(`Campania ${id} nu e în cont.`);
      return false;
    }
    if (state.status === "REMOVED") {
      errors.push(`„${state.name}” e ștearsă.`);
      return false;
    }
    if (state.type !== "SEARCH") {
      errors.push(`„${state.name}” nu e o campanie de căutare (${state.type}): portalul pune negative doar pe căutare.`);
      return false;
    }
    return true;
  });

  const affected = [...new Set([...eligible, ...(list?.campaigns ?? [])])];
  const [positives, existing, listKeywords] = await Promise.all([
    readPositiveKeywords(workspace, account, affected),
    request.mode === "campaigns" ? readCampaignNegatives(workspace, account, eligible) : Promise.resolve(new Map()),
    list ? readListKeywords(workspace, account, list.id) : Promise.resolve([]),
  ]);
  const extraStates = await readCampaignStates(workspace, account, (list?.campaigns ?? []).filter((id) => !states.has(id)));
  const nameOf = (id: string) => states.get(id)?.name ?? extraStates.get(id)?.name ?? id;
  const target = (id: string): NegativeTarget => ({
    id,
    name: nameOf(id),
    existing: (existing.get(id) ?? []).map((item: { text: string; match: NegativeTarget["existing"][number]["match"] }) => ({ text: item.text, match: item.match })),
    positives: positives.get(id) ?? [],
  });

  const plan = planNegatives({
    customerId: account.info.id,
    mode: request.mode,
    keywords,
    targets: eligible.map(target),
    list: list ? { resourceName: list.resourceName, name: list.name, keywords: listKeywords.map((item) => ({ text: item.text, match: item.match })), linked: list.campaigns.map(target) } : null,
  });
  if (plan.conflicts.length > 0) {
    errors.push(
      `${plan.conflicts.length === 1 ? "Un cuvânt cheie activ ar fi blocat" : `${plan.conflicts.length} cuvinte cheie active ar fi blocate`} de negativele noi — vezi lista. Scoate negativele vinovate sau campaniile lor.`
    );
  }
  if (errors.length === 0 && plan.operations.length === 0) errors.push("Nimic de adăugat: toate cuvintele sunt deja acolo.");

  const negativeSharedSets = lists.map((item) => item.resourceName);
  if (errors.length === 0) {
    try {
      await googleMutate(workspace, account.info.id, plan.operations, { validateOnly: true, loginCustomerId: account.loginCustomerId, negativeSharedSets });
    } catch (error) {
      if (!(error instanceof GoogleAdsApiError) || error.info.status === 0 || error.info.status >= 500 || error.info.status === 401) throw error;
      errors.push(...error.info.errors.slice(0, 10).map((item) => `Google refuză operația ${item.operationIndex !== null ? item.operationIndex + 1 : "?"}: ${item.message || item.code}${item.trigger ? ` („${item.trigger}”)` : ""}.`));
    }
  }

  const preview: NegativesPreview = {
    ok: errors.length === 0,
    fingerprint: planFingerprint({ workspace: workspace.id, account: account.info.id, request: { ...request, campaignIds: [...ids].sort() }, operations: plan.operations }),
    keywords: parsed,
    additions: plan.additions,
    conflicts: plan.conflicts,
    operations: plan.operations.length,
    errors,
    warnings,
  };
  return { preview, operations: plan.operations, negativeSharedSets };
}

export async function applyNegatives(workspace: AdsWorkspace, account: GoogleAccount, prepared: PreparedNegatives): Promise<number> {
  await googleMutate(workspace, account.info.id, prepared.operations, {
    validateOnly: false,
    loginCustomerId: account.loginCustomerId,
    negativeSharedSets: prepared.negativeSharedSets,
  });
  return prepared.operations.length;
}
