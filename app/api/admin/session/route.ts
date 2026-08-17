import { NextResponse } from "next/server";
import { createWritableSessionClient } from "@/lib/supabase/clients";

/**
 * POST /api/admin/session — reîmprospătarea sesiunii de admin.
 *
 * DE CE EXISTĂ: componentele de server nu pot scrie cookie-uri, deci
 * clientul Supabase folosit la citire are `setAll` gol și nu poate rota
 * tokenul. Soluția obișnuită e reîmprospătarea în middleware — dar
 * `middleware.ts` e fișier înghețat după FAZA 0 (i18n) și nu îl atingem.
 *
 * Aici, într-un route handler, scrierea de cookie-uri e permisă.
 * `SessionKeeper` din layout-ul dashboard-ului îl apelează periodic, ca
 * sesiunea să nu expire după o oră în mijlocul lucrului.
 *
 * Cererea F7: dacă middleware-ul se dezgheață, mută refresh-ul acolo și
 * șterge ruta asta împreună cu SessionKeeper.
 */

export async function POST() {
  const supabase = await createWritableSessionClient();
  if (!supabase) {
    return NextResponse.json({ ok: false }, { status: 503 });
  }

  // getUser() validează tokenul la Supabase și, prin clientul scriitor,
  // persistă cookie-urile rotite.
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
