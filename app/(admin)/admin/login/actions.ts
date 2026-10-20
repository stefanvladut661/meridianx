"use server";

import { redirect } from "next/navigation";
import { createWritableSessionClient } from "@/lib/supabase/clients";

/**
 * Ieșirea din admin (FAZA 6).
 *
 * Intrarea nu mai e aici: din 2026-10-20 panoul se deschide doar cu Google,
 * prin `/admin/auth/google` și `/admin/auth/callback`.
 */

export async function signOut(): Promise<void> {
  const supabase = await createWritableSessionClient();
  if (supabase) await supabase.auth.signOut();
  redirect("/admin/login");
}
