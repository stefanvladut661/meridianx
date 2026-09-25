import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CTA_LABEL, CURRENCY_LABEL, OBJECTIVE_LABEL, PLATFORM_LABEL, resultLabel } from "@/lib/ads/constants";
import { addDays, fillDays, formatAmount, formatCount, periodRange, todayInBucharest, totalsOf } from "@/lib/ads/metrics";
import { campaignUrl, managerName } from "@/lib/ads/links";
import { buildFinalUrl, countOf } from "@/lib/ads/plan-derive";
import { summarizePlan } from "@/lib/ads/plan-summary";
import { readCampaignDays } from "@/lib/ads/stats";
import { STORE_FAILURE_MESSAGE, getCampaign } from "@/lib/ads/store";
import { listWorkspaces } from "@/lib/ads/workspaces.server";
import { AdsPreview } from "@/components/ads/ads-preview";
import { DayChart } from "@/components/ads/day-chart";
import { PauseGlyph } from "@/components/ads/pause-seal";
import { StatTiles } from "@/components/ads/stat-tiles";
import { DaysTable, buildTiles } from "@/components/ads/stats-parts";
import { WARNING_TEXT } from "@/components/ads/tone";
import { campaignStatusLabel, isPausedStatus } from "@/components/ads/campaign-status";
import { formatLeadDateTime } from "../../_components/format-date";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Campanie — MERIDIAN Reclame",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/** Cât arată graficele: toată viața campaniei, dar cel mult ultimele 120 de zile. */
const CHART_DAYS = 120;

/**
 * /admin/ads/[id] — o campanie: cifrele pe zile, textele și materialul.
 *
 * Tot din bază: cifrele din `ads_metrics_daily`, iar textele și materialul
 * din planul salvat la creare (`plan_json`) — exact ce s-a trimis, nu ce
 * mai e azi în Ads Manager.
 */
