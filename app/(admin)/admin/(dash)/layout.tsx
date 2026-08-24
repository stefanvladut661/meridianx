import { redirect } from "next/navigation";
import { getAdminUser, isAuthConfigured } from "@/lib/supabase/clients";
import { signOut } from "../login/actions";
import { SessionKeeper } from "../_components/session-keeper";
import { SetupNotice } from "../_components/setup-notice";

/**
 * Garda zonei protejate (FAZA 6).
 *
 * Grupul `(dash)` nu apare în URL, deci `/admin` rămâne `/admin`, dar tot
 * ce e sub el trece pe aici. `/admin/login` stă în afara grupului, deci nu
 * se autoredirectează.
 *
 * `getAdminUser()` folosește `getUser()`, care validează tokenul la
 * Supabase — nu are încredere în cookie-ul local.
 *
 * Ordinea contează: fără Supabase configurat, redirectul spre login ar
 * duce la un formular care nu are cum să reușească. Un drum înfundat cu
 * un câmp de parolă e mai rău decât o eroare — deci arătăm instrucțiunile
 * de instalare, nu login-ul.
 */
export default async function AdminDashLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  if (!isAuthConfigured()) return <SetupNotice />;

  const user = await getAdminUser();
  if (!user) redirect("/admin/login");

  return (
    <div className="min-h-dvh">
      <SessionKeeper />

      <header className="sticky top-0 z-(--z-header) border-b border-line bg-bg/95 backdrop-blur-sm">
        <div className="flex h-14 items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-baseline gap-3">
            <span className="font-display text-sm font-semibold tracking-tight">
              MERIDIAN
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-accent-2">
              Lead-uri
            </span>
          </div>

          <div className="flex items-center gap-4">
            <span className="hidden font-mono text-[11px] text-muted sm:inline">
              {user.email}
            </span>
            <form action={signOut}>
              <button
                type="submit"
                className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted underline-offset-4 hover:text-fg hover:underline"
              >
                Ieși
              </button>
            </form>
          </div>
        </div>
      </header>

      {children}
    </div>
  );
}
