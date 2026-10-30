import type { Metadata } from "next";
import Link from "next/link";
import { BarChart3 } from "lucide-react";
import { PLATFORMS } from "@/lib/ads/constants";
import { daysBetween, deltaOf, formatAmount, formatCount, formatPercent, type DayFigures, type Direction } from "@/lib/ads/metrics";
import { clientsForRequest, readClientView, readEntityDays } from "@/lib/ads/model/read";
import { readSelection } from "@/lib/ads/model/selection.server";
import { CHANNEL_LABEL, PERIOD_LABEL } from "@/lib/ads/model/selection";
import { resultsOf } from "@/lib/ads/model/results";
import { resultText, rowFigures, totalsByCurrency, type RowFigures } from "@/lib/ads/model/rows";
import type { EntityRow } from "@/lib/ads/model/types";
import { KpiTiles } from "@/components/panou/ads/kpi-tiles";
import { DayChart } from "@/components/panou/ads/day-chart";
import { DayExplorer } from "@/components/panou/ads/day-explorer";
import { ChannelMark } from "@/components/panou/ads/channel-mark";
import { DeltaChip } from "@/components/panou/ads/delta-chip";
import { StatusPill } from "@/components/panou/ads/status-pill";
import { StatsFilters } from "@/components/panou/ads/stats-filters";
import { SyncBar } from "@/components/panou/ads/sync-bar";
import { PAGE_LEAD, PAGE_TITLE } from "@/components/panou/ads/tone";
import { Card, Pill, SectionTitle, btnClass } from "@/components/panou/ui/primitives";
import { EmptyState, ErrorState } from "@/components/panou/ui/states";
import { syncClientAction } from "../clienti/actions";

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

const PERIOD_SHORT: Record<string, string> = { "7": "7 zile", "30": "30 de zile", "90": "90 de zile", luna: "luna aceasta", "luna-trecuta": "luna trecută" };

function Change({ current, previous, direction }: { current: number | null; previous: number | null; direction: Direction }) {
  const delta = deltaOf(current, previous, direction);
  return delta.percent === null ? <span className="text-muted-foreground">—</span> : <DeltaChip delta={delta} />;
}

const TH = "px-3 py-2.5 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground";

/**
 * /admin/ads/statistici — perioada aleasă sus, pe zile și pe canale, comparată
 * cu perioada de aceeași durată de dinainte. Doar din bază (modelul comun v2).
 */
