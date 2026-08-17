"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  createWritableSessionClient,
  isAuthConfigured,
} from "@/lib/supabase/clients";
import { LIMITS, rateLimit } from "@/app/api/_lib/api";

/**
 * Autentificarea de admin (FAZA 6).
 * Un singur cont la început — orice utilizator Supabase autentificat e
 * admin. Când apar mai mulți oameni, aici se adaugă verificarea de rol.
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

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Mesaj identic pentru email inexistent și parolă greșită: altfel
    // formularul devine un instrument de aflat ce conturi există.
    return { error: "Email sau parolă greșite." };
  }

  redirect("/admin");
}

export async function signOut(): Promise<void> {
  const supabase = await createWritableSessionClient();
  if (supabase) await supabase.auth.signOut();
  redirect("/admin/login");
}
