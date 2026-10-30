"use client";

import { formatAmount, formatCount, formatDay, formatPercent, totalsOf, type DayFigures } from "@/lib/ads/metrics";
import { cn } from "@/lib/utils";

/**
 * Tabelul pe zile (prototip: „Zi cu zi”), cu aceleași cifre ca graficele — drumul
 * fără grafic. Cea mai nouă zi sus; ziua aleasă (`selected`) e luminată; o zi
 * fără livrare spune „fără livrare”. Totalul stă jos. Cu `onSelect`, trecerea
 * mouse-ului alege ziua (săgețile și butoanele le dă `DayExplorer`).
 */
export function DaysTable({
  days,
  currency,
  resultLabel,
  caption,
  selected,
  onSelect,
  maxHeight = "max-h-[360px]",
}: {
  days: DayFigures[];
  currency: string;
  /** `null` = nicio campanie măsurată: fără coloanele de rezultate. */
  resultLabel: string | null;
  caption: string;
  selected?: string | null;
  onSelect?: (date: string) => void;
  maxHeight?: string;
}) {
  const rows = [...days].reverse();
  const total = totalsOf(days);
  const head = "px-2 py-2 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground";

  return (
    <div className={cn("overflow-auto", maxHeight)}>
      <table className="w-full min-w-[34rem] text-left">
        <caption className="sr-only">{caption}</caption>
        <thead className="sticky top-0 bg-card">
          <tr className="border-b border-white/[0.06]">
            <th scope="col" className={cn(head, "pl-4")}>Zi</th>
            <th scope="col" className={cn(head, "text-right")}>Cheltuială</th>
            <th scope="col" className={cn(head, "text-right")}>Afișări</th>
            <th scope="col" className={cn(head, "text-right")}>Clicuri pe link</th>
            <th scope="col" className={cn(head, "text-right")}>CTR</th>
            {resultLabel ? (
              <>
                <th scope="col" className={cn(head, "text-right")}>{resultLabel}</th>
                <th scope="col" className={cn(head, "pr-4 text-right")}>Cost / rez.</th>
              </>
            ) : (
              <th scope="col" className={cn(head, "pr-4")}>
                <span className="sr-only">Rezultate</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((day) => {
            const row = totalsOf([day]);
            const empty = day.spend === 0 && day.impressions === 0;
            const isSelected = selected === day.date;
            return (
              <tr
                key={day.date}
                onMouseEnter={onSelect ? () => onSelect(day.date) : undefined}
                aria-selected={onSelect ? isSelected : undefined}
                className={cn("border-b border-white/[0.03] text-[12px] last:border-0", isSelected ? "bg-white/[0.06]" : "hover:bg-white/[0.03]")}
              >
                <th scope="row" className="pu-num whitespace-nowrap py-1.5 pl-4 pr-2 text-left font-normal text-foreground/70">
                  {formatDay(day.date, true)}
                </th>
                {empty ? (
                  <td colSpan={resultLabel ? 6 : 5} className="px-2 py-1.5 pr-4 text-right text-muted-foreground">
                    fără livrare
                  </td>
                ) : (
                  <>
                    <td className="pu-num px-2 py-1.5 text-right">{formatAmount(day.spend, currency)}</td>
                    <td className="pu-num px-2 py-1.5 text-right text-foreground/85">{formatCount(day.impressions)}</td>
                    <td className="pu-num px-2 py-1.5 text-right text-foreground/85">{formatCount(day.clicks)}</td>
                    <td className="pu-num px-2 py-1.5 text-right text-foreground/85">{formatPercent(row.ctr)}</td>
                    {resultLabel ? (
                      <>
                        <td className="pu-num px-2 py-1.5 text-right">{formatCount(day.results)}</td>
                        <td className="pu-num py-1.5 pl-2 pr-4 text-right text-muted-foreground">{formatAmount(row.costPerResult, currency)}</td>
                      </>
                    ) : (
                      <td />
                    )}
                  </>
                )}
              </tr>
            );
          })}
        </tbody>
        <tfoot className="sticky bottom-0 bg-card">
          <tr className="border-t border-white/[0.09] text-[12px] font-medium">
            <th scope="row" className="py-2 pl-4 pr-2 text-left">Total</th>
            <td className="pu-num px-2 py-2 text-right">{formatAmount(total.spend, currency)}</td>
            <td className="pu-num px-2 py-2 text-right text-foreground/85">{formatCount(total.impressions)}</td>
            <td className="pu-num px-2 py-2 text-right text-foreground/85">{formatCount(total.clicks)}</td>
            <td className="pu-num px-2 py-2 text-right text-foreground/85">{formatPercent(total.ctr)}</td>
            {resultLabel ? (
              <>
                <td className="pu-num px-2 py-2 text-right">{formatCount(total.results)}</td>
                <td className="pu-num py-2 pl-2 pr-4 text-right text-muted-foreground">{formatAmount(total.costPerResult, currency)}</td>
              </>
            ) : (
              <td />
            )}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
