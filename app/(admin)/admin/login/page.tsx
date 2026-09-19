import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAdminUser, isAuthConfigured } from "@/lib/supabase/clients";
import { Mark } from "@/components/site/mark";
import { LoginForm } from "../_components/login-form";
import { MeridianRing } from "../_components/meridian-ring";

export const metadata: Metadata = {
  title: "Autentificare — MERIDIAN Admin",
  robots: { index: false, follow: false },
};

/**
 * /admin/login (FAZA 6).
 * Stă în afara grupului `(dash)`, deci nu trece prin garda de sesiune —
 * altfel s-ar redirecta la infinit spre el însuși.
 *
 * Un singur obiect pe ecran: fișa de intrare, așezată pe arcul de
 * meridian. Nimic de citit înainte de a te loga.
 */
export default async function AdminLoginPage() {
  const user = await getAdminUser();
  if (user) redirect("/admin");

  const configured = isAuthConfigured();

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden px-5 py-16">
      {/* Grila stă pe un strat propriu: `.techgrid` poartă o mască
          radială care ar estompa și fișa dacă ar fi pe <main>. */}
      <div aria-hidden className="techgrid pointer-events-none absolute inset-0" />
      <MeridianRing className="pointer-events-none absolute left-1/2 top-1/2 h-[min(120vw,44rem)] w-[min(120vw,44rem)] -translate-x-1/2 -translate-y-1/2 text-bone" />

      <div className="glass-2 edge-light relative w-full max-w-sm p-7 sm:p-8">
        <div className="flex items-center gap-2.5 text-bone">
          <Mark size={22} />
          <span className="font-md-display text-[14px] font-semibold tracking-[0.2em]">
            MERIDIAN
          </span>
        </div>

        <p className="eyebrow mt-8">Admin · Lead-uri</p>
        <h1 className="display mt-2 text-[1.75rem] text-bone">
          Intră în panou
        </h1>
        <p className="mt-3 text-[14px] leading-relaxed text-dim">
          Acces doar pentru echipă. Nu există înregistrare — contul se creează
          din Supabase.
        </p>

        {configured ? (
          <LoginForm />
        ) : (
          <div className="mt-8 rounded-panel border border-hair-strong bg-ink/60 p-5">
            <p className="eyebrow">Nu e configurat</p>
            <p className="mt-3 text-[14px] leading-relaxed text-bone/80">
              Lipsesc variabilele de mediu pentru Supabase. Copiază
              <Code>.env.example</Code>
              în
              <Code>.env.local</Code>
              , completează
              <Code>NEXT_PUBLIC_SUPABASE_URL</Code>
              și
              <Code>NEXT_PUBLIC_SUPABASE_ANON_KEY</Code>
              , apoi repornește serverul.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="mx-1 rounded-[4px] bg-glass px-1.5 py-0.5 font-md-mono text-[12px] text-bone">
      {children}
    </code>
  );
}
