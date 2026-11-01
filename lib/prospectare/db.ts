import { createAdminClient } from "@/lib/supabase/clients";

/**
 * Accesul modulului Prospectare la bază: doar cheia de service, doar pe
 * server, după ce pagina sau ruta a verificat cine cere (adminul cu
 * `getAdminUser()`, robotul cu tokenul lui). RLS-ul tabelelor
 * `prospectare_*` lasă cititul prin REST doar adminilor, iar scrierile trec
 * prin funcțiile din migrările 28–30, care impun regulile (un singur canal,
 * „Nu contacta”, activitatea doar completată).
 */

export type Db = NonNullable<ReturnType<typeof createAdminClient>>;
export type Result<T> = { ok: true; data: T } | { ok: false; message: string; code?: string; status?: number };

export const NO_DB = "Supabase nu e configurat: lipsesc NEXT_PUBLIC_SUPABASE_URL sau SUPABASE_SERVICE_ROLE_KEY.";
export const SESSION_EXPIRED = "Sesiunea a expirat. Intră din nou în admin și reia acțiunea.";

export function db(): Db | null {
  return createAdminClient();
}

/**
 * Codurile funcțiilor (`raise … using errcode`) și ce înseamnă pentru cine a
 * cerut: statusul HTTP pentru roboți, mesajul pentru om.
 */
const CODES: Record<string, number> = {
  PR400: 400,
  PR401: 401,
  PR403: 403,
  PR404: 404,
  PR409: 409,
  // „Nu contacta”, respins, client: cererea e refuzată, ca la alt canal.
  PR410: 409,
  PR422: 422,
  PR429: 429,
  "23505": 409,
};

/** O eroare de bază, tradusă: mesajul funcției (scris pentru om) sau ce lipsește. */
export function failure(error: { code?: string; message?: string } | null | undefined): { ok: false; message: string; code?: string; status: number } {
  const code = error?.code ?? "";
  const message = error?.message ?? "";
  if (code in CODES) {
    return { ok: false, code, status: CODES[code], message: code === "23505" ? "Există deja un rând cu aceleași date." : message };
  }
  if (code === "42P01" || code === "PGRST205" || code === "PGRST202" || /does not exist|schema cache/i.test(message)) {
    return { ok: false, code, status: 503, message: "Tabelele prospectării lipsesc: rulează migrările 28–30 în Supabase → SQL Editor." };
  }
  if (code === "42703" || code === "PGRST204") {
    return { ok: false, code, status: 503, message: "Baza nu are încă toate coloanele prospectării: rulează din nou migrările 28–30 în Supabase → SQL Editor." };
  }
  console.error(`[prospectare] eroare de bază (${code || "fără cod"}):`, message);
  return { ok: false, code, status: 500, message: "Baza de date n-a răspuns. Reîncearcă; dacă se repetă, vezi Supabase → Logs." };
}

/** Cheamă o funcție a modulului și întoarce rezultatul sau eroarea tradusă. */
export async function rpc<T>(name: string, args: Record<string, unknown>): Promise<Result<T>> {
  const client = db();
  if (!client) return { ok: false, message: NO_DB, status: 503 };
  const { data, error } = await client.rpc(name, args);
  if (error) return failure(error);
  return { ok: true, data: data as T };
}
