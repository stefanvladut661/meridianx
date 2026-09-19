import type { ReactNode } from "react";
import type { LeadStats } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";
import { DIVISION_TONE } from "./tone";

/**
 * Indicatorii din capul dashboard-ului (FAZA 6).
 *
 * O singură bandă împărțită de hairline-uri — nu cinci carduri cu
 * iconiță — dar fiecare citire are propria pată de lumină: albă pentru
 * săptămâna curentă (cea la care te uiți primul), albastru → verde
 * pentru împărțirea pe divizii, chihlimbar pentru fonduri. Culoarea
 * spune ce e cifra înainte să citești eticheta.
 *
 * Delta față de săptămâna trecută e informație, nu decor: fără ea, „7
 * lead-uri" nu spune dacă e bine sau rău.
 */

type Tone = "week" | "split" | "funded";

const TONE_BG: Record<Tone, string> = {
  week: "bg-[radial-gradient(120%_140%_at_0%_0%,rgb(255_255_255/0.16),transparent_60%)]",
  split:
    "bg-[linear-gradient(110deg,rgb(47_91_255/0.28),rgb(47_91_255/0.06)_45%,rgb(31_181_131/0.06)_55%,rgb(31_181_131/0.28))]",
  funded: "bg-[radial-gradient(120%_140%_at_0%_0%,rgb(240_180_41/0.28),transparent_60%)]",
};

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
  tone?: Tone;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "min-w-0 bg-char px-5 py-5",
        tone && TONE_BG[tone],
        className
      )}
    >
      <p className="eyebrow !text-[11.5px]">{label}</p>
      <p
        className={cn(
          "mt-2.5 font-md-display text-[2.25rem] font-semibold leading-none tracking-tight tabular-nums",
          tone === "funded" ? "text-[#f0b429]" : "text-bone"
        )}
      >
        {value}
      </p>
      {hint ? (
        <p className="mt-2.5 text-[13.5px] leading-snug text-bone/60">{hint}</p>
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
        tone="week"
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
            <span className="mx-2 text-bone/30">/</span>
            <span className={DIVISION_TONE.software.text}>{stats.software}</span>
          </>
        }
        hint="albastru video · verde software"
        tone="split"
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
