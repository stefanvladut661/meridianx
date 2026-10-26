import { createAdminClient, getAdminUser } from "@/lib/supabase/clients";

/**
 * Accesul modulului la bază: doar cheia de service, doar pe server. Citirile
 * ecranelor și scrierile acțiunilor trec toate pe aici; RLS-ul tabelelor
 * `firma_*` lasă cititul doar adminilor, iar scrierea doar cheii de service.
 */

export type Db = NonNullable<ReturnType<typeof createAdminClient>>;
export type Result<T> = { ok: true; data: T } | { ok: false; message: string };

export const NO_DB = "Supabase nu e configurat: lipsesc NEXT_PUBLIC_SUPABASE_URL sau SUPABASE_SERVICE_ROLE_KEY în Vercel.";

export function db(): Db | null {
  return createAdminClient();
}

/** Mesajul unei erori de bază, pentru om: ce lipsește și ce să facă. */
export function failure(error: { code?: string; message?: string } | null | undefined, migration: string): { ok: false; message: string } {
  const code = error?.code ?? "";
  const message = error?.message ?? "";
  if (code === "42P01" || code === "PGRST205" || /does not exist|schema cache/i.test(message)) {
    return { ok: false, message: `Tabelele modulului lipsesc: rulează migrarea ${migration} în Supabase → SQL Editor.` };
  }
  if (code === "23505") return { ok: false, message: "Există deja un rând cu aceleași date (de exemplu, același CUI la alt client activ)." };
  console.error(`[firma] eroare de bază (${code || "fără cod"}):`, message);
  return { ok: false, message: "Baza de date n-a răspuns. Reîncearcă; dacă se repetă, vezi Supabase → Logs." };
}

/** Adminul care face acțiunea, pentru istoric. `null` = sesiune expirată. */
export async function actorEmail(): Promise<string | null> {
  const user = await getAdminUser();
  if (!user) return null;
  return user.email ?? user.id;
}

export const SESSION_EXPIRED = "Sesiunea a expirat. Intră din nou în admin și reia acțiunea.";
