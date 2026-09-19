import type { NextRequest } from "next/server";
import { runKeepalive } from "../../../_lib/keepalive";

/**
 * GET /api/cron/keepalive/report — sonda SĂPTĂMÂNALĂ, cu raport.
 *
 * Aceeași sondă ca `/api/cron/keepalive`, dar trimite mereu emailul de
 * test — vizibil diferit de un lead — ca omul să vadă că lanțul
 * bază → server → email merge. Rulează lunea (vezi `vercel.json`); logat
 * în /admin, se poate deschide și din browser, oricând.
 */

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return runKeepalive(request, { report: true });
}
