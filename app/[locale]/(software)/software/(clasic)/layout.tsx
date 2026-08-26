import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import { SoftwareHeader } from "@/components/shell/software-header";
import { Footer } from "@/components/shell/footer";

/**
 * Scope-ul lumii SOFTWARE (FAZA 0 a creat fișierul; FAZA 1 îl deține
 * pentru integrarea shell-ului — header software, footer).
 *
 * data-world="software" fixează tokens-ii semantici pe paleta
 * blueprint (signal/data). Fără Lenis, fără cursor custom aici — vezi
 * CLAUDE.md §2. Nu seta culori brute --v-* aici.
 *
 * Notă pentru F4/F5: header-ul software e STICKY și solid (h-16, în
 * flux) — conținutul începe sub el natural. Linia meridian verticală
 * cu gradații e signature-ul paginilor (F4), nu al shell-ului.
 */
export default async function SoftwareWorldLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("common");

  return (
    <div data-world="software" className="min-h-dvh bg-bg text-fg">
      <a href="#continut" className="skip-link">
        {t("skipToContent")}
      </a>
      <SoftwareHeader />
      <main id="continut">{children}</main>
      <Footer division="software" />
    </div>
  );
}
