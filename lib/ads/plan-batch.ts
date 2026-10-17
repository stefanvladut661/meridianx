import { CURRENCIES, type Currency } from "./constants";
import { batchPlansOf, parseJsonText, type PlanTextFailure } from "./plan-json";
import { asNumber, asRecord, asString, getIn } from "./plan-path";
import { summarizePlan, type PlanSummary } from "./plan-summary";
import { validatePlan, type PlanProblem } from "./plan-validate";
import { findWorkspace, workspaceName, type AdsWorkspace } from "./workspaces";

/**
 * Lotul de planuri — producția în masă.
 *
 * Conversația în care se scriu planurile întoarce de obicei mai multe
 * campanii odată: aceeași reclamă pe Meta, TikTok și Google, sau zece
 * variante de public. Lotul le primește pe toate, le validează una câte
 * una cu ACEEAȘI validare ca un plan singur și le arată pe rânduri.
 *
 * REGULA BANILOR: un lot nu amestecă reclamele agenției cu banii
 * clienților. Spațiul ales sus spune al cui e lotul (Meridian sau Clienți);
 * un plan pentru celălalt proprietar e o eroare pe rândul lui. Platformele
 * se pot amesteca — fiecare plan rămâne în spațiul scris în el, iar
 * acțiunile de pe server reverifică totul, plan cu plan.
 *
 * Fișier izomorf: rulează în browser la fiecare tastă și pe server, din nou,
 * înainte de orice apel spre o platformă.
 */

/** Cele mai multe planuri într-un lot. Fiecare se verifică pe rând, pe contul real. */
export const BATCH_MAX = 50;

/**
 * Cât de departe în urmă caută lotul o campanie creată din EXACT același
 * plan. Un lot se lipește des a doua oară, după ce s-au corectat două planuri
 * din zece: cele opt create deja trebuie sărite, nu dublate.
 */
export const BATCH_DUPLICATE_DAYS = 14;

export interface BatchItem {
  /** Poziția în lot, de la 0. Pe ecran: `index + 1`. */
  index: number;
  /** Planul brut, exact cum a venit — ce se trimite la verificare și la creare. */
  raw: unknown;
  record: Record<string, unknown> | null;
  /** Cheia planului: JSON-ul lui. Leagă verificarea de EXACT planul verificat. */
  key: string;
  name: string;
  workspace: AdsWorkspace | null;
  errors: PlanProblem[];
  warnings: PlanProblem[];
  /** Validarea a trecut, cu regulile lotului cu tot. */
  valid: boolean;
  summary: PlanSummary | null;
  dailyBudget: number | null;
  currency: Currency | null;
}

export type BatchRead =
  | { ok: true; items: BatchItem[]; tooMany: boolean }
  | PlanTextFailure;

export function ownerLabel(owner: AdsWorkspace["owner"]): string {
  return owner === "clienti" ? "Clienți" : "Meridian";
}

/** Citește și validează lotul, pentru proprietarul spațiului ales sus. */
export function readBatch(text: string, owner: AdsWorkspace["owner"]): BatchRead {
  const parsed = parseJsonText(text);
  if (!parsed.ok) return parsed;

  const plans = batchPlansOf(parsed.value);
  if (!plans) {
    return {
      ok: false,
      message:
        "Asta e un singur plan, nu un lot. Un lot e o listă [ {…}, {…} ] sau { \"plans\": [ … ] }. Pentru o campanie, folosește „Plan nou”.",
      line: null,
      column: null,
      fix: null,
    };
  }
  if (plans.length === 0) {
    return { ok: false, message: "Lotul e gol: lista de planuri nu are niciun plan.", line: null, column: null, fix: null };
  }

  const seen = new Map<string, number>();
  const items = plans.slice(0, BATCH_MAX).map((raw, index) => {
    const item = readItem(raw, index, owner);
    const first = seen.get(item.key);
    if (first !== undefined) {
      item.errors.push({
        path: "",
        message: `Planul e identic cu planul ${first + 1} din lot. Creat de două ori, ar însemna două campanii cu același buget. Scoate dublura.`,
      });
      item.valid = false;
    } else {
      seen.set(item.key, index);
    }
    return item;
  });

  return { ok: true, items, tooMany: plans.length > BATCH_MAX };
}

