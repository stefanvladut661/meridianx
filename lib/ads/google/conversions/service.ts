import "server-only";

import { planFingerprint } from "../../fingerprint";
import type { AdsWorkspace } from "../../workspaces";
import { accountMoney } from "../account/labels";
import { GoogleAdsApiError, googleMutate, idOf, type GoogleAdsErrorItem } from "../api";
import type { GoogleAccount } from "../lookup";
import { readConversionActions, readConversionSetup } from "./read";
import {
  CATEGORY_LABEL,
  COUNTING_LABEL,
  CONVERSION_TYPE_LABEL,
  LEAD_ACTIONS,
  buildConversionOperations,
  validateConversionsRequest,
  type ConversionsRequest,
} from "./standard";
import type { ConversionsPreview, ConversionsPreviewRow, CreatedConversion } from "./types";

/**
 * Crearea acțiunilor de conversie standard (faza 13), pe contul clientului:
 * întâi previzualizarea — regulile formularului, numele deja folosite, ce s-ar
 * dubla, `validateOnly` la Google — apoi crearea, doar dacă amprenta e aceeași.
 * O singură cerere atomică, prin `googleMutate` (garda: doar cele trei tipuri,
 * doar câmpurile lor, fără status).
 */

export interface PreparedConversions {
  preview: ConversionsPreview;
  operations: Array<Record<string, unknown>>;
  request: ConversionsRequest | null;
}

const formatAccount = (digits: string) => digits.replace(/^(\d{3})(\d{3})(\d{4})$/, "$1-$2-$3");

/** Câmpul din formular pentru câmpul din eroarea Google (`…create.click_through_lookback_window_days`). */
const FIELD_OF: Record<string, string> = {
  name: "name",
  category: "category",
  counting_type: "counting",
  click_through_lookback_window_days: "clickWindowDays",
  view_through_lookback_window_days: "viewWindowDays",
  phone_call_duration_seconds: "callSeconds",
  value_settings: "value",
  default_value: "value",
  primary_for_goal: "primary",
};

function googleProblem(item: GoogleAdsErrorItem): string {
  if (item.code.endsWith(": DUPLICATE_NAME")) return "Numele e deja folosit în cont (poate de o acțiune ștearsă). Alege alt nume.";
  if (item.code.endsWith(": CREATION_NOT_SUPPORTED")) {
    return "Google nu creează acest tip de acțiune prin API. Creeaz-o în Google Ads (Obiective → Conversii → Acțiune nouă), apoi alege-o mai jos, la importul GTM.";
  }
  if (item.code.endsWith(": TOO_LOW") || item.code.endsWith(": TOO_HIGH")) return `Google refuză valoarea: e în afara intervalului permis (${item.code}).`;
  return `Google refuză: ${item.message || item.code}${item.trigger ? ` („${item.trigger}”)` : ""}.`;
}

