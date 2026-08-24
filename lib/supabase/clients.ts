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

// ---------------------------------------------------------------------------
// Cine are voie în /admin
// ---------------------------------------------------------------------------

/**
 * Lista de adrese cu drept de admin, din `ADMIN_EMAILS` (separate prin
 * virgulă, comparate case-insensitive).
 *
 * DE CE EXISTĂ: „autentificat în Supabase” nu înseamnă „e omul nostru”.
 * Proiectele Supabase pornesc cu înregistrarea prin email ACTIVATĂ, deci
 * fără lista asta oricine își face cont pe proiect și intră direct în
 * dashboard, unde vede toate lead-urile, cu telefoane și bugete cu tot.
 * Nu e o vulnerabilitate teoretică: e comportamentul implicit.
 */
function adminAllowlist(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((address) => address.trim().toLowerCase())
    .filter(Boolean);
}

export function isAllowlistConfigured(): boolean {
  return adminAllowlist().length > 0;
}

/**
 * Verdictul pentru o adresă, cu motiv — ca formularul de login să poată
 * spune ce s-a întâmplat, nu doar „nu”.
 *
 * Fără `ADMIN_EMAILS`: în dezvoltare trece (altfel nu se poate lucra pe un
 * proiect Supabase de test), în PRODUCȚIE nu trece. Un dashboard de
 * lead-uri deschis oricui e mai rău decât un admin blocat cinci minute,
 * iar mesajul spune exact ce variabilă lipsește.
 */
export type AdminVerdict = "allowed" | "not_allowlisted" | "allowlist_missing";

export function checkAdminEmail(email: string | null | undefined): AdminVerdict {
  const allowlist = adminAllowlist();
  if (allowlist.length === 0) {
    return process.env.NODE_ENV === "production" ? "allowlist_missing" : "allowed";
  }
  const normalized = (email ?? "").trim().toLowerCase();
  return normalized && allowlist.includes(normalized) ? "allowed" : "not_allowlisted";
}

export const ADMIN_ACCESS_MESSAGES: Record<Exclude<AdminVerdict, "allowed">, string> = {
  not_allowlisted:
    "Contul ăsta nu are acces la panou. Cere-i administratorului să îți adauge adresa în ADMIN_EMAILS.",
  allowlist_missing:
    "Panoul e blocat până se setează ADMIN_EMAILS în variabilele de mediu — altfel orice cont Supabase ar putea intra. Adaugă adresa ta acolo și redeploy.",
};

/**
 * Utilizatorul autentificat ȘI cu drept de admin, sau `null`.
 * `getUser()` (nu `getSession()`) — verifică tokenul la Supabase, nu are
 * încredere în cookie-ul local.
 *
 * Poarta e AICI, nu în formularul de login: rutele API și acțiunile de
 * server trec toate prin funcția asta, deci un cont scos din listă pierde
 * accesul la următoarea cerere, nu la următoarea autentificare.
 */
export async function getAdminUser(): Promise<{ id: string; email: string | null } | null> {
  const supabase = await createReadOnlySessionClient();
  if (!supabase) return null;

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;

  if (checkAdminEmail(data.user.email) !== "allowed") {
    console.warn(
      `[admin] acces refuzat pentru ${data.user.email ?? "cont fără email"} — nu e în ADMIN_EMAILS.`
    );
    return null;
  }

  return { id: data.user.id, email: data.user.email ?? null };
}
