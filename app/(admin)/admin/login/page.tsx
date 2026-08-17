import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAdminUser, isAuthConfigured } from "@/lib/supabase/clients";
import { LoginForm } from "../_components/login-form";

export const metadata: Metadata = {
  title: "Autentificare — MERIDIAN Admin",
  robots: { index: false, follow: false },
};

/**
 * /admin/login (FAZA 6).
 * Stă în afara grupului `(dash)`, deci nu trece prin garda de sesiune —
 * altfel s-ar redirecta la infinit spre el însuși.
 */
export default async function AdminLoginPage() {
  const user = await getAdminUser();
  if (user) redirect("/admin");

  const configured = isAuthConfigured();

  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-accent-2">
          MERIDIAN · Admin
        </p>
        <h1 className="mt-3 font-display text-2xl font-semibold tracking-tight">
          Panoul de lead-uri
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-fg/70">
          Acces doar pentru echipă. Nu există înregistrare — contul se creează
          din Supabase.
        </p>

        {configured ? (
          <LoginForm />
        ) : (
          <div className="mt-8 rounded-md border border-accent-2/40 bg-surface p-5">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-accent-2">
              Nu e configurat
            </p>
            <p className="mt-3 text-sm leading-relaxed text-fg/75">
              Lipsesc variabilele de mediu pentru Supabase. Copiază
              <code className="mx-1 rounded-xs bg-bg px-1.5 py-0.5 font-mono text-xs">
                .env.example
              </code>
              în
              <code className="mx-1 rounded-xs bg-bg px-1.5 py-0.5 font-mono text-xs">
                .env.local
              </code>
              , completează
              <code className="mx-1 rounded-xs bg-bg px-1.5 py-0.5 font-mono text-xs">
                NEXT_PUBLIC_SUPABASE_URL
              </code>
              și
              <code className="mx-1 rounded-xs bg-bg px-1.5 py-0.5 font-mono text-xs">
                NEXT_PUBLIC_SUPABASE_ANON_KEY
              </code>
              , apoi repornește serverul.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
