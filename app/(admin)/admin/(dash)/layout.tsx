import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminUser, isAuthConfigured } from "@/lib/supabase/clients";
import { Mark } from "@/components/site/mark";
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
    <div className="relative min-h-dvh">
      <SessionKeeper />

      <a href="#continut" className="skip-link">
        Sari la conținut
      </a>

      {/* Aceeași bară ca pe site: marcă, o etichetă mono care spune unde
          ești, acțiunile la dreapta. Glass peste conținutul care trece
          pe sub ea la scroll. */}
      <header className="sticky top-0 z-30 border-b border-hair bg-ink/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[1400px] items-center gap-4 px-5 sm:px-8">
          <Link href="/admin" className="flex items-center gap-2.5 text-bone">
            <Mark size={22} />
            <span className="font-md-display text-[15px] font-semibold tracking-[0.2em]">
              MERIDIAN
            </span>
          </Link>

          <span aria-hidden className="hidden h-4 w-px bg-hair-strong sm:block" />
          <span className="eyebrow hidden sm:inline">Lead-uri</span>

          <div className="ml-auto flex items-center gap-4">
            <span className="hidden font-md-mono text-[11px] tracking-wide text-dim md:inline">
              {user.email}
            </span>
            <form action={signOut}>
              <button
                type="submit"
                className="btn btn-ghost !min-h-9 !px-4 !py-2 !text-[12.5px]"
              >
                Ieși
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* Lumina celor două lumi, în capul paginii: albastru video la
          stânga, verde software la dreapta — aceleași blob-uri ca pe
          site, fără să concureze cu tabelul de sub ele. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 z-0 h-[30rem] overflow-hidden [mask-image:linear-gradient(to_bottom,#000_30%,transparent)]"
      >
        <div className="aurora-drift absolute left-[-30%] top-[-45%] h-[26rem] w-[34rem] rounded-full bg-[radial-gradient(closest-side,rgb(47_91_255/0.42),rgb(47_91_255/0.12)_45%,transparent_72%)] sm:left-[-10%] sm:h-[34rem] sm:w-[52rem]" />
        <div className="aurora-drift-2 absolute right-[-30%] top-[-50%] h-[24rem] w-[32rem] rounded-full bg-[radial-gradient(closest-side,rgb(31_181_131/0.36),rgb(31_181_131/0.1)_45%,transparent_72%)] sm:right-[-8%] sm:h-[32rem] sm:w-[48rem]" />
      </div>

      <div id="continut" className="relative">{children}</div>
    </div>
  );
}
