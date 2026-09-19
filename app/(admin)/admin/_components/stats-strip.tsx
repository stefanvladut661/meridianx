import type { ReactNode } from "react";
import type { LeadStats } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";
import { DIVISION_TONE } from "./tone";

/**
 * Indicatorii din capul dashboard-ului (FAZA 6).
 *
 * Intenționat NU sunt carduri separate cu iconiță și gradient: e o
 * unealtă pe care omul o deschide de zece ori pe zi. O singură bandă
 * împărțită de hairline-uri — aceeași grilă tehnică de pe site — se
 * scanează dintr-o privire și nu fură spațiu de la tabel.
 *
 * Delta față de săptămâna trecută e informație, nu decor: fără ea, „7
 * lead-uri" nu spune dacă e bine sau rău.
 */

function Reading({
  label,
  value,
  hint,
  tone,
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: "bright" | "funded";
  className?: string;
}) {
  return (
    <div className={cn("min-w-0 bg-char px-5 py-4", className)}>
      <p className="eyebrow">{label}</p>
      <p
        className={cn(
          "mt-2 font-md-display text-[1.75rem] font-semibold leading-none tracking-tight tabular-nums",
          tone === "bright" && "text-bone",
          tone === "funded" && "text-[#f0c060]",
          !tone && "text-bone/85"
        )}
      >
        {value}
      </p>
      {hint ? (
        <p className="mt-2 text-[12px] leading-snug text-dim">{hint}</p>
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
    <section
      aria-label="Indicatori"
      className="grid grid-cols-2 gap-px overflow-hidden rounded-panel-lg border border-hair bg-hair md:grid-cols-3 lg:grid-cols-5"
    >
      <Reading
        label="Săptămâna asta"
        value={String(stats.thisWeek)}
        hint={deltaLabel}
        tone="bright"
        /* Pe telefon, citirea săptămânii ia un rând întreg: e cea la
           care te uiți primul, iar celelalte patru cad exact 2×2. */
        className="col-span-2 md:col-span-1"
      />
      <Reading
        label="Total"
        value={String(stats.total)}
        hint={`${stats.qualified} au trecut de „nou”`}
      />
      <Reading
        label="Video / Software"
        value={
          <>
            <span className={DIVISION_TONE.video.text}>{stats.video}</span>
            <span className="mx-1.5 text-dim">/</span>
            <span className={DIVISION_TONE.software.text}>{stats.software}</span>
          </>
        }
        hint="albastru video · verde software"
      />
      <Reading
        label="Fonduri"
        value={String(stats.funded)}
        hint="cele mai valoroase"
        tone="funded"
      />
      <Reading
        label="Rată de calificare"
        value={rate}
        hint="contactat sau mai departe"
        /* La 768 rămân cinci citiri pe trei coloane: ultima ia două,
           ca banda să se închidă fără o celulă goală. */
        className="md:col-span-2 lg:col-span-1"
      />
    </section>
  );
}
