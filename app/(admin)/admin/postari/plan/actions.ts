"use server";

import { revalidatePath } from "next/cache";
import { actorEmail, SESSION_EXPIRED } from "@/lib/postari/db";
import { logEvent } from "@/lib/postari/istoric";
import { approvePlan } from "@/lib/postari/planuri";
import { verifyPlan, type VerifyResult } from "@/lib/postari/plan-verify";

/** Cât citește o verificare din clipurile necitite, înainte să răspundă (pagina are 60 s). */
const PROBE_BUDGET_MS = 35_000;
const MAX_TEXT = 400_000;

export type VerifyResponse = VerifyResult | { ok: false; message: string; line: null; column: null; schema: [] };

export async function verifyPlanAction(text: unknown): Promise<VerifyResponse> {
  const actor = await actorEmail();
  if (!actor) return { ok: false, message: SESSION_EXPIRED, line: null, column: null, schema: [] };
  if (typeof text !== "string" || text.length > MAX_TEXT) return { ok: false, message: "Planul e prea mare (cel mult 400 KB de text).", line: null, column: null, schema: [] };
  const result = await verifyPlan(text, { probeBudgetMs: PROBE_BUDGET_MS });
  if (result.ok && result.pending === 0) {
    await logEvent({
      actor,
      zona: "plan",
      actiune: "plan verificat",
      rezultat: result.summary.errors === 0 ? "ok" : "eroare",
      mesaj: `${result.nume ? `„${result.nume}”: ` : ""}${result.summary.posts} postări, ${result.summary.errors} erori, ${result.summary.warnings} atenționări.`,
    });
  }
  return result;
}

export type ApproveResponse = { ok: true; rows: number; posts: number; instagram: number; tiktok: number; first: string | null; last: string | null } | { ok: false; message: string };

export async function approvePlanAction(text: unknown, expected: unknown): Promise<ApproveResponse> {
  const actor = await actorEmail();
  if (!actor) return { ok: false, message: SESSION_EXPIRED };
  if (typeof text !== "string" || text.length > MAX_TEXT) return { ok: false, message: "Planul e prea mare (cel mult 400 KB de text)." };
  if (!Array.isArray(expected) || expected.length > 500 || !expected.every((value) => value === null || typeof value === "string")) return { ok: false, message: "Previzualizarea nu s-a trimis întreagă. Verifică planul din nou." };
  const result = await approvePlan(text, actor, expected as (string | null)[]);
  if (!result.ok) {
    await logEvent({ actor, zona: "plan", actiune: "aprobare refuzată", rezultat: "eroare", mesaj: result.message });
    return { ok: false, message: result.message };
  }
  revalidatePath("/admin/postari", "layout");
  const summary = result.verified.summary;
  return { ok: true, rows: result.rows, posts: summary.posts, instagram: summary.instagram, tiktok: summary.tiktok, first: summary.first, last: summary.last };
}
