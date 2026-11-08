import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AlertCircle, ArrowRight } from "lucide-react";
import { getAdminUser, isAuthConfigured } from "@/lib/supabase/clients";
import { PanouMark } from "@/components/panou/layout/mark";
import { btnClass } from "@/components/panou/ui/primitives";
import { loginErrorMessage } from "./messages";

export const metadata: Metadata = {
  title: "Autentificare — MERIDIAN Admin",
  robots: { index: false, follow: false },
};

/**
 * /admin/login, în designul din redesign: panou stâng cu lumină și grilă,
 * dreapta cu intrarea. Stă în afara grupului `(dash)`, deci nu trece prin garda
 * de sesiune — altfel s-ar redirecta la infinit spre el însuși.
 *
 * Intrarea e doar cu Google (prototipul avea și email + parolă, dar contul se
 * deschide din Google și lista `ADMIN_EMAILS`); `?eroare=` vine de la rutele
 * din `/admin/auth/`.
 */
export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ eroare?: string | string[] }>;
}) {
  const user = await getAdminUser();
  if (user) redirect("/admin");

  const configured = isAuthConfigured();
  const error = loginErrorMessage((await searchParams).eroare);

  return (
    <main className="panou-ui relative flex min-h-dvh flex-col bg-background text-foreground lg:grid lg:grid-cols-[1.05fr_1fr]">
      <div className="relative hidden flex-col justify-between overflow-hidden border-r border-white/[0.07] p-12 lg:flex">
        <div className="pu-aurora absolute inset-0" aria-hidden="true" />
        <div className="pu-gridlines absolute inset-0 opacity-30" aria-hidden="true" />
        <div className="relative flex items-center gap-3">
          <PanouMark />
          <p className="pu-display text-[20px] leading-none tracking-[0.16em]">MERIDIAN</p>
        </div>
        <div className="relative max-w-md">
          <h2 className="pu-display text-[48px] leading-[1.02] text-foreground">
            Un singur
            <br />
            loc de lucru.
          </h2>
        </div>
        <span aria-hidden="true" />
      </div>

      <div className="flex flex-1 items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-[382px]">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <PanouMark size="sm" />
            <p className="pu-display text-[18px] leading-none tracking-[0.16em]">MERIDIAN</p>
          </div>

          <h1 className="text-[28px] font-semibold leading-tight">Intră în panou</h1>

          {error ? (
            <div role="alert" className="mt-5 flex items-start gap-2.5 rounded-xl border border-rose/25 bg-rose/[0.08] px-3.5 py-3 text-[14px] leading-relaxed text-[#FFC2CE]">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{error}</span>
            </div>
          ) : null}

          {configured ? (
            <div className="mt-6">
              {/* <a>, nu <Link>: ținta e o rută care redirecționează spre Google, nu o pagină.
                  Link ar preîncărca-o (adică ar porni singur o intrare) și ar cere-o prin fetch,
                  pe care redirecționarea externă îl rupe. Merge și înainte de hidratare. */}
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
              <a href="/admin/auth/google" className={btnClass({ variant: "primary", size: "lg", className: "w-full rounded-xl text-[15px] font-semibold" })}>
                <GoogleMark />
                Continuă cu Google
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </a>
            </div>
          ) : (
            <div className="mt-6 rounded-xl border border-white/[0.09] bg-white/[0.03] p-4 text-[14px] leading-relaxed text-muted-foreground">
              <p className="text-[12.5px] uppercase tracking-[0.14em]">Nu e configurat</p>
              <p className="mt-2">
                Lipsesc <Code>NEXT_PUBLIC_SUPABASE_URL</Code> și <Code>NEXT_PUBLIC_SUPABASE_ANON_KEY</Code> în <Code>.env.local</Code>. Completează-le și
                repornește serverul.
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return <code className="mx-0.5 rounded bg-white/[0.07] px-1.5 py-0.5 font-mono text-[13px] text-foreground">{children}</code>;
}

/** „G”-ul Google, în culorile din ghidul lor pentru butonul de intrare. */
function GoogleMark() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4 shrink-0">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}
