import type { NextRequest } from "next/server";
import { runKeepalive } from "../../_lib/keepalive";

/**
 * GET /api/cron/keepalive — sonda ZILNICĂ, în liniște.
 *
 * Patru cereri reale în Supabase (insert, select, delete, count), ca
 * proiectul gratuit să nu fie pus pe pauză. Trimite email doar dacă a
 * picat. Programată în `vercel.json`; logica e în `_lib/keepalive.ts`.
 */

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return runKeepalive(request, { report: false });
}
