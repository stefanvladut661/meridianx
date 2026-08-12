"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { cn } from "@/lib/utils";

/**
 * Comutator de limbă RO/EN (FAZA 1).
 * Păstrează ruta curentă — Link din @/i18n/navigation cu prop `locale`.
 */

export function LanguageSwitch({ className }: { className?: string }) {
  const locale = useLocale();
  const pathname = usePathname();
  const t = useTranslations("common");

  return (
    <nav aria-label={t("language")} className={cn("flex items-center", className)}>
      {routing.locales.map((l: Locale, i) => (
        <span key={l} className="flex items-center">
          {i > 0 && (
            <span aria-hidden="true" className="mx-1.5 h-3 w-px bg-line" />
          )}
          {l === locale ? (
            <span
              aria-current="true"
              className="font-mono text-[11px] uppercase tracking-[0.15em] text-fg"
            >
              {l}
            </span>
          ) : (
            <Link
              href={pathname}
              locale={l}
              aria-label={t("switchToEnglish")}
              className="font-mono text-[11px] uppercase tracking-[0.15em] text-muted transition-colors duration-150 hover:text-fg"
            >
              {l}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}