function readItem(raw: unknown, index: number, owner: AdsWorkspace["owner"]): BatchItem {
  const record = asRecord(raw);
  const key = JSON.stringify(raw) ?? "";
  const name = asString(getIn(raw, "campaign.name")) ?? `Planul ${index + 1}`;
  if (!record) {
    return {
      index,
      raw,
      record: null,
      key,
      name,
      workspace: null,
      errors: [{ path: "", message: "Elementul ăsta din lot nu e un plan: trebuie să fie un obiect JSON { … }." }],
      warnings: [],
      valid: false,
      summary: null,
      dailyBudget: null,
      currency: null,
    };
  }

  const workspace = findWorkspace(record.workspace);
  // Fiecare plan se validează în spațiul scris în el; regula banilor vine separat.
  const validation = validatePlan(record, { currentWorkspace: workspace?.id ?? null });
  const errors = [...validation.errors];
  if (workspace && workspace.owner !== owner) {
    errors.unshift({
      path: "workspace",
      message: `Lotul e pentru ${ownerLabel(owner) === "Meridian" ? "reclamele agenției (Meridian)" : "banii clienților (Clienți)"}, iar planul ăsta e pentru ${workspaceName(workspace)}. Un lot nu amestecă banii agenției cu ai clienților: pune planul în alt lot sau schimbă spațiul de sus.`,
    });
  }

  const currencyRaw = getIn(record, "campaign.currency");
  return {
    index,
    raw,
    record,
    key,
    name,
    workspace,
    errors,
    warnings: validation.warnings,
    valid: errors.length === 0,
    summary: workspace ? summarizePlan(record, workspace.platform) : null,
    dailyBudget: asNumber(getIn(record, "campaign.daily_budget")),
    currency: CURRENCIES.includes(currencyRaw as Currency) ? (currencyRaw as Currency) : null,
  };
}

/** Bugetul zilnic adunat, pe monedă — dacă s-ar porni toate. */
export function budgetTotals(items: ReadonlyArray<BatchItem>): Array<{ currency: Currency; amount: number }> {
  const totals = new Map<Currency, number>();
  for (const item of items) {
    if (item.currency && item.dailyBudget !== null) {
      totals.set(item.currency, (totals.get(item.currency) ?? 0) + item.dailyBudget);
    }
  }
  return [...totals.entries()].map(([currency, amount]) => ({ currency, amount: Math.round(amount * 100) / 100 }));
}

/**
 * Problemele lotului, ca mesaj pentru conversația în care s-a scris lotul:
 * se lipește acolo, iar răspunsul e lotul corectat.
 */
export function problemsForClaude(
  items: ReadonlyArray<{ index: number; name: string; workspaceId: string | null; problems: PlanProblem[] }>
): string {
  const withProblems = items.filter((item) => item.problems.length > 0);
  if (withProblems.length === 0) return "";
  const blocks = withProblems.map((item) => {
    const lines = item.problems.map((problem) => `- ${problem.path ? `${problem.path}: ` : ""}${problem.message}`);
    return `Planul ${item.index + 1} — „${item.name}”${item.workspaceId ? ` (${item.workspaceId})` : ""}:\n${lines.join("\n")}`;
  });
  return [
    `Portalul de reclame a găsit probleme în ${withProblems.length === 1 ? "un plan" : `${withProblems.length} planuri`} din lot. Corectează-le și trimite din nou TOT lotul, în același format (JSON, { "plans": [ … ] }), fără alte explicații în jurul lui.`,
    "",
    blocks.join("\n\n"),
  ].join("\n");
}
