import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Clientul Supabase al vault-ului — DOAR în browser (feat/vault, faza 2).
 *
 * Nu are legătură cu `lib/supabase/clients.ts` (care importă
 * `next/headers`, deci trăiește pe server și poartă cheia de service
 * role). Aici e cheia anon, publică prin definiție: tot ce apără datele
 * e RLS-ul din migrarea 3 și faptul că ele sunt criptate.
 *
 * SESIUNEA STĂ ÎN MEMORIE (`persistSession: false`): nu în localStorage,
 * nu în cookie. Moare cu fila — exact ca și cheile. Un vault a cărui
 * sesiune supraviețuiește închiderii browserului ar fi deschis pe orice
 * calculator lăsat nesupravegheat. Decizie din faza 1.
 *
 * `detectSessionInUrl: false`: nu venim niciodată printr-un link magic
 * sau de invitație — contul se activează cu parolă temporară, în UI.
 *
 * Auto-refresh rămâne pornit: tokenul expiră în ~1 h, iar o sesiune de
 * lucru poate fi mai lungă; auto-blocarea din UI e cea care decide când
 * se închide, nu expirarea tokenului.
 */

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** Aceleași două variabile publice ca la admin. Se poate apela și pe
    server (pagina decide ce randează) — sunt `NEXT_PUBLIC_`. */
export function isVaultConfigured(): boolean {
  return Boolean(URL && ANON_KEY);
}

let client: SupabaseClient | null = null;

/** Un singur client pe filă. `null` doar dacă mediul nu e configurat —
    caz pe care pagina îl tratează înainte să ajungă aici. */
export function getVaultClient(): SupabaseClient | null {
  if (!URL || !ANON_KEY) return null;
  if (!client) {
    client = createClient(URL, ANON_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    });
  }
  return client;
}
