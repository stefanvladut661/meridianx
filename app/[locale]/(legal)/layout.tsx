import { cookies } from "next/headers";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Mark } from "@/components/site/mark";
import { LEGAL_LINKS } from "@/components/site/legal-links";
import { getDivisionFromCookies } from "@/lib/division";

/**
 * Shell-ul paginilor legale.
 *
 * Paginile legale nu aparțin niciunei lumi, dar vizitatorul vine
 * dintr-una: păstrăm scope-ul diviziei din care a plecat, ca să nu pară
 * că a nimerit pe alt site când dă click pe „Confidențialitate” în
 * subsol. Fără cookie (venit direct din Google) rămâne scope-ul neutru
 * al porții — același pe care îl vede oricine intră pe rădăcină.
 *
 * Citirea cookie-ului e ieftină aici: paginile legale n-au nevoie să
 * fie statice, spre deosebire de landing-uri.
 */
export default async function LegalLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("common");
  const division = getDivisionFromCookies(await cookies());

  return (
    <div data-scope={division ?? "gate"} className="md-root min-h-dvh">
      <a href="#continut" className="skip-link">
        {t("skipToContent")}
      </a>

      <header className="border-b border-hair">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-5 py-5 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5 text-bone">
            <Mark size={24} />
            <span className="font-md-display text-[15px] font-bold tracking-tight">
              MERIDIAN
            </span>
          </Link>
          <nav aria-label="Documente legale">
            <ul className="flex flex-wrap gap-x-5 gap-y-1">
              {LEGAL_LINKS.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="text-[13.5px] text-dim transition-colors hover:text-bone"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </header>

      <main id="continut">{children}</main>

      <footer className="border-t border-hair">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-4 px-5 py-8 text-[13px] text-dim sm:px-6">
          <span>© 2026 MERIDIAN</span>
          <span className="flex gap-5">
            <Link href="/video" className="transition-colors hover:text-bone">
              Video
            </Link>
            <Link
              href="/software"
              className="transition-colors hover:text-bone"
            >
              Software
            </Link>
          </span>
        </div>
      </footer>
    </div>
  );
}
