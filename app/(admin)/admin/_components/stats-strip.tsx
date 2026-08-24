import type { LeadStats } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

/**
 * Indicatorii din capul dashboard-ului (FAZA 6).
 *
 * Intenționat NU sunt patru carduri mari cu gradient: e o unealtă pe care
 * omul o deschide de zece ori pe zi, nu o pagină de prezentare. O bandă de
 * citiri, densă, în mono — se scanează dintr-o privire și nu fură spațiu
 * de la tabel, care e lucrul important.
 *
 * Delta față de săptămâna trecută e informație, nu decor: fără ea, „7
 * lead-uri" nu spune dacă e bine sau rău.
 */

function Reading({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: "signal" | "data";
}) {
  return (
    <div className="min-w-0 border-l border-line px-4 py-3 first:border-l-0 first:pl-0">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
        {label}
      </p>
      <p
        className={cn(
          "mt-1.5 font-mono text-2xl font-medium leading-none tabular-nums",
          accent === "signal" && "text-accent",
          accent === "data" && "text-accent-2",
          !accent && "text-fg"
        )}
      >
        {value}
      </p>
      {hint ? (
        <p className="mt-1.5 truncate font-mono text-[10px] tracking-wide text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function StatsStrip({ stats }: { stats: LeadStats }) {
  const delta = stats.thisWeek - stats.previousWeek;
  const deltaLabel =
    stats.previousWeek === 0 && stats.thisWeek === 0
      ? "la fel ca săptămâna trecută"
      : `${delta > 0 ? "+" : ""}${delta} față de săptămâna trecută`;

  const rate =
    stats.qualificationRate === null
      ? "—"
      : `${Math.round(stats.qualificationRate * 100)}%`;

  return (
    <div className="grid grid-cols-2 gap-y-1 border-y border-line sm:grid-cols-3 lg:grid-cols-5">
      <Reading
        label="Săptămâna asta"
        value={String(stats.thisWeek)}
        hint={deltaLabel}
        accent="signal"
      />
      <Reading
        label="Total"
        value={String(stats.total)}
        hint={`${stats.qualified} au trecut de „nou”`}
      />
      <Reading
        label="Video / Software"
        value={`${stats.video} / ${stats.software}`}
        hint="split pe divizii"
      />
      <Reading
        label="Fonduri"
        value={String(stats.funded)}
        hint="cele mai valoroase"
        accent="data"
      />
      <Reading
        label="Rată de calificare"
        value={rate}
        hint="contactat sau mai departe"
      />
    </div>
  );
}
