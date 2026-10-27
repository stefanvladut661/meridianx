import { createAdminClient, getAdminUser } from "@/lib/supabase/clients";

/**
 * Accesul modulului la bază: doar cheia de service, doar pe server, după ce
 * pagina (layout-ul) sau acțiunea a verificat sesiunea de admin. RLS-ul
 * tabelelor `postari_*` lasă cititul prin REST doar adminilor
 * (`is_lead_admin()`), iar scrierea doar cheii de service.
 *
 * Copie mică a lui `lib/firma/db.ts`: din adminul firmei modulul importă doar
 * conexiunea Drive (vezi README → „Decizii”).
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
  if (code === "42P01" || code === "PGRST205" || code === "PGRST202" || /does not exist|schema cache/i.test(message)) {
    return { ok: false, message: `Tabelele postărilor lipsesc: rulează migrarea ${migration} în Supabase → SQL Editor.` };
  }
  if (code === "42703" || code === "PGRST204") {
    return { ok: false, message: "Baza nu are încă toate coloanele modulului: rulează migrările postărilor (24 în sus) în Supabase → SQL Editor." };
  }
  if (code === "23505") return { ok: false, message: "Există deja un rând cu aceleași date." };
  console.error(`[postari] eroare de bază (${code || "fără cod"}):`, message);
  return { ok: false, message: "Baza de date n-a răspuns. Reîncearcă; dacă se repetă, vezi Supabase → Logs." };
}

/** Adminul care face acțiunea, pentru istoric. `null` = sesiune expirată. */
export async function actorEmail(): Promise<string | null> {
  const user = await getAdminUser();
  if (!user) return null;
  return user.email ?? user.id;
}

export const SESSION_EXPIRED = "Sesiunea a expirat. Intră din nou în admin și reia acțiunea.";

/** Actorul rulărilor automate, în istoric. */
export const CRON_ACTOR = "coada (Supabase Cron)";
