import { RESULT_LABEL, type Objective } from "@/lib/ads/constants";
import {
  deltaOf,
  formatAmount,
  formatCount,
  formatDay,
  formatPercent,
  totalsOf,
  type DayFigures,
  type Totals,
} from "@/lib/ads/metrics";
import type { StatTile } from "./stat-tiles";

/**
 * Piese comune pentru ecranele cu cifre (statistici și fișa campaniei):
 * cum se cheamă rezultatele, indicatorii cu comparația, tabelul pe zile —
 * drumul fără grafic, cu toate valorile.
 */

/**
 * Numele rezultatelor, dacă toate campaniile au același obiectiv — altfel
 * `null`: lead-urile adunate cu vizitele pe pagină nu înseamnă nimic, iar
 * costul „pe rezultat” al sumei, și mai puțin.
 */
export function resultNames(objectives: Objective[]): { plural: string; cost: string } | null {
  const unique = [...new Set(objectives)];
  return unique.length === 1 ? RESULT_LABEL[unique[0]] : null;
}

/**
 * Indicatorii. Cu un singur obiectiv: rezultatele și costul lor. Cu
 * obiective amestecate: afișările și clicurile, care se adună cinstit.
 */
export function buildTiles(
  current: Totals,
  previous: Totals,
  currency: string,
  names: { plural: string; cost: string } | null
): StatTile[] {
  const middle: StatTile[] = names
    ? [
        {
          label: names.plural,
          value: formatCount(current.results),
          delta: deltaOf(current.results, previous.results, "up_good"),
        },
        {
          label: names.cost,
          value: formatAmount(current.costPerResult, currency),
          delta: deltaOf(current.costPerResult, previous.costPerResult, "up_bad"),
        },
      ]
    : [
        {
          label: "Afișări",
          value: formatCount(current.impressions),
          delta: deltaOf(current.impressions, previous.impressions, "neutral"),
        },
        {
          label: "Clicuri pe link",
          value: formatCount(current.clicks),
          delta: deltaOf(current.clicks, previous.clicks, "up_good"),
        },
      ];
  return [
    {
      label: "Cheltuială",
      value: formatAmount(current.spend, currency),
      delta: deltaOf(current.spend, previous.spend, "neutral"),
    },
    ...middle,
    {
      label: "CTR",
      value: formatPercent(current.ctr),
      note: "clicuri pe link / afișări",
      delta: deltaOf(current.ctr, previous.ctr, "up_good"),
    },
    {
      label: "CPC",
      value: formatAmount(current.cpc, currency),
      note: "cost pe clic pe link",
      delta: deltaOf(current.cpc, previous.cpc, "up_bad"),
    },
    {
      label: "CPM",
      value: formatAmount(current.cpm, currency),
      note: "cost la 1.000 de afișări",
      delta: deltaOf(current.cpm, previous.cpm, "up_bad"),
    },
  ];
}

/** Tabelul pe zile — aceleași cifre ca graficele, pentru cine nu le folosește. */
export function DaysTable({
  days,
  currency,
  resultLabel,
  caption,
}: {
  days: DayFigures[];
  currency: string;
  /** `null` = obiective amestecate: fără coloanele de rezultate. */
  resultLabel: string | null;
  caption: string;
}) {
  const rows = [...days].reverse();
  const total = totalsOf(days);
  const headers = ["Ziua", "Cheltuială", "Afișări", "Clicuri pe link", "CTR", ...(resultLabel ? [resultLabel, "Cost / rezultat"] : [])];
  return (
    <div className="overflow-x-auto rounded-panel-lg border border-hair">
      <table className="w-full min-w-[40rem] border-collapse text-left text-[13.5px]">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-hair bg-glass">
            {headers.map((header, index) => (
              <th
                key={header}
                scope="col"
                className={`whitespace-nowrap px-4 py-3 font-md-mono text-[11px] font-normal uppercase tracking-[0.14em] text-dim ${index === 0 ? "" : "text-right"}`}
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="tabular-nums">
          {rows.map((day) => {
            const row = totalsOf([day]);
            const empty = day.spend === 0 && day.impressions === 0;
            return (
              <tr key={day.date} className="border-b border-hair last:border-b-0">
                <th scope="row" className="whitespace-nowrap px-4 py-2.5 text-left font-normal text-bone/85">
                  {formatDay(day.date, true)}
                </th>
                {empty ? (
                  <td colSpan={headers.length - 1} className="px-4 py-2.5 text-right text-dim">
                    fără livrare
                  </td>
                ) : (
                  <>
                    <td className="px-4 py-2.5 text-right text-bone">{formatAmount(day.spend, currency)}</td>
                    <td className="px-4 py-2.5 text-right text-bone/85">{formatCount(day.impressions)}</td>
                    <td className="px-4 py-2.5 text-right text-bone/85">{formatCount(day.clicks)}</td>
                    <td className="px-4 py-2.5 text-right text-bone/85">{formatPercent(row.ctr)}</td>
                    {resultLabel ? (
                      <>
                        <td className="px-4 py-2.5 text-right text-bone">{formatCount(day.results)}</td>
                        <td className="px-4 py-2.5 text-right text-bone/85">{formatAmount(row.costPerResult, currency)}</td>
                      </>
                    ) : null}
                  </>
                )}
              </tr>
            );
          })}
        </tbody>
        <tfoot className="tabular-nums">
          <tr className="border-t border-hair-strong bg-glass">
            <th scope="row" className="px-4 py-3 text-left font-semibold text-bone">
              Total
            </th>
            <td className="px-4 py-3 text-right font-semibold text-bone">{formatAmount(total.spend, currency)}</td>
            <td className="px-4 py-3 text-right text-bone/85">{formatCount(total.impressions)}</td>
            <td className="px-4 py-3 text-right text-bone/85">{formatCount(total.clicks)}</td>
            <td className="px-4 py-3 text-right text-bone/85">{formatPercent(total.ctr)}</td>
            {resultLabel ? (
              <>
                <td className="px-4 py-3 text-right font-semibold text-bone">{formatCount(total.results)}</td>
                <td className="px-4 py-3 text-right text-bone/85">{formatAmount(total.costPerResult, currency)}</td>
              </>
            ) : null}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