export default async function CampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const found = await getCampaign(id);
  if (!found.ok) {
    if (found.reason === "not_found") notFound();
    return (
      <main className="mx-auto max-w-[1400px] px-4 pb-24 pt-8 sm:px-8 sm:pt-10">
        <p role="alert" className="text-[15px] text-[#ff8a8a]">
          {STORE_FAILURE_MESSAGE[found.reason]}
        </p>
      </main>
    );
  }
  const campaign = found.data;
  const days = await readCampaignDays(campaign.id);
  const rows = days.ok ? days.data : [];

  const workspace = listWorkspaces().find((item) => item.id === campaign.workspace) ?? null;
  const names = resultLabel(campaign.objective, campaign.platform);
  const today = todayInBucharest();
  const createdOn = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Bucharest" }).format(new Date(campaign.createdAt));
  const chartFrom = [createdOn, addDays(today, -(CHART_DAYS - 1))].sort()[1];
  const daily = fillDays(
    rows.filter((row) => row.date >= chartFrom),
    chartFrom,
    today
  );
  const lifetime = totalsOf(rows);
  const week = periodRange(7, today);
  const lastWeek = totalsOf(rows.filter((row) => row.date >= week.from));
  const weekBefore = totalsOf(rows.filter((row) => row.date >= week.previousFrom && row.date <= week.previousTo));

  const plan = campaign.plan;
  const summary = summarizePlan(plan as unknown as Record<string, unknown>, campaign.platform);
  const finalUrl = buildFinalUrl(plan.destination.url, plan.destination.utm ?? null) ?? plan.destination.url;
  const paused = isPausedStatus(campaign.status);

  return (
    <main className="mx-auto max-w-[1400px] px-4 pb-24 pt-8 sm:px-8 sm:pt-10">
      <p className="eyebrow">
        <Link href="/admin/ads" className="underline-offset-4 hover:underline">
          Campanii
        </Link>{" "}
        · {workspace?.name ?? campaign.workspace}
      </p>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-6">
        <div className="flex min-w-0 items-start gap-4">
          <PauseGlyph className={cn("mt-1 h-11 w-11 shrink-0 text-bone", !paused && "opacity-30")} />
          <div className="min-w-0">
            <h1 className="font-md-display text-[1.875rem] font-semibold leading-tight tracking-tight text-bone sm:text-[2.25rem]">
              {campaign.name}
            </h1>
            <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[13.5px] text-dim">
              <span className="font-md-mono uppercase tracking-[0.14em] text-bone/85">
                {campaignStatusLabel(campaign.status)}
              </span>
              <span>{OBJECTIVE_LABEL[campaign.objective]}</span>
              <span>
                {formatAmount(campaign.dailyBudget, campaign.currency)} pe zi
              </span>
              <span>creată {formatLeadDateTime(campaign.createdAt)}</span>
              {campaign.createdByEmail ? <span className="break-all">de {campaign.createdByEmail}</span> : null}
            </p>
            {campaign.creation === "partial" ? (
              <p className={cn("mt-2 text-[13.5px]", WARNING_TEXT)}>
                Creată parțial: {campaign.creationError ?? "o parte din reclame lipsește."}
              </p>
            ) : null}
          </div>
        </div>
        <a
          href={campaignUrl(campaign.platform, campaign.adAccount, campaign.platformCampaignId)}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-light shrink-0"
        >
          Deschide în {managerName(campaign.platform)}<span aria-hidden> ↗</span>
          <span className="sr-only"> (se deschide într-o filă nouă)</span>
        </a>
      </div>

      {!days.ok ? (
        <p role="alert" className="mt-8 text-[14px] text-[#ff8a8a]">
          {days.message}
        </p>
      ) : rows.length === 0 ? (
        <section className="mt-8 rounded-panel-lg border border-dashed border-hair-strong px-6 py-10">
          <p className="font-md-display text-[1.25rem] font-semibold text-bone">Nicio cifră încă.</p>
          <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-bone/70">
            {paused
              ? `Campania e oprită, deci n-a cheltuit nimic. După ce o pornești din ${managerName(campaign.platform)}, cifrele vin la sincronizarea zilnică.`
              : "Cifrele vin la sincronizarea zilnică — sau acum, din Statistici → „Sincronizează acum”."}
          </p>
        </section>
      ) : (
        <>
          <section aria-labelledby="saptamana" className="mt-8">
            <h2 id="saptamana" className="eyebrow">
              Ultimele 7 zile
            </h2>
            <div className="mt-4">
              <StatTiles
                tiles={buildTiles(lastWeek, weekBefore, campaign.currency, names)}
                against="față de cele 7 zile dinainte"
              />
            </div>
            <p className="mt-3 text-[13px] text-dim">
              De la creare: {formatAmount(lifetime.spend, campaign.currency)} · {formatCount(lifetime.results)}{" "}
              {names.unit} · {countOf(lifetime.days, "zile")} cu livrare
            </p>
          </section>

          <section aria-labelledby="zile" className="mt-12">
            <h2 id="zile" className="eyebrow">
              Pe zile{rows[0] && rows[0].date < chartFrom ? ` · ultimele ${countOf(CHART_DAYS, "zile")}` : " · de la creare"}
            </h2>
            <div className="mt-5 grid gap-8 lg:grid-cols-2">
              <DayChart
                title={`Cheltuiala pe zi (${CURRENCY_LABEL[campaign.currency]})`}
                days={daily.map((day) => ({ date: day.date, value: day.spend }))}
                unit={{ type: "money", currency: campaign.currency }}
              />
              <DayChart
                title={`${names.plural} pe zi`}
                days={daily.map((day) => ({ date: day.date, value: day.results }))}
                unit={{ type: "count" }}
              />
            </div>
            <details className="group mt-8">
              <summary className="cursor-pointer list-none text-[14px] font-semibold text-bone underline-offset-4 hover:underline">
                <span aria-hidden className="mr-2 inline-block transition-transform duration-150 group-open:rotate-90">
                  ›
                </span>
                Toate zilele, ca tabel
              </summary>
              <div className="mt-4">
                <DaysTable
                  days={fillDays(rows, rows[0].date, today)}
                  currency={campaign.currency}
                  resultLabel={names.plural}
                  caption={`Cifrele campaniei ${campaign.name}, pe zile`}
                />
              </div>
            </details>
          </section>
        </>
      )}

      <section aria-labelledby="material" className="mt-14 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div>
          <h2 id="material" className="eyebrow">
            Materialul, cum a fost trimis
          </h2>
          <dl className="mt-4 divide-y divide-hair rounded-panel-lg border border-hair px-4 text-[14px]">
            <div className="grid gap-1 py-3 sm:grid-cols-[8rem_minmax(0,1fr)]">
              <dt className="text-dim">Video</dt>
              <dd className="font-md-mono text-[12.5px] text-bone/90">
                {plan.creative.video.source === "library" ? plan.creative.video.video_id : "fișier nou"}
              </dd>
            </div>
            <div className="grid gap-1 py-3 sm:grid-cols-[8rem_minmax(0,1fr)]">
              <dt className="text-dim">Butonul</dt>
              <dd className="text-bone/90">{CTA_LABEL[plan.creative.cta]}</dd>
            </div>
            <div className="grid gap-1 py-3 sm:grid-cols-[8rem_minmax(0,1fr)]">
              <dt className="text-dim">Destinația</dt>
              <dd className="break-all font-md-mono text-[12.5px] text-bone/90">{finalUrl}</dd>
            </div>
            <div className="grid gap-1 py-3 sm:grid-cols-[8rem_minmax(0,1fr)]">
              <dt className="text-dim">Publicul</dt>
              <dd className="text-bone/90">
                {summary.age}, {summary.gender}
                {summary.places.length > 0 ? `, din ${summary.places.join(", ")}` : ""}
              </dd>
            </div>
          </dl>
          <details className="group mt-6">
            <summary className="cursor-pointer list-none text-[14px] font-semibold text-bone underline-offset-4 hover:underline">
              <span aria-hidden className="mr-2 inline-block transition-transform duration-150 group-open:rotate-90">
                ›
              </span>
              Planul JSON, cu cheile găsite de {PLATFORM_LABEL[campaign.platform]}
            </summary>
            <pre className="mt-3 max-h-[28rem] overflow-auto rounded-panel-lg border border-hair bg-ink/60 p-4 font-md-mono text-[12px] leading-relaxed text-bone/85">
              {JSON.stringify(plan, null, 2)}
            </pre>
          </details>
        </div>
        <div>
          <h2 className="eyebrow">Reclamele</h2>
          <AdsPreview
            summary={summary}
            rotating={plan.creative.variants === "platform_rotates"}
            className="mt-4"
          />
        </div>
      </section>
    </main>
  );
}
