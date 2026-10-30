import type { Metadata } from "next";
import Link from "next/link";
import { PLATFORMS, PLATFORM_LABEL } from "@/lib/ads/constants";
import { daysBetween, deltaOf, formatAmount, formatCount, formatDelta, formatPercent, type DayFigures } from "@/lib/ads/metrics";
import { clientsForRequest, readClientView, readEntityDays } from "@/lib/ads/model/read";
import { readSelection } from "@/lib/ads/model/selection.server";
import { CHANNEL_LABEL, PERIOD_LABEL } from "@/lib/ads/model/selection";
import { resultsOf } from "@/lib/ads/model/results";
import { resultText, rowFigures, totalsByCurrency, type RowFigures } from "@/lib/ads/model/rows";
import type { EntityRow } from "@/lib/ads/model/types";
import { KpiTiles } from "@/components/ads/kpi-tiles";
import { DayChart } from "@/components/ads/day-chart";
import { DaysTable } from "@/components/ads/stats-parts";
import { ChannelIcon } from "@/components/ads/channel-icon";
import { StatusTag } from "@/components/ads/status-tag";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Statistici — MERIDIAN Reclame",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const AGAINST: Record<string, string> = {
  "7": "față de cele 7 zile dinainte",
  "30": "față de cele 30 de zile dinainte",
  "90": "față de cele 90 de zile dinainte",
  luna: "față de aceleași zile de dinainte",
  "luna-trecuta": "față de luna dinainte",
};

function Delta({ current, previous, direction }: { current: number | null; previous: number | null; direction: "up_good" | "up_bad" | "neutral" }) {
  const delta = deltaOf(current, previous, direction);
  if (delta.percent === null) return <span className="text-dim">—</span>;
  return (
    <span className={cn(delta.tone === "good" ? "text-[var(--ap-ok)]" : delta.tone === "bad" ? "text-[var(--ap-error)]" : "text-dim")}>{formatDelta(delta)}</span>
  );
}

/**
 * /admin/ads/statistici — perioada aleasă sus, pe zile și pe canale, comparată
 * cu perioada de aceeași durată de dinainte. Doar din bază (modelul comun v2).
 */
