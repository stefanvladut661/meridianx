import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { runDaily } from "@/lib/firma/rezumat";

/**
 * GET /admin/firma/cron — jobul de dimineață al adminului firmei
 * (`lib/firma/rezumat.ts`): folderul lunii, ciornele (doar ciorne), starea din
 * Oblio (doar citire), verificarea pachetului lunii trecute și rezumatul pe
 * email, doar în zilele cu alerte.
 *
 * Vercel Cron trimite `Authorization: Bearer <CRON_SECRET>` (același secret ca
 * celelalte joburi). Fără secret, în producție ruta refuză tot. Intrarea din
 * `vercel.json` o adaugi tu — vezi lib/firma/README.md → „Jobul programat”.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      console.error("[firma-cron] CRON_SECRET lipsește în producție — invocarea a fost refuzată.");
      return false;
    }
    return true;
  }
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(request.headers.get("authorization") ?? "");
  return expected.length === received.length && timingSafeEqual(expected, received);
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  try {
    const outcome = await runDaily();
    // Doar stări și numere — detaliile stau în istoricul modulului.
    return NextResponse.json({ ok: true, alerts: outcome.alerts, digest: outcome.digest, steps: Object.keys(outcome.steps) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[firma-cron] jobul a aruncat:", error instanceof Error ? error.message : error);
    return NextResponse.json({ ok: false }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
