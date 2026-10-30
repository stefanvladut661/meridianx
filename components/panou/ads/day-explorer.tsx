"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatAmount, formatCount, formatDay, type DayFigures } from "@/lib/ads/metrics";
import { Btn, Card, SectionTitle, Stat } from "../ui/primitives";
import { DaysTable } from "./days-table";

/**
 * „Fișa zilei” din prototip (Statistici): ziua aleasă — cu săgețile ← → sau cu
 * mouse-ul pe tabel — și, dedesubt, toate zilele cu totalul. Tabelul rămâne
 * drumul fără grafic: aceleași cifre ca în grafice.
 */
export function DayExplorer({
  days,
  currency,
  resultLabel,
  caption,
}: {
  days: DayFigures[];
  currency: string;
  resultLabel: string | null;
  caption: string;
}) {
  const [index, setIndex] = useState(Math.max(days.length - 1, 0));
  const safe = Math.min(Math.max(index, 0), Math.max(days.length - 1, 0));
  const selected = days[safe];

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionTitle title="Fișa zilei" hint={selected ? formatDay(selected.date, true) : "—"} />
        <div
          className="flex items-center gap-1.5"
          tabIndex={0}
          role="group"
          aria-label="Alege ziua cu săgețile stânga și dreapta"
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft") {
              event.preventDefault();
              setIndex(safe - 1);
            }
            if (event.key === "ArrowRight") {
              event.preventDefault();
              setIndex(safe + 1);
            }
          }}
        >
          <Btn size="xs" variant="outline" icon={ChevronLeft} onClick={() => setIndex(safe - 1)} disabled={safe <= 0} aria-label="Ziua anterioară" />
          <span className="pu-num px-2 text-[11.5px] text-muted-foreground" aria-live="polite">
            {days.length === 0 ? 0 : safe + 1} / {days.length}
          </span>
          <Btn size="xs" variant="outline" icon={ChevronRight} onClick={() => setIndex(safe + 1)} disabled={safe >= days.length - 1} aria-label="Ziua următoare" />
        </div>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
        <Stat label="Ziua" value={selected ? formatDay(selected.date) : "—"} />
        <Stat label="Cheltuială" value={formatAmount(selected?.spend ?? 0, currency)} />
        <Stat
          label={resultLabel ?? "Rezultate"}
          value={resultLabel ? formatCount(selected?.results ?? 0) : "—"}
          hint={resultLabel ? (selected?.results ? `${formatAmount(selected.spend / selected.results, currency)} / rezultat` : "fără rezultate") : "nemăsurat"}
        />
      </div>
      <div className="mt-3 -mx-5 sm:-mx-6">
        <DaysTable days={days} currency={currency} resultLabel={resultLabel} caption={caption} selected={selected?.date ?? null} onSelect={(date) => setIndex(days.findIndex((day) => day.date === date))} maxHeight="max-h-[300px]" />
      </div>
    </Card>
  );
}
