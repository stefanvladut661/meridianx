import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { runAdsSync } from "@/lib/ads/sync";

/**
 * GET /admin/ads/sincronizare — cron-ul zilnic al cifrelor Meta.
 *
 * Vercel Cron trimite `Authorization: Bearer <CRON_SECRET>`. Fără secret, în
 * producție ruta refuză tot: o sincronizare deschisă oricui ar consuma din
 * limita de cereri a conturilor și ar scrie în bază la comandă. În
 * dezvoltare, fără secret, ruta se poate apela din browser, ca să se testeze.
 *
 * Răspunsul are doar starea și numere — niciun id de cont, niciun mesaj
 * Meta; detaliile stau în `ads_runs`, vizibile în portal.
 *
 * Programarea e în `vercel.json` (vezi `lib/ads/README.md` → „Faza 4").
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      console.error("[ads-sync] CRON_SECRET lipsește în producție — invocarea a fost refuzată.");
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
    const outcome = await runAdsSync({ trigger: "cron" });
    return NextResponse.json(
      {
        status: outcome.status,
        campaigns: outcome.campaignsSynced,
        rows: outcome.rowsWritten,
        problems: outcome.problems.length,
        skipped: outcome.skipped.length,
      },
      { status: outcome.status === "failed" ? 502 : 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("[ads-sync] rularea n-a pornit:", error instanceof Error ? error.message : "necunoscut");
    return NextResponse.json({ status: "failed" }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