export async function prepareConversions(workspace: AdsWorkspace, account: GoogleAccount, raw: unknown): Promise<PreparedConversions> {
  const validation = validateConversionsRequest(raw);
  if (!validation.ok) {
    return { preview: { ok: false, fingerprint: "", rows: [], operations: 0, errors: validation.errors, warnings: [] }, operations: [], request: null };
  }
  const request = validation.request;
  const currency = account.info.currency;
  const setup = await readConversionSetup(workspace, account);
  const errors: ConversionsPreview["errors"] = [];
  const warnings: string[] = [];

  if (setup.conversionAccount) {
    errors.push({
      path: "",
      message: `Conversiile contului se gestionează în contul ${formatAccount(setup.conversionAccount)} (urmărirea conversiilor între conturi, din manager). Acolo se creează acțiunile noi, în Google Ads; portalul creează doar în contul clientului.`,
    });
  }

  const byName = new Map(setup.actions.map((action) => [action.name.trim().toLocaleLowerCase("ro-RO"), action]));
  const rows: ConversionsPreviewRow[] = request.actions.map((action, index) => {
    const spec = LEAD_ACTIONS[action.kind];
    const taken = byName.get(action.name.toLocaleLowerCase("ro-RO"));
    if (taken) errors.push({ path: `actions.${index}.name`, message: `Contul are deja „${taken.name}”. Alege alt nume.` });
    const twin = action.primary
      ? setup.actions.find(
          (item) => item.status === "ENABLED" && item.primary && item.type === spec.type && (spec.type !== "WEBPAGE" || item.category === action.category)
        )
      : undefined;
    const facts = [
      CONVERSION_TYPE_LABEL[spec.type] ?? spec.type,
      CATEGORY_LABEL[action.category] ?? action.category,
      action.primary ? "principală — contează la licitare" : "secundară — doar raportată",
      COUNTING_LABEL[action.counting] ?? action.counting,
      `${action.clickWindowDays} ${action.clickWindowDays === 1 ? "zi" : "zile"} după clic`,
      ...(action.viewWindowDays !== null ? [`${action.viewWindowDays} ${action.viewWindowDays === 1 ? "zi" : "zile"} după afișare`] : []),
      ...(action.callSeconds !== null ? [`apel de cel puțin ${action.callSeconds} s`] : []),
      action.value !== null ? `valoare ${accountMoney(action.value, currency)} la fiecare conversie` : "fără valoare",
    ];
    return {
      kind: action.kind,
      name: action.name,
      facts,
      similar: twin
        ? `Contul are deja „${twin.name}” (${CONVERSION_TYPE_LABEL[twin.type] ?? twin.type}, principală). Două acțiuni principale pentru același lucru numără conversia de două ori: fă-o pe una secundară.`
        : null,
    };
  });

  if (request.actions.some((action) => LEAD_ACTIONS[action.kind].call) && !(setup.callReporting.enabled && setup.callReporting.conversions)) {
    warnings.push(
      "Raportarea apelurilor (sau conversiile din apeluri) e oprită în cont: acțiunea se creează, dar nu numără nimic până nu pornești setarea în Google Ads → Administrator → Setările contului → Raportarea apelurilor."
    );
  }

  const operations = buildConversionOperations(request, currency);
  if (errors.length === 0) {
    try {
      await googleMutate(workspace, account.info.id, operations, { validateOnly: true, loginCustomerId: account.loginCustomerId });
    } catch (error) {
      if (!(error instanceof GoogleAdsApiError) || error.info.status === 0 || error.info.status >= 500 || error.info.status === 401) throw error;
      for (const item of error.info.errors.slice(0, 10)) {
        const last = item.field?.split(".").pop()?.replace(/\[\d+\]$/, "") ?? "";
        const field = FIELD_OF[last];
        errors.push({
          path: item.operationIndex !== null ? `actions.${item.operationIndex}${field ? `.${field}` : ""}` : "",
          message: googleProblem(item),
        });
      }
      if (error.info.errors.length === 0) errors.push({ path: "", message: `Google refuză: ${error.info.message}` });
    }
  }

  return {
    preview: {
      ok: errors.length === 0,
      fingerprint: planFingerprint({ workspace: workspace.id, account: account.info.id, request, operations }),
      rows,
      operations: operations.length,
      errors,
      warnings,
    },
    operations,
    request,
  };
}

export async function createConversions(workspace: AdsWorkspace, account: GoogleAccount, prepared: PreparedConversions): Promise<CreatedConversion[]> {
  if (!prepared.request) return [];
  const result = await googleMutate(workspace, account.info.id, prepared.operations, { validateOnly: false, loginCustomerId: account.loginCustomerId });
  const ids = result.resourceNames.map((name) => idOf(name) ?? "");
  // Eticheta (AW-…/…) se citește din fragmentele de cod ale acțiunilor noi.
  const actions = await readConversionActions(workspace, account).catch(() => []);
  return prepared.request.actions.map((action, index) => ({
    id: ids[index] ?? "",
    name: action.name,
    kind: action.kind,
    type: LEAD_ACTIONS[action.kind].type,
    sendTo: actions.find((item) => item.id === ids[index])?.sendTo ?? null,
  }));
}
