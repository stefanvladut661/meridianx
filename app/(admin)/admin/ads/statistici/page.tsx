import type { Metadata } from "next";
import Link from "next/link";
import { CURRENCY_LABEL, OBJECTIVES, OBJECTIVE_LABEL, resultLabel, type Currency, type Objective } from "@/lib/ads/constants";
import {
  PERIODS,
  fillDays,
  formatAmount,
  formatCount,
  formatPercent,
  isPeriod,
  periodRange,
  totalsOf,
  type PeriodDays,
} from "@/lib/ads/metrics";
import { countOf } from "@/lib/ads/plan-derive";
import { readLastRun, readWorkspaceStats, type SyncRun } from "@/lib/ads/stats";
import { currentWorkspaceId, listWorkspaces } from "@/lib/ads/workspaces.server";
import { DayChart } from "@/components/ads/day-chart";
import { StatTiles } from "@/components/ads/stat-tiles";
import { DaysTable, buildTiles, resultNames } from "@/components/ads/stats-parts";
import { SyncNow } from "@/components/ads/sync-now";
import { formatLeadDate, formatLeadDateTime } from "../../_components/format-date";
import { syncAdsNow } from "../actions";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Statistici — MERIDIAN Reclame",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * /admin/ads/statistici — cifrele spațiului de lucru de sus.
 *
 * Citește DOAR din bază (`ads_metrics_daily`), scrisă de sincronizarea
 * zilnică. Filtrele stau pe un rând, deasupra, și se aplică la tot ce e
 * dedesubt: perioada (7 / 30 / 90 de zile, comparată cu aceeași durată de
 * dinainte) și moneda — sumele în lei și în euro nu se adună.
 */

function lastRunSentence(run: SyncRun | null): string {
  if (!run) return "Nicio sincronizare încă.";
  // „azi 06:31” pentru azi, „24.09.2026, 06:31” pentru altă zi.
  const short = formatLeadDate(run.startedAt);
  const when = short.startsWith("azi") ? short : formatLeadDateTime(run.startedAt);
  const state =
    run.status === "ok"
      ? "reușită"
      : run.status === "partial"
        ? "parțială"
        : run.status === "failed"
          ? "eșuată"
          : "în curs";
  const campaigns = run.campaignsSynced === 1 ? "o campanie" : `${run.campaignsSynced} campanii`;
  return `Ultima sincronizare: ${when} · ${campaigns} · ${state}`;
}

function periodLabel(days: number): string {
  return `ultimele ${countOf(days, "zile")}`;
}

