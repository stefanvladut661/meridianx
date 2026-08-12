"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import type { Division } from "@/lib/division";
import { useDivision } from "@/lib/hooks/use-division";
import { DIVISION_HOME, NAV_LINKS } from "./nav-links";
import { LanguageSwitch } from "./language-switch";
import { MeridianMark } from "./logo";

/**
 * Meniul mobil (FAZA 1) — pe <dialog> nativ: focus trap, Escape și
 * restaurarea focusului vin din browser. Panou full-screen, moștenește
 * lumea din data-world (e randat în interiorul layout-ului de grup).
 */

export function MobileMenu({
  division,
  className,
}: {
  division: Division;
  className?: string;
}) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const pathname = usePathname();
  const { setDivision, clearDivision } = useDivision();
  const other: Division = division === "video" ? "software" : "video";

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

  // Blochează scroll-ul paginii cât timp meniul e deschis.
  useEffect(() => {
    if (!open) return;
    const previous = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = previous;
    };
  }, [open]);

  // Închide la schimbarea rutei.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const links = NAV_LINKS[division];

  return (
    <div className={className}>
      <button
        type="button"
        aria-expanded={open}
        aria-label={t("common.openMenu")}
        onClick={() => setOpen(true)}
        className="inline-flex size-10 items-center justify-center rounded-sm text-fg transition-colors duration-150 hover:bg-surface"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="size-5"
        >
          <path d="M2 5.5h16M2 10h16M2 14.5h10" />
        </svg>
      </button>

      <dialog
        ref={dialogRef}
        onClose={() => setOpen(false)}
        aria-label={t("nav.primary")}
        className="m-0 h-dvh max-h-none w-screen max-w-none bg-bg p-0 text-fg backdrop:bg-transparent"
      >
        {/* dialog-ul iese din subtree-ul stilat doar vizual, nu din DOM —
            data-world de pe layout rămâne deasupra lui, tokens-ii se aplică */}
        <div className="flex h-full flex-col px-6 py-5">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-2">
              <MeridianMark />
              <span className="font-display text-base font-semibold tracking-[0.18em]">
                MERIDIAN
              </span>
              <span className="mt-px font-mono text-[10px] uppercase tracking-[0.22em] text-accent">
                {division}
              </span>
            </span>
            <button
              type="button"
              aria-label={t("common.closeMenu")}
              onClick={() => setOpen(false)}
              className="inline-flex size-10 items-center justify-center rounded-sm text-fg transition-colors duration-150 hover:bg-surface"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="size-5"
              >
                <path d="M3 3l10 10M13 3L3 13" />
              </svg>
            </button>
          </div>

          <nav aria-label={t("nav.primary")} className="mt-10 flex-1">
            <ul className="flex flex-col gap-1">
              <li>
                <Link
                  href={DIVISION_HOME[division]}
                  onClick={() => setOpen(false)}
                  aria-current={pathname === DIVISION_HOME[division] ? "page" : undefined}
                  className={cn(
                    "block py-2.5 font-display text-3xl tracking-tight transition-colors duration-150",
                    pathname === DIVISION_HOME[division]
                      ? "text-fg"
                      : "text-muted hover:text-fg"
                  )}
                >
                  {t(`nav.${division}.home`)}
                </Link>
              </li>
              {links.map((link) => {
                const active = pathname.startsWith(link.href);
                return (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      onClick={() => setOpen(false)}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "block py-2.5 font-display text-3xl tracking-tight transition-colors duration-150",
                        active ? "text-fg" : "text-muted hover:text-fg"
                      )}
                    >
                      {t(`nav.${division}.${link.key}`)}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="flex flex-col gap-4 border-t border-line pt-5">
            <Link
              href={DIVISION_HOME[other]}
              onClick={() => {
                setDivision(other);
                setOpen(false);
              }}
              className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.15em] text-muted transition-colors duration-150 hover:text-fg"
            >
              <span aria-hidden="true">&rarr;</span>
              {other === "video" ? t("nav.switchToVideo") : t("nav.switchToSoftware")}
            </Link>
            <div className="flex items-center justify-between">
              <Link
                href={{ pathname: "/", query: { stay: "1" } }}
                onClick={() => {
                  clearDivision();
                  setOpen(false);
                }}
                className="text-sm text-muted underline-offset-4 transition-colors duration-150 hover:text-fg hover:underline"
              >
                {t("common.seeBothDivisions")}
              </Link>
              <LanguageSwitch />
            </div>
          </div>
        </div>
      </dialog>
    </div>
  );
}
