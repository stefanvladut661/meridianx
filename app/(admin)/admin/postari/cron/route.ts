import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { runQueue } from "@/lib/postari/coada";
import { CRON_ACTOR } from "@/lib/postari/db";

/**
 * POST /admin/postari/cron — o rulare a cozii de postări. O cheamă Supabase
 * Cron la 5 minute, prin `net.http_post`, cu `Authorization: Bearer
 * <POSTARI_CRON_SECRET>` (SQL-ul jobului: lib/postari/supabase-cron.sql).
 *
 * Fără secret, în producție ruta refuză tot. Răspunsul are doar numere; ce
 * s-a întâmplat cu fiecare postare stă în istoricul modulului.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const NO_STORE = { "Cache-Control": "no-store" };

function authorized(request: NextRequest): boolean {
  const secret = process.env.POSTARI_CRON_SECRET?.trim();
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      console.error("[postari-cron] POSTARI_CRON_SECRET lipsește în producție — apelul a fost refuzat.");
      return false;
    }
    return true;
  }
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(request.headers.get("authorization") ?? "");
  return expected.length === received.length && timingSafeEqual(expected, received);
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: NO_STORE });
  const result = await runQueue({ source: "cron", actor: CRON_ACTOR });
  if (!result.ok) return NextResponse.json({ ok: false, error: result.message }, { status: 500, headers: NO_STORE });
  const s = result.summary;
  return NextResponse.json(
    { ok: true, coadaOprita: s.coadaOprita, luate: s.luate, publicate: s.publicate, ciorne: s.ciorne, asteapta: s.asteapta, reincercari: s.reincercari, esuate: s.esuate, intarziate: s.intarziate, amanate: s.amanate },
    { headers: NO_STORE }
  );
}

export async function GET() {
  return NextResponse.json({ error: "Coada se pornește cu POST (Supabase Cron)." }, { status: 405, headers: { ...NO_STORE, Allow: "POST" } });
}