export default async function StatsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const selection = await readSelection(await searchParams);
  const clients = await clientsForRequest();
  const shell = (children: React.ReactNode, subtitle?: string) => (
    <main className="px-4 pb-16 pt-6 sm:px-6">
      <h1 className="text-[1.5rem] font-semibold tracking-tight text-bone">Statistici</h1>
      {subtitle ? <p className="mt-0.5 text-[13.5px] text-dim">{subtitle}</p> : null}
      {children}
    </main>
  );

  if (!clients.ok) return shell(<p className="mt-6 text-[14px] text-[var(--ap-error)]">{clients.message}</p>);
  if (clients.data.length === 0) {
    return shell(
      <p className="mt-6 max-w-xl text-[14.5px] text-bone/80">
        Statisticile apar după primul client.{" "}
        <Link href="/admin/ads/clienti" className="font-medium text-[var(--md-a1)] underline underline-offset-4">
          Adaugă-l
        </Link>
        .
      </p>
    );
  }

  const client = clients.data.find((item) => item.id === selection.clientId) ?? clients.data[0];
  const subtitle = `${client.name} · ${PERIOD_LABEL[selection.period]} · ${CHANNEL_LABEL[selection.channel]}`;
  const view = await readClientView({ client, channel: selection.channel, range: selection.range });
  if (!view.ok) return shell(<p className="mt-6 text-[14px] text-[var(--ap-error)]">{view.message}</p>, subtitle);

  const { accounts, entities, totals, previous } = view.data;
  const catalog = new Map(accounts.map((account) => [account.id, account.conversions]));
  const campaigns = entities.filter((entity) => entity.level === "campaign");
  const figuresOf = (entity: EntityRow, source: typeof totals): RowFigures => rowFigures(entity, source[entity.id], catalog.get(entity.accountId) ?? []);
  const rows = campaigns.map((entity) => ({ entity, figures: figuresOf(entity, totals), before: figuresOf(entity, previous) }));

  if (rows.every((row) => row.figures.spend === 0 && row.figures.impressions === 0)) {
    return shell(
      <p className="mt-6 max-w-xl rounded-xl border border-hair bg-[var(--ap-side)] px-5 py-4 text-[14.5px] leading-relaxed text-bone/80">
        Nicio cheltuială în perioada aleasă. Alege o perioadă mai lungă sus sau apasă „Actualizează” dacă știi că au rulat campanii.
      </p>,
      subtitle
    );
  }

  const current = totalsByCurrency(rows.map((row) => ({ entity: row.entity, figures: row.figures })));
  const before = totalsByCurrency(rows.map((row) => ({ entity: row.entity, figures: row.before })));
  const mainCurrency = current[0]?.currency ?? "RON";

  // Zilele campaniilor în moneda principală (lei și euro nu se adună pe același grafic).
  const inMain = campaigns.filter((entity) => (entity.currency ?? "—") === mainCurrency);
  const days = await readEntityDays(inMain.map((entity) => entity.id), selection.range.from, selection.range.to);
  const byId = new Map(inMain.map((entity) => [entity.id, entity]));
  const measuredAny = inMain.some((entity) => entity.resultKey && (catalog.get(entity.accountId) ?? []).some((entry) => entry.key === entity.resultKey));
  const daily = new Map<string, DayFigures>(daysBetween(selection.range.from, selection.range.to).map((date) => [date, { date, spend: 0, impressions: 0, clicks: 0, results: 0 }]));
  if (days.ok) {
    for (const day of days.data) {
      const entity = byId.get(day.entityId);
      const target = daily.get(day.date);
      if (!entity || !target) continue;
      target.spend = Math.round((target.spend + day.figures.spend) * 100) / 100;
      target.impressions += day.figures.impressions;
      target.clicks += day.figures.clicks;
      const measured = (catalog.get(entity.accountId) ?? []).some((entry) => entry.key === entity.resultKey);
      if (measured) target.results = Math.round((target.results + (resultsOf(day.figures, entity.resultKey) ?? 0)) * 100) / 100;
    }
  }
  const series = [...daily.values()];

  const channels = PLATFORMS.filter((platform) => rows.some((row) => row.entity.platform === platform));
  const channelRows = channels.map((platform) => {
    const own = rows.filter((row) => row.entity.platform === platform);
    return { platform, totals: totalsByCurrency(own.map((row) => ({ entity: row.entity, figures: row.figures }))), count: own.filter((row) => row.figures.spend > 0).length };
  });

  const ranked = rows.filter((row) => row.figures.spend > 0 || row.before.spend > 0).sort((a, b) => b.figures.spend - a.figures.spend);

  return shell(
    <>
      <div className="mt-5">
        <KpiTiles current={current} previous={before} against={AGAINST[selection.period]} />
      </div>

      {channels.length > 1 ? (
        <section aria-labelledby="canale" className="mt-8">
          <h2 id="canale" className="text-[15px] font-semibold text-bone">
            Pe canale
          </h2>
          <div className="mt-3 overflow-x-auto rounded-xl border border-hair">
            <table className="w-full min-w-[36rem] text-[13.5px]">
              <thead>
                <tr className="bg-char text-left text-[12.5px] text-dim">
                  <th scope="col" className="px-4 py-2.5 font-semibold">Canal</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-semibold">Cheltuit</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-semibold">Rezultate</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-semibold">Cost / rez.</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-semibold">Clickuri</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-semibold">CTR</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {channelRows.map(({ platform, totals: list, count }) =>
                  list.map((total, index) => (
                    <tr key={`${platform}-${total.currency}`} className="border-t border-hair">
                      <th scope="row" className="px-4 py-2.5 text-left font-semibold text-bone">
                        {index === 0 ? (
                          <span className="flex items-center gap-2">
                            <ChannelIcon platform={platform} />
                            {PLATFORM_LABEL[platform]} <span className="font-normal text-dim">· {count === 1 ? "o campanie" : `${count} campanii`} cu cheltuială</span>
                          </span>
                        ) : (
                          <span className="pl-6 font-normal text-dim">în {total.currency}</span>
                        )}
                      </th>
                      <td className="px-4 py-2.5 text-right font-semibold text-bone">{formatAmount(total.spend, total.currency)}</td>
                      <td className="px-4 py-2.5 text-right text-bone">{total.measured === 0 ? <span className="text-dim">nemăsurat</span> : formatCount(total.results)}</td>
                      <td className="px-4 py-2.5 text-right text-bone/85">{total.results > 0 ? formatAmount(total.measuredSpend / total.results, total.currency) : "—"}</td>
                      <td className="px-4 py-2.5 text-right text-bone/85">{formatCount(total.clicks)}</td>
                      <td className="px-4 py-2.5 text-right text-bone/85">{formatPercent(total.impressions > 0 ? (total.clicks / total.impressions) * 100 : null)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section aria-labelledby="zile" className="mt-8">
        <h2 id="zile" className="text-[15px] font-semibold text-bone">
          Pe zile{current.length > 1 ? <span className="font-normal text-dim"> · doar campaniile în {mainCurrency}</span> : null}
        </h2>
        {!days.ok ? <p className="mt-2 text-[13.5px] text-[var(--ap-error)]">{days.message}</p> : null}
        <div className="mt-4 grid gap-6 rounded-xl border border-hair bg-char p-4 lg:grid-cols-2">
          <DayChart title="Cheltuit pe zi" days={series.map((day) => ({ date: day.date, value: day.spend }))} unit={{ type: "money", currency: mainCurrency }} />
          {measuredAny ? (
            <DayChart title="Rezultate pe zi" days={series.map((day) => ({ date: day.date, value: day.results }))} unit={{ type: "count" }} />
          ) : (
            <p className="self-center text-[13.5px] text-dim">Rezultatele pe zi apar când măcar o campanie numără un rezultat.</p>
          )}
        </div>
        <div className="mt-4">
          <DaysTable days={series} currency={mainCurrency} resultLabel={measuredAny ? "Rezultate" : null} caption={`Cifrele pe zile, ${PERIOD_LABEL[selection.period].toLowerCase()}`} />
        </div>
      </section>

      <section aria-labelledby="campanii" className="mt-8">
        <h2 id="campanii" className="text-[15px] font-semibold text-bone">
          Campaniile, față de perioada dinainte
        </h2>
        <div className="mt-3 overflow-x-auto rounded-xl border border-hair">
          <table className="w-full min-w-[44rem] text-[13.5px]">
            <thead>
              <tr className="bg-char text-left text-[12.5px] text-dim">
                <th scope="col" className="px-4 py-2.5 font-semibold">Campanie</th>
                <th scope="col" className="px-4 py-2.5 text-right font-semibold">Cheltuit</th>
                <th scope="col" className="px-4 py-2.5 text-right font-semibold">față de înainte</th>
                <th scope="col" className="px-4 py-2.5 text-right font-semibold">Rezultate</th>
                <th scope="col" className="px-4 py-2.5 text-right font-semibold">față de înainte</th>
                <th scope="col" className="px-4 py-2.5 text-right font-semibold">Cost / rez.</th>
                <th scope="col" className="px-4 py-2.5 text-right font-semibold">față de înainte</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {ranked.map(({ entity, figures, before: old }) => (
                <tr key={entity.id} className="border-t border-hair">
                  <th scope="row" className="max-w-[20rem] px-4 py-2.5 text-left font-normal">
                    <span className="flex min-w-0 items-center gap-2">
                      <ChannelIcon platform={entity.platform} className="shrink-0" />
                      <Link href={`/admin/ads?rand=${entity.id}`} className="truncate font-semibold text-bone hover:text-[var(--md-a1)] hover:underline">
                        {entity.name}
                      </Link>
                      <StatusTag status={entity.status} className="hidden shrink-0 xl:inline-flex" />
                    </span>
                  </th>
                  <td className="px-4 py-2.5 text-right font-semibold text-bone">{formatAmount(figures.spend, entity.currency ?? "")}</td>
                  <td className="px-4 py-2.5 text-right">
                    <Delta current={figures.spend} previous={old.spend || null} direction="neutral" />
                  </td>
                  <td className={cn("px-4 py-2.5 text-right", figures.results === null ? "text-dim" : "text-bone")}>{resultText(figures)}</td>
                  <td className="px-4 py-2.5 text-right">
                    <Delta current={figures.results} previous={old.results || null} direction="up_good" />
                  </td>
                  <td className="px-4 py-2.5 text-right text-bone/85">{figures.costPerResult === null ? "—" : formatAmount(figures.costPerResult, entity.currency ?? "")}</td>
                  <td className="px-4 py-2.5 text-right">
                    <Delta current={figures.costPerResult} previous={old.costPerResult} direction="up_bad" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>,
    subtitle
  );
}