export default async function StatsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const selection = await readSelection(params);
  const clients = await clientsForRequest();

  const shell = (children: React.ReactNode, options?: { subtitle?: string; right?: React.ReactNode }) => (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className={PAGE_TITLE}>Statistici</h1>
          <p className={PAGE_LEAD}>Cheltuiala și rezultatele, pe zile. Săgețile ← → schimbă ziua selectată.</p>
          {options?.subtitle ? <p className="mt-1.5 text-[11.5px] text-muted-foreground">{options.subtitle}</p> : null}
        </div>
        {options?.right}
      </div>
      {children}
    </div>
  );

  if (!clients.ok) {
    return shell(
      <Card padded={false}>
        <ErrorState title="Statisticile nu s-au încărcat" text={clients.message} hint="Cifrele de mai jos ar fi incomplete, așa că nu le afișăm." />
      </Card>
    );
  }
  if (clients.data.length === 0) {
    return shell(
      <Card padded={false}>
        <EmptyState
          icon={BarChart3}
          title="Statisticile apar după primul client"
          text="Adaugă un client și leagă-i conturile: portalul îi aduce cifrele în fiecare dimineață."
          action={
            <Link href="/admin/ads/clienti" className={btnClass({ variant: "primary", size: "sm" })}>
              Adaugă primul client
            </Link>
          }
        />
      </Card>
    );
  }

  const client = clients.data.find((item) => item.id === selection.clientId) ?? clients.data[0];
  const subtitle = `${client.name} · ${PERIOD_LABEL[selection.period]} · ${CHANNEL_LABEL[selection.channel]}`;
  const sync = (
    <SyncBar
      clientId={client.id}
      lastSyncedAt={client.accounts.map((account) => account.lastSyncedAt).filter((value): value is string => Boolean(value)).sort().at(-1) ?? null}
      failedAccounts={client.accounts.filter((account) => account.syncEnabled && account.lastSyncStatus === "failed").length}
      hasAccounts={client.accounts.length > 0}
      sync={syncClientAction}
    />
  );
  const view = await readClientView({ client, channel: selection.channel, range: selection.range });
  if (!view.ok) {
    return shell(
      <Card padded={false}>
        <ErrorState title="Statisticile nu s-au încărcat" text={view.message} hint="Cifrele de mai jos ar fi incomplete, așa că nu le afișăm." />
      </Card>,
      { subtitle, right: sync }
    );
  }

  const { accounts, entities, totals, previous } = view.data;
  const catalog = new Map(accounts.map((account) => [account.id, account.conversions]));
  const campaigns = entities.filter((entity) => entity.level === "campaign");
  const figuresOf = (entity: EntityRow, source: typeof totals): RowFigures => rowFigures(entity, source[entity.id], catalog.get(entity.accountId) ?? []);
  const rows = campaigns.map((entity) => ({ entity, figures: figuresOf(entity, totals), before: figuresOf(entity, previous) }));

  if (rows.every((row) => row.figures.spend === 0 && row.figures.impressions === 0)) {
    return shell(
      <Card padded={false}>
        <EmptyState
          icon={BarChart3}
          title="Nicio cifră pe filtrele astea"
          text="Nicio cheltuială în perioada aleasă. Alege o perioadă mai lungă sus sau apasă „Sincronizează acum” dacă știi că au rulat campanii."
        />
      </Card>,
      { subtitle, right: sync }
    );
  }

  const current = totalsByCurrency(rows.map((row) => ({ entity: row.entity, figures: row.figures })));
  const before = totalsByCurrency(rows.map((row) => ({ entity: row.entity, figures: row.before })));
  const currencies = current.map((item) => item.currency);
  // Moneda graficelor: cea aleasă în antet, altfel cea cu cea mai mare cheltuială.
  const asked = typeof params.moneda === "string" ? params.moneda : "";
  const mainCurrency = currencies.includes(asked) ? asked : (currencies[0] ?? "RON");

  // Zilele campaniilor în moneda aleasă (lei și euro nu se adună pe același grafic).
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
  const periodSpend = series.reduce((sum, day) => sum + day.spend, 0);
  const periodResults = series.reduce((sum, day) => sum + day.results, 0);

  const channels = PLATFORMS.filter((platform) => rows.some((row) => row.entity.platform === platform));
  const channelRows = channels.map((platform) => {
    const own = rows.filter((row) => row.entity.platform === platform);
    return { platform, totals: totalsByCurrency(own.map((row) => ({ entity: row.entity, figures: row.figures }))), count: own.filter((row) => row.figures.spend > 0).length };
  });

  const ranked = rows.filter((row) => row.figures.spend > 0 || row.before.spend > 0).sort((a, b) => b.figures.spend - a.figures.spend);

  return shell(
    <>
      <KpiTiles
        current={current}
        previous={before}
        against={AGAINST[selection.period]}
        periodLabel={PERIOD_SHORT[selection.period]}
        emptyHint="Alege în panoul fiecărei campanii ce se numără ca rezultat (apel, lead sau formular)."
      />

      {channels.length > 1 ? (
        <Card padded={false} className="overflow-hidden">
          <div className="border-b border-white/[0.06] px-4 py-3">
            <h2 className="text-[13.5px] font-medium">Pe canale</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] text-left">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th scope="col" className={`${TH} pl-4`}>Canal</th>
                  <th scope="col" className={`${TH} text-right`}>Cheltuit</th>
                  <th scope="col" className={`${TH} text-right`}>Rezultate</th>
                  <th scope="col" className={`${TH} text-right`}>Cost / rez.</th>
                  <th scope="col" className={`${TH} text-right`}>Clickuri</th>
                  <th scope="col" className={`${TH} pr-4 text-right`}>CTR</th>
                </tr>
              </thead>
              <tbody>
                {channelRows.map(({ platform, totals: list, count }) =>
                  list.map((total, index) => (
                    <tr key={`${platform}-${total.currency}`} className="border-b border-white/[0.04] text-[12.5px] last:border-0 hover:bg-white/[0.03]">
                      <th scope="row" className="py-2.5 pl-4 pr-3 text-left font-normal">
                        {index === 0 ? (
                          <span className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
                            <ChannelMark platform={platform} size="sm" />
                            <span className="text-[11px] text-muted-foreground">{count === 1 ? "o campanie" : `${count} campanii`} cu cheltuială</span>
                          </span>
                        ) : (
                          <span className="pl-9 text-[11px] text-muted-foreground">în {total.currency}</span>
                        )}
                      </th>
                      <td className="pu-num px-3 py-2.5 text-right">{formatAmount(total.spend, total.currency)}</td>
                      <td className="pu-num px-3 py-2.5 text-right">{total.measured === 0 ? <span className="text-muted-foreground">nemăsurat</span> : formatCount(total.results)}</td>
                      <td className="pu-num px-3 py-2.5 text-right text-muted-foreground">{total.results > 0 ? formatAmount(total.measuredSpend / total.results, total.currency) : "—"}</td>
                      <td className="pu-num px-3 py-2.5 text-right text-foreground/85">{formatCount(total.clicks)}</td>
                      <td className="pu-num py-2.5 pl-3 pr-4 text-right text-foreground/85">{formatPercent(total.impressions > 0 ? (total.clicks / total.impressions) * 100 : null)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <SectionTitle
            title="Cheltuiala pe zi"
            hint={`${PERIOD_SHORT[selection.period]}, ${mainCurrency}${current.length > 1 ? " · doar campaniile în această monedă" : ""}`}
            action={<Pill tone="neutral">{formatAmount(periodSpend, mainCurrency)}</Pill>}
          />
          {!days.ok ? <p className="mt-2 text-[12.5px] text-rose">{days.message}</p> : null}
          <div className="mt-3">
            <DayChart title="Cheltuit pe zi" name="Cheltuială" days={series.map((day) => ({ date: day.date, value: day.spend }))} unit={{ type: "money", currency: mainCurrency }} />
          </div>
        </Card>
        <Card>
          <SectionTitle
            title="Rezultatele pe zi"
            hint="axă separată, ca să nu inducă în eroare"
            action={measuredAny ? <Pill tone="neutral">{formatCount(periodResults)}</Pill> : undefined}
          />
          <div className="mt-3">
            {measuredAny ? (
              <DayChart title="Rezultate pe zi" name="Rezultate" color="#FFB27A" days={series.map((day) => ({ date: day.date, value: day.results }))} unit={{ type: "count" }} />
            ) : (
              <p className="py-10 text-center text-[12.5px] text-muted-foreground">Rezultatele pe zi apar când măcar o campanie numără un rezultat.</p>
            )}
          </div>
        </Card>
      </div>

      <DayExplorer days={series} currency={mainCurrency} resultLabel={measuredAny ? "Rezultate" : null} caption={`Cifrele pe zile, ${PERIOD_LABEL[selection.period].toLowerCase()}`} />

      <Card padded={false} className="overflow-hidden">
        <div className="border-b border-white/[0.06] px-4 py-3">
          <h2 className="text-[13.5px] font-medium">Pe campanii</h2>
          <p className="mt-0.5 text-[11.5px] text-muted-foreground">față de perioada dinainte</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[44rem] text-left">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th scope="col" className={`${TH} pl-4`}>Campanie</th>
                <th scope="col" className={`${TH} text-right`}>Cheltuit</th>
                <th scope="col" className={`${TH} text-right`}>față de înainte</th>
                <th scope="col" className={`${TH} text-right`}>Rezultate</th>
                <th scope="col" className={`${TH} text-right`}>față de înainte</th>
                <th scope="col" className={`${TH} text-right`}>Cost / rez.</th>
                <th scope="col" className={`${TH} pr-4 text-right`}>față de înainte</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map(({ entity, figures, before: old }) => (
                <tr key={entity.id} className="border-b border-white/[0.04] text-[12.5px] last:border-0 hover:bg-white/[0.03]">
                  <th scope="row" className="max-w-[20rem] py-2.5 pl-4 pr-3 text-left font-normal">
                    <span className="flex min-w-0 items-center gap-2.5">
                      <ChannelMark platform={entity.platform} size="sm" label={false} className="shrink-0" />
                      <span className="min-w-0">
                        <Link href={`/admin/ads?rand=${entity.id}`} className="block truncate hover:text-lav">
                          {entity.name}
                        </Link>
                        <span className="mt-0.5 block">
                          <StatusPill status={entity.status} />
                        </span>
                      </span>
                    </span>
                  </th>
                  <td className="pu-num px-3 py-2.5 text-right">{formatAmount(figures.spend, entity.currency ?? "")}</td>
                  <td className="px-3 py-2.5 text-right">
                    <Change current={figures.spend} previous={old.spend || null} direction="neutral" />
                  </td>
                  <td className={`pu-num px-3 py-2.5 text-right ${figures.results === null ? "text-muted-foreground" : ""}`}>{resultText(figures)}</td>
                  <td className="px-3 py-2.5 text-right">
                    <Change current={figures.results} previous={old.results || null} direction="up_good" />
                  </td>
                  <td className="pu-num px-3 py-2.5 text-right text-muted-foreground">{figures.costPerResult === null ? "—" : formatAmount(figures.costPerResult, entity.currency ?? "")}</td>
                  <td className="py-2.5 pl-3 pr-4 text-right">
                    <Change current={figures.costPerResult} previous={old.costPerResult} direction="up_bad" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <p className="px-1 text-[11px] text-muted-foreground/60">Cheltuiala se citește din platformă, nu se recalculează. Lei și euro nu se adună: fiecare monedă are rândul ei.</p>
    </>,
    { subtitle, right: <div className="flex flex-wrap items-end gap-3">{<StatsFilters currencies={currencies} current={mainCurrency} />}{sync}</div> }
  );
}
