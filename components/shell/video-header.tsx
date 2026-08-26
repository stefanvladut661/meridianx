"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { Logo } from "./logo";
import { NAV_LINKS } from "./nav-links";
import { DivisionSwitch, BothDivisionsLink } from "./division-switch";
import { LanguageSwitch } from "./language-switch";
import { MobileMenu } from "./mobile-menu";

/**
 * Header-ul lumii VIDEO (FAZA 1).
 * Minimal, aproape invizibil peste conținut; se condensează la scroll
 * (fundal blur + hairline + înălțime redusă). HUD-ul de cameră e separat
 * (camera-hud.tsx) — headerul rămâne doar navigație.
 */

export function VideoHeader() {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const [condensed, setCondensed] = useState(false);

  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        setCondensed(window.scrollY > 32);
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-(--z-header) transition-[background-color,border-color,backdrop-filter] duration-300",
        condensed
          ? "border-b border-line/60 bg-bg/75 backdrop-blur-md"
          : "border-b border-transparent bg-transparent"
      )}
    >
      <div
        className={cn(
          "mx-auto flex w-full max-w-[88rem] items-center justify-between gap-4 px-4 transition-[height] duration-300 sm:px-6 lg:px-8",
          condensed ? "h-12" : "h-16"
        )}
      >
        <Logo division="video" />

        <nav aria-label={t("primary")} className="hidden items-center gap-6 md:flex">
          {NAV_LINKS.video.map((link) => {
            const active = pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "text-sm tracking-wide transition-colors duration-200",
                  active
                    ? "text-fg underline decoration-accent decoration-2 underline-offset-8"
                    : "text-muted hover:text-fg"
                )}
              >
                {t(`video.${link.key}`)}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-4">
          <BothDivisionsLink className="hidden lg:block" />
          <DivisionSwitch current="video" className="hidden md:inline-flex" />
          <LanguageSwitch className="hidden md:flex" />
          <MobileMenu division="video" className="md:hidden" />
        </div>
      </div>
    </header>
  );
}
