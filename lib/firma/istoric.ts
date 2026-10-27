import { db, failure, type Result } from "./db";
import type { Zona } from "./istoric-shared";

export type { Zona } from "./istoric-shared";

/**
 * Istoricul modulului (`firma_istoric`): cine, ce, când, rezultatul. Fiecare
 * acțiune de server și fiecare rulare a cron-ului scrie aici. O scriere eșuată
 * în istoric nu oprește acțiunea — se vede în loguri.
 */
export interface Eveniment {
  actor: string;
  zona: Zona;
  actiune: string;
  tinta?: string | null;
  rezultat: "ok" | "eroare" | "sarit";
  mesaj?: string | null;
  detalii?: Record<string, unknown>;
}

export async function logEvent(event: Eveniment): Promise<void> {
  const admin = db();
  if (!admin) return;
  const { error } = await admin.from("firma_istoric").insert({
    actor: event.actor.slice(0, 200),
    zona: event.zona,
    actiune: event.actiune.slice(0, 120),
    tinta: event.tinta ? event.tinta.slice(0, 200) : null,
    rezultat: event.rezultat,
    mesaj: event.mesaj ? event.mesaj.slice(0, 2000) : null,
    detalii: event.detalii ?? {},
  });
  if (error) console.error("[firma] istoricul n-a putut fi scris:", error.code, error.message);
}

export interface RandIstoric {
  id: number;
  createdAt: string;
  actor: string;
  zona: Zona;
  actiune: string;
  tinta: string | null;
  rezultat: "ok" | "eroare" | "sarit";
  mesaj: string | null;
}

export async function readHistory(filter: { zona?: Zona | null; limit?: number } = {}): Promise<Result<RandIstoric[]>> {
  const admin = db();
  if (!admin) return { ok: false, message: "Supabase nu e configurat." };
  let query = admin
    .from("firma_istoric")
    .select("id, created_at, actor, zona, actiune, tinta, rezultat, mesaj")
    .order("created_at", { ascending: false })
    .limit(filter.limit ?? 200);
  if (filter.zona) query = query.eq("zona", filter.zona);
  const { data, error } = await query;
  if (error) return failure(error, "16");
  return {
    ok: true,
    data: (data ?? []).map((row) => ({
      id: Number(row.id),
      createdAt: row.created_at as string,
      actor: row.actor as string,
      zona: row.zona as Zona,
      actiune: row.actiune as string,
      tinta: (row.tinta as string | null) ?? null,
      rezultat: row.rezultat as RandIstoric["rezultat"],
      mesaj: (row.mesaj as string | null) ?? null,
    })),
  };
}