export default async function StatsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const days: PeriodDays = isPeriod(params.zile) ? (Number(params.zile) as PeriodDays) : 30;
  const workspaces = listWorkspaces();
  const currentId = await currentWorkspaceId();
  const workspace = workspaces.find((item) => item.id === currentId) ?? workspaces[0];
  const range = periodRange(days);

  const [stats, lastRun] = await Promise.all([
    readWorkspaceStats(workspace.id, range.previousFrom, range.to),
    readLastRun(),
  ]);

  const header = (
    <>
      <p className="eyebrow">Reclame · {workspace.name}</p>
      <h1 className="display mt-2 text-[2.5rem] text-bone sm:text-[3rem]">Statistici</h1>
    </>
  );

  if (!stats.ok) {
    return (
      <main className="mx-auto max-w-[1400px] px-4 pb-24 pt-8 sm:px-8 sm:pt-10">
        {header}
        <div role="alert" className="mt-8 rounded-panel-lg border border-[#ff6b6b]/35 bg-[#ff6b6b]/[0.05] px-5 py-4">
          <p className="text-[15px] font-semibold text-[#ff8a8a]">Cifrele nu se pot citi.</p>
          <p className="mt-1.5 text-[14px] leading-relaxed text-bone/80">{stats.message}</p>
        </div>
      </main>
    );
  }

  const { campaigns } = stats.data;

  // Moneda: cea cerută, dacă există campanii în ea; altfel cea cu cele mai multe cheltuieli.
  const currencies = [...new Set(campaigns.map((campaign) => campaign.currency))];
  const spendBy = (currency: Currency) =>
    stats.data.days
      .filter((day) => campaigns.find((campaign) => campaign.id === day.campaignId)?.currency === currency)
      .reduce((sum, day) => sum + day.spend, 0);
  const requested = typeof params.moneda === "string" ? (params.moneda as Currency) : null;
  const currency: Currency | null =
    requested && currencies.includes(requested)
      ? requested
      : ([...currencies].sort((a, b) => spendBy(b) - spendBy(a))[0] ?? null);

  const inCurrency = campaigns.filter((campaign) => campaign.currency === currency);

  // Obiectivul: rezultatele se compară doar în același obiectiv.
  const objectives = OBJECTIVES.filter((objective) => inCurrency.some((campaign) => campaign.objective === objective));
  const requestedObjective =
    typeof params.obiectiv === "string" && (objectives as readonly string[]).includes(params.obiectiv)
      ? (params.obiectiv as Objective)
      : null;
  const objective: Objective | null = objectives.length === 1 ? objectives[0] : requestedObjective;
  const scoped = objective ? inCurrency.filter((campaign) => campaign.objective === objective) : inCurrency;
  const ids = new Set(scoped.map((campaign) => campaign.id));
  const rows = stats.data.days.filter((day) => ids.has(day.campaignId));
  const currentRows = rows.filter((day) => day.date >= range.from && day.date <= range.to);
  const previousRows = rows.filter((day) => day.date >= range.previousFrom && day.date <= range.previousTo);
  const current = totalsOf(currentRows);
  const previous = totalsOf(previousRows);
  const daily = fillDays(currentRows, range.from, range.to);
  const names = resultNames(scoped.map((campaign) => campaign.objective), workspace.platform);

  const hrefWith = (next: { zile?: number; moneda?: string; obiectiv?: string | null }) => {
    const query = new URLSearchParams();
    query.set("zile", String(next.zile ?? days));
    const nextCurrency = next.moneda ?? currency;
    if (nextCurrency && currencies.length > 1) query.set("moneda", nextCurrency);
    // Moneda nouă poate avea alte obiective: la schimbarea ei, obiectivul se resetează.
    const nextObjective = next.moneda ? null : next.obiectiv === undefined ? requestedObjective : next.obiectiv;
    if (nextObjective) query.set("obiectiv", nextObjective);
    return `/admin/ads/statistici?${query}`;
  };

  const perCampaign = scoped
    .map((campaign) => ({
      campaign,
      totals: totalsOf(currentRows.filter((day) => day.campaignId === campaign.id)),
    }))
    .sort((a, b) => b.totals.spend - a.totals.spend);

  return (
    <main className="mx-auto max-w-[1400px] px-4 pb-24 pt-8 sm:px-8 sm:pt-10">
      {header}

      {/* Filtrele: un rând, deasupra a tot ce filtrează. */}
      <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
        <nav aria-label="Perioada" className="flex rounded-full border border-hair bg-ink/50 p-0.5">
          {PERIODS.map((period) => (
            <Link
              key={period}
              href={hrefWith({ zile: period })}
              aria-current={period === days ? "page" : undefined}
              className={cn(
                "flex min-h-9 items-center rounded-full px-3.5 text-[13px] font-semibold transition-colors duration-150",
                period === days ? "bg-bone text-ink" : "text-bone/70 hover:bg-glass hover:text-bone"
              )}
            >
              {countOf(period, "zile")}
            </Link>
          ))}
        </nav>
        {objectives.length > 1 ? (
          <nav aria-label="Obiectivul" className="flex flex-wrap rounded-[1.25rem] border border-hair bg-ink/50 p-0.5">
            {[null, ...objectives].map((item) => (
              <Link
                key={item ?? "toate"}
                href={hrefWith({ obiectiv: item })}
                aria-current={item === objective ? "page" : undefined}
                className={cn(
                  "flex min-h-9 items-center rounded-full px-3.5 text-[13px] font-semibold transition-colors duration-150",
                  item === objective ? "bg-bone text-ink" : "text-bone/70 hover:bg-glass hover:text-bone"
                )}
              >
                {item ? OBJECTIVE_LABEL[item] : "Toate obiectivele"}
              </Link>
            ))}
          </nav>
        ) : null}
        {currencies.length > 1 ? (
          <nav aria-label="Moneda" className="flex rounded-full border border-hair bg-ink/50 p-0.5">
            {currencies.map((item) => (
              <Link
                key={item}
                href={hrefWith({ moneda: item })}
                aria-current={item === currency ? "page" : undefined}
                className={cn(
                  "flex min-h-9 items-center rounded-full px-3.5 text-[13px] font-semibold transition-colors duration-150",
                  item === currency ? "bg-bone text-ink" : "text-bone/70 hover:bg-glass hover:text-bone"
                )}
              >
                {item} · {CURRENCY_LABEL[item]}
              </Link>
            ))}
          </nav>
        ) : null}
        <div className="sm:ml-auto">
          <SyncNow lastRun={lastRunSentence(lastRun)} action={syncAdsNow} />
        </div>
      </div>

      {campaigns.length === 0 ? (
        <section className="mt-8 rounded-panel-lg border border-dashed border-hair-strong px-6 py-12 text-center">
          <p className="font-md-display text-[1.375rem] font-semibold text-bone">
            În {workspace.name} portalul n-a creat încă nicio campanie.
          </p>
          <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-bone/70">
            Cifrele apar aici pentru campaniile create din portal, a doua zi după prima sincronizare.
          </p>
          <Link href="/admin/ads/nou" className="btn btn-light mt-6">
            Scrie un plan <span className="arw" aria-hidden>→</span>
          </Link>
        </section>
      ) : rows.length === 0 ? (
        <section className="mt-8 rounded-panel-lg border border-dashed border-hair-strong px-6 py-12 text-center">
          <p className="font-md-display text-[1.375rem] font-semibold text-bone">Nicio cifră încă, în {periodLabel(days)}.</p>
          <p className="mx-auto mt-3 max-w-lg text-[15px] leading-relaxed text-bone/70">
            Campaniile create pe pauză nu cheltuie nimic până nu le pornești din Ads Manager. După ce rulează,
            cifrele vin la sincronizarea zilnică — sau acum, din „Sincronizează acum”.
          </p>
        </section>
      ) : (
        <>
          <section aria-labelledby="indicatori" className="mt-8">
            <h2 id="indicatori" className="sr-only">
              Indicatorii, {periodLabel(days)}
            </h2>
            <StatTiles tiles={buildTiles(current, previous, currency ?? "RON", names)} against={`față de cele ${countOf(days, "zile")} dinainte`} />
            <p className="mt-3 text-[13px] text-dim">
              {names
                ? `${formatCount(current.impressions)} afișări · ${formatCount(current.clicks)} clicuri pe link · `
                : "Obiective amestecate: rezultatele se compară pe fiecare obiectiv, din filtrul de sus. · "}
              {current.days === 1 ? "o zi" : countOf(current.days, "zile")} cu livrare din {days}
            </p>
          </section>

          <section aria-labelledby="pe-zile" className="mt-12">
            <h2 id="pe-zile" className="eyebrow">
              Pe zile · {periodLabel(days)}
            </h2>
            <div className="mt-5 grid gap-8 lg:grid-cols-2">
              <DayChart
                title={`Cheltuiala pe zi (${CURRENCY_LABEL[currency ?? "RON"]})`}
                days={daily.map((day) => ({ date: day.date, value: day.spend }))}
                unit={{ type: "money", currency: currency ?? "RON" }}
              />
              {names ? (
                <DayChart
                  title={`${names.plural} pe zi`}
                  days={daily.map((day) => ({ date: day.date, value: day.results }))}
                  unit={{ type: "count" }}
                />
              ) : (
                <DayChart
                  title="Clicuri pe link pe zi"
                  days={daily.map((day) => ({ date: day.date, value: day.clicks }))}
                  unit={{ type: "count" }}
                />
              )}
            </div>
          </section>

          <section aria-labelledby="pe-campanii" className="mt-12">
            <h2 id="pe-campanii" className="eyebrow">
              Pe campanii · {periodLabel(days)}
            </h2>
            <div className="mt-4 overflow-x-auto rounded-panel-lg border border-hair">
              <table className="w-full min-w-[46rem] border-collapse text-left text-[13.5px]">
                <caption className="sr-only">Cifrele fiecărei campanii, {periodLabel(days)}</caption>
                <thead>
                  <tr className="border-b border-hair bg-glass">
                    {["Campania", "Cheltuială", "Rezultate", "Cost / rezultat", "CTR", "CPC", "CPM"].map((header, index) => (
                      <th
                        key={header}
                        scope="col"
                        className={cn(
                          "whitespace-nowrap px-4 py-3 font-md-mono text-[11px] font-normal uppercase tracking-[0.14em] text-dim",
                          index > 0 && "text-right"
                        )}
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {perCampaign.map(({ campaign, totals }) => (
                    <tr key={campaign.id} className="border-b border-hair last:border-b-0">
                      <th scope="row" className="max-w-[22rem] px-4 py-3 text-left font-normal">
                        <Link
                          href={`/admin/ads/${campaign.id}`}
                          className="font-semibold text-bone underline-offset-4 hover:underline"
                        >
                          {campaign.name}
                        </Link>
                      </th>
                      <td className="px-4 py-3 text-right text-bone">{formatAmount(totals.spend, campaign.currency)}</td>
                      <td className="px-4 py-3 text-right text-bone">
                        {formatCount(totals.results)}{" "}
                        <span className="text-[12px] text-dim">
                          {resultLabel(campaign.objective, workspace.platform).unit}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-bone/85">{formatAmount(totals.costPerResult, campaign.currency)}</td>
                      <td className="px-4 py-3 text-right text-bone/85">{formatPercent(totals.ctr)}</td>
                      <td className="px-4 py-3 text-right text-bone/85">{formatAmount(totals.cpc, campaign.currency)}</td>
                      <td className="px-4 py-3 text-right text-bone/85">{formatAmount(totals.cpm, campaign.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <details className="group mt-12">
            <summary className="cursor-pointer list-none text-[14px] font-semibold text-bone underline-offset-4 hover:underline">
              <span aria-hidden className="mr-2 inline-block transition-transform duration-150 group-open:rotate-90">
                ›
              </span>
              Toate cifrele pe zile, ca tabel
            </summary>
            <div className="mt-4">
              <DaysTable
                days={daily}
                currency={currency ?? "RON"}
                resultLabel={names?.plural ?? null}
                caption={`Cifrele pe zile, ${periodLabel(days)}`}
              />
            </div>
          </details>
        </>
      )}
    </main>
  );
}
