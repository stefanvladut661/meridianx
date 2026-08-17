import { cookies } from "next/headers";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

/**
 * Clienții Supabase (FAZA 6).
 *
 * ⚠️ NU importa fișierul ăsta dintr-o componentă cu "use client": cheia de
 * service role nu are voie să ajungă în bundle-ul de client. Importul
 * `next/headers` face modulul inutilizabil pe client (eroare la build),
 * ceea ce ține loc de gardă. Pachetul `server-only` ar fi fost gardă
 * explicită, dar nu e instalat și nu adăugăm dependențe în FAZA 6.
 *
 * DE CE returnează `null` în loc să arunce: proiectul se dezvoltă pe șase
 * terminale, iar celelalte faze rulează `next dev` fără `.env.local`.
 * Un import care aruncă la încărcarea modulului ar rupe build-ul tuturor.
 * Aici lipsa configurării e o stare validă, tratată explicit de fiecare
 * apelant: în dezvoltare se degradează util, în producție răspunde 503.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

/** Scrierile publice (insert lead) au nevoie de service role. */
export function isWriteConfigured(): boolean {
  return Boolean(SUPABASE_URL && SERVICE_ROLE_KEY);
}

/** Autentificarea de admin are nevoie doar de cheia anon. */
export function isAuthConfigured(): boolean {
  return Boolean(SUPABASE_URL && ANON_KEY);
}

/**
 * Client cu service role — ocolește RLS.
 * Se folosește DOAR pe căile în care ruta a decis deja cine are voie:
 * insert-ul public de lead (anon nu are politică de insert) și scrierile
 * din admin, după ce sesiunea a fost verificată.
 */
export function createAdminClient(): SupabaseClient | null {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return null;
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Client legat de sesiunea din cookie, DOAR pentru citire.
 *
 * `setAll` e intenționat gol: în componentele de server nu se pot scrie
 * cookie-uri. Reîmprospătarea tokenului se face în `POST /api/admin/session`
 * (route handler, unde scrierea e permisă), apelat periodic de
 * `SessionKeeper` din layout-ul de dashboard.
 */
export async function createReadOnlySessionClient(): Promise<SupabaseClient | null> {
  if (!SUPABASE_URL || !ANON_KEY) return null;
  const cookieStore = await cookies();

  return createServerClient(SUPABASE_URL, ANON_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: () => {
        /* citire pură — vezi comentariul de mai sus */
      },
    },
  });
}

/**
 * Client legat de sesiune care POATE scrie cookie-uri.
 * Se folosește în route handlers și server actions: login, logout,
 * reîmprospătarea sesiunii.
 */
export async function createWritableSessionClient(): Promise<SupabaseClient | null> {
  if (!SUPABASE_URL || !ANON_KEY) return null;
  const cookieStore = await cookies();

  return createServerClient(SUPABASE_URL, ANON_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        for (const { name, value, options } of cookiesToSet) {
          cookieStore.set(name, value, options);
        }
      },
    },
  });
}

/**
 * Utilizatorul autentificat, sau `null`.
 * `getUser()` (nu `getSession()`) — verifică tokenul la Supabase, nu are
 * încredere în cookie-ul local.
 */
export async function getAdminUser(): Promise<{ id: string; email: string | null } | null> {
  const supabase = await createReadOnlySessionClient();
  if (!supabase) return null;

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return { id: data.user.id, email: data.user.email ?? null };
}
