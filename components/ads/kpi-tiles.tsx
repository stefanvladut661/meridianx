import { deltaOf, formatAmount, formatCount, formatDelta, type Delta, type Direction } from "@/lib/ads/metrics";
import { RESULT_KIND_LABEL, resultUnit } from "@/lib/ads/model/results";
import type { CurrencyTotals } from "@/lib/ads/model/rows";
import type { ResultKind } from "@/lib/ads/model/types";
import { cn } from "@/lib/utils";

/**
 * Cele patru cifre mari: Cheltuit, Rezultate, Cost per rezultat, Clickuri — pe
 * ce e ales sus. Monedele nu se adună: fiecare are rândul ei. Sub cifră,
 * schimbarea față de perioada de aceeași durată de dinainte (săgeată + procent;
 * verde = mai bine, roșu = mai rău, cheltuiala neutră).
 */

function DeltaText({ delta }: { delta: Delta }) {
  if (delta.percent === null) return null;
  const rounded = Math.round(delta.percent);
  const arrow = rounded === 0 ? "" : rounded > 0 ? "▲ " : "▼ ";
  return (
    <span className={cn(delta.tone === "good" ? "text-[var(--ap-ok)]" : delta.tone === "bad" ? "text-[var(--ap-error)]" : "text-dim")}>
      <span aria-hidden>{arrow}</span>
      {formatDelta(delta)}
      <span className="sr-only">{delta.tone === "good" ? " (mai bine)" : delta.tone === "bad" ? " (mai rău)" : ""}</span>
    </span>
  );
}

function Tile({ label, children, foot }: { label: string; children: React.ReactNode; foot?: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-xl border border-hair bg-white px-4 py-3.5">
      <dt className="text-[13px] font-medium text-dim">{label}</dt>
      <dd className="mt-1 min-w-0">{children}</dd>
      {foot ? <dd className="mt-1.5 text-[12.5px] leading-snug text-dim">{foot}</dd> : null}
    </div>
  );
}

const big = "block truncate text-[1.25rem] font-semibold leading-tight tracking-tight text-bone tabular-nums min-[400px]:text-[1.375rem] sm:text-[1.625rem]";
const second = "block truncate text-[14px] font-semibold text-bone/80 tabular-nums";

function compare(current: number | null, previous: number | null, direction: Direction) {
  return deltaOf(current, previous, direction);
}

export function KpiTiles({
  current,
  previous,
  against,
  emptyHint,
}: {
  current: CurrencyTotals[];
  previous: CurrencyTotals[];
  /** „față de cele 7 zile dinainte” */
  against: string;
  /** Ce faci ca să apară rezultate, când nicio campanie nu e măsurată. */
  emptyHint?: string | null;
}) {
  const prev = (currency: string) => previous.find((item) => item.currency === currency) ?? null;
  const results = current.reduce((sum, item) => sum + item.results, 0);
  const previousResults = previous.reduce((sum, item) => sum + item.results, 0);
  const measured = current.reduce((sum, item) => sum + item.measured, 0);
  const unmeasured = current.reduce((sum, item) => sum + item.unmeasured, 0);
  const clicks = current.reduce((sum, item) => sum + item.clicks, 0);
  const previousClicks = previous.reduce((sum, item) => sum + item.clicks, 0);
  const kinds = new Map<ResultKind, number>();
  for (const item of current) for (const [kind, value] of Object.entries(item.byKind)) kinds.set(kind as ResultKind, (kinds.get(kind as ResultKind) ?? 0) + (value ?? 0));
  const [main, ...others] = current;

  return (
    <div>
      <dl className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Tile
          label="Cheltuit"
          foot={main ? <><DeltaText delta={compare(main.spend, prev(main.currency)?.spend ?? null, "neutral")} /> {prev(main.currency)?.spend ? against : null}</> : null}
        >
          <span className={big}>{main ? formatAmount(main.spend, main.currency) : formatAmount(0, "RON")}</span>
          {others.map((item) => (
            <span key={item.currency} className={second}>
              + {formatAmount(item.spend, item.currency)}
            </span>
          ))}
        </Tile>

        <Tile
          label="Rezultate"
          foot={
            measured === 0 ? (
              emptyHint ?? "Nicio campanie nu numără încă un rezultat."
            ) : (
              <>
                {[...kinds.entries()].filter(([, value]) => value > 0).map(([kind, value]) => resultUnit(value, kind)).join(" · ") || RESULT_KIND_LABEL.other}
                {unmeasured > 0 ? ` · ${unmeasured === 1 ? "o campanie nemăsurată" : `${unmeasured} campanii nemăsurate`}` : ""}
                {" "}
                <DeltaText delta={compare(results, previousResults || null, "up_good")} />
              </>
            )
          }
        >
          <span className={big}>{measured === 0 ? "nemăsurat" : formatCount(results)}</span>
        </Tile>

        <Tile label="Cost per rezultat" foot={measured > 0 && unmeasured > 0 ? "Doar din cheltuiala campaniilor măsurate." : null}>
          {current.filter((item) => item.results > 0).length === 0 ? (
            <span className={big}>—</span>
          ) : (
            current
              .filter((item) => item.results > 0)
              .map((item, index) => {
                const before = prev(item.currency);
                const value = item.measuredSpend / item.results;
                const old = before && before.results > 0 ? before.measuredSpend / before.results : null;
                return (
                  <span key={item.currency} className={index === 0 ? big : second}>
                    {formatAmount(value, item.currency)}{" "}
                    {index === 0 ? (
                      <span className="text-[12.5px] font-normal">
                        <DeltaText delta={compare(value, old, "up_bad")} />
                      </span>
                    ) : null}
                  </span>
                );
              })
          )}
        </Tile>

        <Tile label="Clickuri" foot={<><DeltaText delta={compare(clicks, previousClicks || null, "up_good")} /> {previousClicks ? against : null}</>}>
          <span className={big}>{formatCount(clicks)}</span>
        </Tile>
      </dl>
    </div>
  );
}
