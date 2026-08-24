"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  ADMIN_ACCESS_MESSAGES,
  checkAdminEmail,
  createWritableSessionClient,
  isAuthConfigured,
} from "@/lib/supabase/clients";
import { LIMITS, rateLimit } from "@/app/api/_lib/api";

/**
 * Autentificarea de admin (FAZA 6).
 *
 * Autentificarea o face Supabase; AUTORIZAREA o face `ADMIN_EMAILS`.
 * Verificarea de aici e doar ca să dăm un mesaj util — poarta adevărată e
 * `getAdminUser()`, prin care trec toate rutele și acțiunile. Dacă am lăsa
 * doar poarta, un cont din afara listei ar reuși login-ul și ar fi trimis
 * înapoi la login de gardă: o buclă fără explicație.
 */

export interface LoginState {
  error: string | null;
}

async function ipFromHeaders(): Promise<string> {
  const headerList = await headers();
  const forwarded = headerList.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return headerList.get("x-real-ip") ?? "necunoscut";
}

export async function signIn(
  _previous: LoginState,
  formData: FormData
): Promise<LoginState> {
  if (!isAuthConfigured()) {
    return {
      error:
        "Supabase nu e configurat pe acest mediu. Setează NEXT_PUBLIC_SUPABASE_URL și NEXT_PUBLIC_SUPABASE_ANON_KEY, apoi repornește serverul.",
    };
  }

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Completează emailul și parola." };
  }

  const verdict = rateLimit(`login:${await ipFromHeaders()}`, LIMITS.login);
  if (!verdict.allowed) {
    return {
      error: `Prea multe încercări. Mai așteaptă ${verdict.retryAfter} secunde.`,
    };
  }

  const supabase = await createWritableSessionClient();
  if (!supabase) {
    return { error: "Nu ne putem conecta la Supabase chiar acum." };
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Mesaj identic pentru email inexistent și parolă greșită: altfel
    // formularul devine un instrument de aflat ce conturi există.
    return { error: "Email sau parolă greșite." };
  }

  const access = checkAdminEmail(data.user?.email ?? email);
  if (access !== "allowed") {
    // Sesiunea a fost deja creată de Supabase — o închidem, ca să nu rămână
    // un cookie valid pentru un cont care oricum nu trece de gardă.
    await supabase.auth.signOut();
    return { error: ADMIN_ACCESS_MESSAGES[access] };
  }

  redirect("/admin");
}

export async function signOut(): Promise<void> {
  const supabase = await createWritableSessionClient();
  if (supabase) await supabase.auth.signOut();
  redirect("/admin/login");
}
