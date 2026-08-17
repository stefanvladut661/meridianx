import { cookies } from "next/headers";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Footer } from "@/components/shell/footer";
import { getDivisionFromCookies } from "@/lib/division";

/**
 * Scope-ul paginilor legale (FAZA 7).
 *
 * Paginile legale nu aparțin niciunei lumi, dar vizitatorul vine
 * dintr-una: păstrăm paleta diviziei din care a plecat, ca să nu pară
 * că a nimerit pe alt site când dă click pe „Confidențialitate” în
 * subsol. Fără cookie (venit direct din Google) rămâne paleta neutră.
 *
 * Aici citirea cookie-ului e ieftină: paginile legale n-au nevoie să
 * fie statice, spre deosebire de restul site-ului.
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
    <div
      data-world={division ?? undefined}
      className="min-h-dvh bg-bg text-fg"
    >
      <a href="#continut" className="skip-link">
        {t("skipToContent")}
      </a>
      <main id="continut">{children}</main>
      <Footer division={division ?? "software"} />
    </div>
  );
}
