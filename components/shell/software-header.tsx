"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { buttonClasses } from "@/components/ui/button";
import { Logo } from "./logo";
import { NAV_LINKS } from "./nav-links";
import { DivisionSwitch, BothDivisionsLink } from "./division-switch";
import { LanguageSwitch } from "./language-switch";
import { MobileMenu } from "./mobile-menu";

/**
 * Header-ul lumii SOFTWARE (FAZA 1).
 * Solid, sticky, CTA permanent „Cere ofertă" → /software/brief.
 * Indicator de rută curentă: underline de semnal + citire mono a căii —
 * headerul se poartă ca un instrument, nu ca un banner. Totul sub 400ms.
 */

export function SoftwareHeader() {
  const t = useTranslations("nav");
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-(--z-header) border-b border-line bg-surface/95 backdrop-blur-sm">
      <div className="mx-auto flex h-16 w-full max-w-[88rem] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-5">
          <Logo division="software" />
          {/* citirea căii curente — indicator de secțiune, în limbajul lumii */}
          <span
            aria-hidden="true"
            className="hidden font-mono text-[11px] tracking-wide text-muted xl:block"
          >
            ~{pathname}
          </span>
        </div>

        <nav aria-label={t("primary")} className="hidden items-center gap-6 lg:flex">
          {NAV_LINKS.software.map((link) => {
            const active = pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative py-1 text-sm transition-colors duration-150",
                  active
                    ? "text-fg after:absolute after:inset-x-0 after:-bottom-0.5 after:h-0.5 after:bg-accent"
                    : "text-muted hover:text-fg"
                )}
              >
                {t(`software.${link.key}`)}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-4">
          <BothDivisionsLink className="hidden xl:block" />
          <DivisionSwitch current="software" className="hidden lg:inline-flex" />
          <LanguageSwitch className="hidden lg:flex" />
          <Link
            href="/software/brief"
            className={buttonClasses({ variant: "primary", size: "sm" })}
          >
            {t("software.cta")}
          </Link>
          <MobileMenu division="software" className="lg:hidden" />
        </div>
      </div>
    </header>
  );
}
