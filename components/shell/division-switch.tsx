"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import type { Division } from "@/lib/division";
import { useDivision } from "@/lib/hooks/use-division";
import { DIVISION_HOME } from "./nav-links";

/**
 * Comutatorul discret de divizie + link-ul „Vezi ambele divizii" (FAZA 1).
 *
 * Mecanismul „Vezi ambele divizii": link spre `/?stay=1`. Param-ul `stay`
 * face pagina de gateway să NU redirecteze după cookie; în plus, cookie-ul
 * se șterge aici la click (și, plasă de siguranță, la mount pe gateway).
 */

export function DivisionSwitch({
  current,
  className,
}: {
  current: Division;
  className?: string;
}) {
  const t = useTranslations("nav");
  const { setDivision } = useDivision();
  const other: Division = current === "video" ? "software" : "video";

  return (
    <Link
      href={DIVISION_HOME[other]}
      onClick={() => setDivision(other)}
      aria-label={other === "video" ? t("switchToVideo") : t("switchToSoftware")}
      className={cn(
        "group inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.15em] text-muted transition-colors duration-150 hover:text-fg",
        className
      )}
    >
      <span
        aria-hidden="true"
        className="inline-block transition-transform duration-150 group-hover:translate-x-0.5"
      >
        &rarr;
      </span>
      {other}
    </Link>
  );
}

export function BothDivisionsLink({ className }: { className?: string }) {
  const t = useTranslations("common");
  const { clearDivision } = useDivision();

  return (
    <Link
      href={{ pathname: "/", query: { stay: "1" } }}
      onClick={() => clearDivision()}
      className={cn(
        "text-xs text-muted underline-offset-4 transition-colors duration-150 hover:text-fg hover:underline",
        className
      )}
    >
      {t("seeBothDivisions")}
    </Link>
  );
}
