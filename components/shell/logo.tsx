import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import type { Division } from "@/lib/division";

/**
 * Wordmark MERIDIAN + mark-ul de meridian (FAZA 1).
 * Mark-ul e un glob minim cu meridianul zero trasat — același simbol
 * în ambele lumi; culoarea vine din tokens (currentColor / accent).
 */

export function MeridianMark({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      className={cn("size-5", className)}
    >
      {/* conturul globului */}
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
      {/* meridianul zero — linia de referință */}
      <ellipse
        cx="12"
        cy="12"
        rx="4"
        ry="9"
        stroke="currentColor"
        strokeWidth="1.5"
        className="text-accent"
      />
      {/* ecuatorul, abia sugerat */}
      <path
        d="M3.4 12h17.2"
        stroke="currentColor"
        strokeWidth="1"
        opacity="0.45"
      />
    </svg>
  );
}

export function Logo({
  division,
  className,
}: {
  /** Fără divizie → linkuiește spre gateway. */
  division?: Division;
  className?: string;
}) {
  return (
    <Link
      href={division ? `/${division}` : "/"}
      className={cn(
        "inline-flex items-center gap-2 text-fg transition-opacity duration-150 hover:opacity-80",
        className
      )}
    >
      <MeridianMark />
      <span className="font-display text-base font-semibold tracking-[0.18em]">
        MERIDIAN
      </span>
      {division && (
        <span className="mt-px font-mono text-[10px] uppercase tracking-[0.22em] text-accent">
          {division}
        </span>
      )}
    </Link>
  );
}
