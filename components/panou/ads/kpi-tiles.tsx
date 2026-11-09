import type { ReactNode } from "react";
import { deltaOf, formatAmount, formatCount, type Delta, type Direction } from "@/lib/ads/metrics";
import { RESULT_KIND_LABEL, resultUnit } from "@/lib/ads/model/results";
import type { CurrencyTotals } from "@/lib/ads/model/rows";
import type { ResultKind } from "@/lib/ads/model/types";
import { cn } from "@/lib/utils";
import { Info } from "../ui/info";
import { Card } from "../ui/primitives";
import { DeltaChip } from "./delta-chip";

/**
 * „123,45 lei” → valoarea și unitatea separate, ca în `Stat` din prototip
 * (cifra mare, unitatea mică alături). Moneda vine din `formatAmount`.
 */
export function splitAmount(value: number | null, currency: string): { value: string; unit: string } {
  const text = formatAmount(value, currency);
  const cut = text.lastIndexOf(" ");
  return cut > 0 ? { value: text.slice(0, cut), unit: text.slice(cut + 1) } : { value: text, unit: "" };
}

/** `Stat` din kit, cu locul schimbării față de perioada dinainte pentru `DeltaChip` (care cunoaște și „informativ”). `info`: explicația, sub „i”. */
export function KpiStat({
  label,
  value,
  unit,
  hint,
  info,
  delta,
  dim,
  className,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  hint?: ReactNode;
  info?: ReactNode;
  delta?: Delta;
  dim?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <p className="flex items-center gap-1.5 text-[12.5px] uppercase tracking-[0.14em] text-muted-foreground">
        {label}
        {info ? <Info>{info}</Info> : null}
      </p>
      <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className={cn("pu-num text-[26px] font-medium leading-none sm:text-[30px]", dim && "text-foreground/70")}>{value}</span>
        {unit ? <span className="text-[13.5px] text-muted-foreground">{unit}</span> : null}
        {delta && delta.percent !== null ? <DeltaChip delta={delta} /> : null}
      </div>
      {hint ? <p className="mt-1.5 text-[13.5px] leading-snug text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function compare(current: number | null, previous: number | null, direction: Direction): Delta {
  return deltaOf(current, previous, direction);
}

/**
 * Cele patru cifre mari, ca în prototip (Campanii): Cheltuit, Rezultate, Cost
 * per rezultat, Clickuri — pe ce e ales sus. Monedele nu se adună: fiecare are
 * rândul ei. Lângă cifră, schimbarea față de perioada de aceeași durată de
 * dinainte (săgeată + procent; verde = mai bine, roz = mai rău, cheltuiala e
 * informativă); cu ce se compară stă sub „i”. Nimic nu e inventat: fără
 * campanii măsurate scrie „nemăsurat”.
 */
export function KpiTiles({
  current,
  previous,
  against,
  emptyHint,
  className,
}: {
  current: CurrencyTotals[];
  previous: CurrencyTotals[];
  /** „față de cele 7 zile dinainte” — sub „i”, la Cheltuit. */
  against: string;
  /** Ce faci ca să apară rezultate, când nicio campanie nu e măsurată (sub „i”). */
  emptyHint?: string | null;
  className?: string;
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
  const spent = splitAmount(main ? main.spend : 0, main ? main.currency : "RON");
  const withResults = current.filter((item) => item.results > 0);
  const firstCost = withResults[0];
  const costBefore = firstCost ? prev(firstCost.currency) : null;
  const firstCostValue = firstCost ? firstCost.measuredSpend / firstCost.results : null;
  const firstCostOld = costBefore && costBefore.results > 0 ? costBefore.measuredSpend / costBefore.results : null;
  const cost = splitAmount(firstCostValue, firstCost?.currency ?? "RON");

  return (
    <Card className={cn("grid grid-cols-2 gap-x-4 gap-y-5 p-4 sm:grid-cols-4 sm:p-5", className)}>
      <KpiStat
        label="Cheltuit"
        value={spent.value}
        unit={spent.unit}
        dim
        delta={main ? compare(main.spend, prev(main.currency)?.spend ?? null, "neutral") : undefined}
        info={`Schimbarea e calculată ${against}.`}
        hint={others.map((item) => `+ ${formatAmount(item.spend, item.currency)}`).join(" · ") || null}
      />
      <KpiStat
        label="Rezultate"
        value={measured === 0 ? "nemăsurat" : formatCount(results)}
        delta={measured === 0 ? undefined : compare(results, previousResults || null, "up_good")}
        info={measured === 0 ? (emptyHint ?? "Nicio campanie nu numără încă un rezultat.") : undefined}
        hint={
          measured === 0
            ? null
            : `${[...kinds.entries()].filter(([, value]) => value > 0).map(([kind, value]) => resultUnit(value, kind)).join(" · ") || RESULT_KIND_LABEL.other}${
                unmeasured > 0 ? ` · ${unmeasured === 1 ? "o campanie nemăsurată" : `${unmeasured} campanii nemăsurate`}` : ""
              }`
        }
      />
      <KpiStat
        label="Cost / rezultat"
        value={firstCost ? cost.value : "—"}
        unit={firstCost ? cost.unit : undefined}
        delta={firstCost ? compare(firstCostValue, firstCostOld, "up_bad") : undefined}
        info={firstCost && measured > 0 && unmeasured > 0 ? "Doar din cheltuiala campaniilor măsurate." : undefined}
        hint={withResults.slice(1).map((item) => `+ ${formatAmount(item.measuredSpend / item.results, item.currency)}`).join(" · ") || null}
      />
      <KpiStat label="Clickuri" value={formatCount(clicks)} delta={compare(clicks, previousClicks || null, "up_good")} />
    </Card>
  );
}
