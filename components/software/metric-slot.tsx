import { PENDING_METRIC } from "@/content/software/projects";
import { cn } from "@/lib/utils";

/**
 * Slotul de metrică (FAZA 4).
 *
 * Decizia de design care ține loc de minciună: nu avem încă cifre reale,
 * deci nu inventăm nici una. Slotul se afișează ca o citire de instrument
 * necalibrat — rezervat, marcat, evident gol. E mai credibil decât un
 * „+340% conversii” pe care oricine îl citește ca decor (CLAUDE.md §5).
 *
 * Când vine cifra reală, se schimbă un singur string în content/.
 */
export function MetricSlot({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  const pending = value === PENDING_METRIC;

  return (
    <div
      className={cn(
        "border-t border-line pt-3",
        pending && "border-dashed",
        className
      )}
    >
      <p
        className={cn(
          "font-mono tabular-nums leading-none",
          pending
            ? "text-2xl tracking-[0.12em] text-muted"
            : "text-3xl font-medium tracking-tight text-accent-2"
        )}
      >
        {pending ? (
          <>
            <span aria-hidden="true">—,—</span>
            <span className="sr-only">Cifră indisponibilă</span>
          </>
        ) : (
          value
        )}
      </p>
      <p className="mt-2 text-sm leading-snug text-fg/70">{label}</p>
      {pending ? (
        <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
          slot rezervat
        </p>
      ) : null}
    </div>
  );
}
