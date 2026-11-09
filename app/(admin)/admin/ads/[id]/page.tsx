import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ExternalLink, PlayCircle } from "lucide-react";
import { CTA_LABEL, CURRENCY_LABEL, OBJECTIVE_LABEL, PLATFORM_LABEL, resultLabel } from "@/lib/ads/constants";
import { addDays, deltaOf, fillDays, formatAmount, formatCount, formatPercent, periodRange, todayInBucharest, totalsOf } from "@/lib/ads/metrics";
import { campaignUrl, managerName } from "@/lib/ads/links";
import { buildFinalUrl, countOf } from "@/lib/ads/plan-derive";
import { summarizePlan } from "@/lib/ads/plan-summary";
import { summarizeSearchPlan } from "@/lib/ads/google/search/summary";
import { SearchPreview } from "@/components/ads/search-preview";
import { readCampaignDays } from "@/lib/ads/stats";
import { STORE_FAILURE_MESSAGE, getCampaign } from "@/lib/ads/store";
import { listWorkspaces } from "@/lib/ads/workspaces.server";
import { AdsPreview } from "@/components/panou/ads/ads-preview";
import { campaignStatusLabel, isPausedStatus } from "@/components/panou/ads/campaign-status";
import { ChannelMark } from "@/components/panou/ads/channel-mark";
import { DayChart } from "@/components/panou/ads/day-chart";
import { DaysTable } from "@/components/panou/ads/days-table";
import { KpiStat, splitAmount } from "@/components/panou/ads/kpi-tiles";
import { SentMaterial } from "@/components/panou/ads/sent-material";
import { PAGE_TITLE } from "@/components/panou/ads/tone";
import { CopyButton } from "@/components/panou/ui/actions";
import { InlineNote } from "@/components/panou/ui/actions";
import { dateTimeRo } from "@/components/panou/ui/format";
import { Card, Pill, SectionTitle, Stamp, btnClass, type PillTone } from "@/components/panou/ui/primitives";
import { EmptyState, ErrorState } from "@/components/panou/ui/states";

export const metadata: Metadata = {
  title: "Campanie — MERIDIAN Reclame",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/** Cât arată graficele: toată viața campaniei, dar cel mult ultimele 120 de zile. */
const CHART_DAYS = 120;

/** Statusul brut al platformei → tonul pastilei (doar afișare; portalul nu scrie alt status decât pauza). */
function statusTone(status: string): PillTone {
  if (isPausedStatus(status)) return "dark";
  const label = campaignStatusLabel(status);
  if (label === "Pornită") return "mint";
  if (label === "Cu probleme" || label === "Se procesează" || label === "Buget epuizat") return "apricot";
  return "neutral";
}

/**
 * /admin/ads/[id] — fișa unei campanii create din portal: cifrele pe zile,
 * textele și materialul.
 *
 * Tot din bază: cifrele din `ads_metrics_daily`, iar textele și materialul
 * din planul salvat la creare (`plan_json`) — exact ce s-a trimis, nu ce
 * mai e azi în Ads Manager.
 */
export default async function CampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const found = await getCampaign(id);
  if (!found.ok) {
    if (found.reason === "not_found") {
      return (
        <div className="space-y-4">
          <Card padded={false}>
            <EmptyState
              icon={PlayCircle}
              title="Campania nu există"
              text="Linkul e vechi sau campania a fost ștearsă."
              action={
                <Link href="/admin/ads" className={btnClass({ variant: "primary", size: "sm" })}>
                  Vezi campaniile
                </Link>
              }
            />
          </Card>
        </div>
      );
    }
    return (
      <div className="space-y-4">
        <Card padded={false}>
          <ErrorState title="Campania nu s-a încărcat" text={STORE_FAILURE_MESSAGE[found.reason]} />
        </Card>
      </div>
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
  const search = campaign.channel === "search";
  // Planul de căutare are altă formă (faza 10): fișa lui arată campania cum a fost trimisă, nu un video.
  const summary = search ? null : summarizePlan(plan as unknown as Record<string, unknown>, campaign.platform);
  const searchSummary = search ? summarizeSearchPlan(plan as unknown as Record<string, unknown>) : null;
  const finalUrl = search ? null : (buildFinalUrl(plan.destination.url, plan.destination.utm ?? null) ?? plan.destination.url);
  const paused = isPausedStatus(campaign.status);
  const currency = campaign.currency;
  const planJson = JSON.stringify(plan, null, 2);
  const firstAd = summary?.ads[0] ?? null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href="/admin/ads" className="mb-2 inline-flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3 w-3" aria-hidden="true" /> Campanii
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className={`${PAGE_TITLE} !leading-tight sm:!text-[25px]`}>{campaign.name}</h1>
            <Pill tone={statusTone(campaign.status)} dot>
              {campaignStatusLabel(campaign.status)}
            </Pill>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13.5px] text-muted-foreground">
            <ChannelMark platform={campaign.platform} size="sm" />
            <span>{workspace?.name ?? campaign.workspace}</span>
            <span aria-hidden="true">·</span>
            <span>{search ? "Căutare" : OBJECTIVE_LABEL[campaign.objective]}</span>
            <span aria-hidden="true">·</span>
            <span>
              {formatAmount(campaign.dailyBudget, currency)} pe zi
            </span>
            <span aria-hidden="true">·</span>
            <span>creată {dateTimeRo(campaign.createdAt)}</span>
            {campaign.createdByEmail ? <span className="break-all">de {campaign.createdByEmail}</span> : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Stamp />
          <a
            href={campaignUrl(campaign.platform, campaign.adAccount, campaign.platformCampaignId)}
            target="_blank"
            rel="noopener noreferrer"
            className={btnClass({ variant: "primary", size: "sm", className: "gap-1.5" })}
          >
            Deschide în {managerName(campaign.platform)}
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
            <span className="sr-only"> (se deschide într-o filă nouă)</span>
          </a>
        </div>
      </div>

      <div className="flex items-start gap-2.5 rounded-xl border border-apricot/20 bg-apricot/[0.06] px-3.5 py-2.5 text-[13px] leading-relaxed text-[#FFD0AC]">
        <PlayCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <p>
          Creată oprită. Pornirea și bugetul: doar din platformă. Pauza: din{" "}
          <Link href={`/admin/ads?cauta=${encodeURIComponent(campaign.name)}`} className="underline underline-offset-4">
            Campanii
          </Link>
          .
        </p>
      </div>

      {campaign.creation === "partial" ? (
        <InlineNote tone="apricot">Creată parțial: {campaign.creationError ?? "o parte din reclame lipsește."}</InlineNote>
      ) : null}

      {!days.ok ? (
        <Card padded={false}>
          <ErrorState title="Cifrele nu s-au citit" text={days.message} />
        </Card>
      ) : rows.length === 0 ? (
        <Card padded={false}>
          <EmptyState
            icon={PlayCircle}
            title="Nicio cifră încă"
            text={paused ? `Oprită, n-a cheltuit nimic. Pornește-o din ${managerName(campaign.platform)}.` : "Vin la sincronizarea zilnică sau din „Sincronizează”, pe Campanii."}
          />
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <SectionTitle title="Ultimele 7 zile" info="Schimbarea e calculată față de cele 7 zile dinainte." />
              <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
                <KpiStat
                  label="Cheltuială"
                  value={splitAmount(lastWeek.spend, currency).value}
                  unit={splitAmount(lastWeek.spend, currency).unit}
                  delta={deltaOf(lastWeek.spend, weekBefore.spend, "neutral")}
                />
                <KpiStat label={names.plural} value={formatCount(lastWeek.results)} delta={deltaOf(lastWeek.results, weekBefore.results, "up_good")} />
                <KpiStat
                  label={names.cost}
                  value={lastWeek.costPerResult === null ? "—" : splitAmount(lastWeek.costPerResult, currency).value}
                  unit={lastWeek.costPerResult === null ? undefined : splitAmount(lastWeek.costPerResult, currency).unit}
                  delta={deltaOf(lastWeek.costPerResult, weekBefore.costPerResult, "up_bad")}
                />
                <KpiStat label="Buget zilnic" value={splitAmount(campaign.dailyBudget, currency).value} unit={splitAmount(campaign.dailyBudget, currency).unit} />
              </div>
              <dl className="mt-5 grid grid-cols-3 gap-3 border-t border-white/[0.06] pt-4">
                <div>
                  <dt className="text-[12px] uppercase tracking-[0.12em] text-muted-foreground">CTR</dt>
                  <dd className="pu-num mt-1 text-[16px]">{formatPercent(lastWeek.ctr)}</dd>
                </div>
                <div>
                  <dt className="text-[12px] uppercase tracking-[0.12em] text-muted-foreground">CPC</dt>
                  <dd className="pu-num mt-1 text-[16px]">{formatAmount(lastWeek.cpc, currency)}</dd>
                </div>
                <div>
                  <dt className="text-[12px] uppercase tracking-[0.12em] text-muted-foreground">CPM</dt>
                  <dd className="pu-num mt-1 text-[16px]">{formatAmount(lastWeek.cpm, currency)}</dd>
                </div>
              </dl>
              <div className="mt-5 grid gap-5 sm:grid-cols-2">
                <DayChart
                  title={`Cheltuiala pe zi (${CURRENCY_LABEL[currency]})`}
                  name="Cheltuială"
                  days={daily.map((day) => ({ date: day.date, value: day.spend }))}
                  unit={{ type: "money", currency }}
                  height={130}
                />
                <DayChart
                  title={`${names.plural} pe zi`}
                  name={names.plural}
                  color="#FFB27A"
                  days={daily.map((day) => ({ date: day.date, value: day.results }))}
                  unit={{ type: "count" }}
                  height={130}
                />
              </div>
              <p className="mt-3 text-[13px] text-muted-foreground">Grafice: {rows[0] && rows[0].date < chartFrom ? `ultimele ${countOf(CHART_DAYS, "zile")}` : "de la creare"}</p>
            </Card>

            <Card>
              <SectionTitle title="De la creare" />
              <div className="mt-4 space-y-4">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[13.5px] text-muted-foreground">Cheltuială totală</span>
                  <span className="pu-num text-[20px]">{formatAmount(lifetime.spend, currency)}</span>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[13.5px] text-muted-foreground">{names.plural}</span>
                  <span className="pu-num text-[20px]">{formatCount(lifetime.results)}</span>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[13.5px] text-muted-foreground">Cost mediu</span>
                  <span className="pu-num text-[16px]">{formatAmount(lifetime.costPerResult, currency)}</span>
                </div>
                <div className="flex items-baseline justify-between gap-3 border-t border-white/[0.07] pt-3">
                  <span className="text-[13.5px] text-muted-foreground">Zile cu livrare</span>
                  <span className="pu-num text-[16px]">{lifetime.days}</span>
                </div>
              </div>
              <div className="mt-5">
                <CopyButton value={planJson} label="Copiază planul JSON" className="w-full justify-center" />
              </div>
            </Card>
          </div>

          <Card padded={false} className="overflow-hidden">
            <div className="border-b border-white/[0.06] px-4 py-3">
              <h2 className="text-[15px] font-medium">Zi cu zi</h2>
            </div>
            <DaysTable days={fillDays(rows, rows[0].date, today)} currency={currency} resultLabel={names.plural} caption={`Cifrele campaniei ${campaign.name}, pe zile`} />
          </Card>
        </>
      )}

      {searchSummary ? (
        <Card>
          <SectionTitle title="Campania trimisă" />
          <div className="mt-4 max-w-4xl">
            <SearchPreview summary={searchSummary} operations={null} accountLabel={campaign.adAccount} sent />
          </div>
        </Card>
      ) : null}

      {summary ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <Card>
            <SectionTitle title="Reclamele" />
            <AdsPreview summary={summary} rotating={plan.creative.variants === "platform_rotates"} className="mt-4" />
          </Card>
          <SentMaterial
            platform={campaign.platform}
            creative={{
              headline: firstAd?.headlines[0] ?? null,
              body: firstAd?.primaryTexts[0] ?? null,
              cta: summary.cta ?? CTA_LABEL[plan.creative.cta],
            }}
            videos={summary.videos}
            destination={finalUrl}
            details={[
              [summary.videos.length > 1 ? `Video-uri · ${summary.videos.length}` : "Video", summary.videos.length > 0 ? summary.videos.join(", ") : "—"],
              ["Butonul", CTA_LABEL[plan.creative.cta]],
              ["Destinația", finalUrl ?? "—"],
              ["Publicul", `${summary.age}, ${summary.gender}${summary.places.length > 0 ? `, din ${summary.places.join(", ")}` : ""}`],
              ["Platforma", PLATFORM_LABEL[campaign.platform]],
            ]}
          />
        </div>
      ) : null}

      <Card>
        <details className="group">
          <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 text-[15px] font-medium">
            <span>
              <span aria-hidden="true" className="mr-2 inline-block transition-transform duration-150 group-open:rotate-90">
                ›
              </span>
              Planul JSON
            </span>
          </summary>
          <pre className="mt-3 max-h-[28rem] overflow-auto rounded-xl border border-white/[0.08] bg-[#0A0A0E] p-3.5 font-mono text-[12.5px] leading-relaxed text-foreground/80">{planJson}</pre>
          <div className="mt-3">
            <CopyButton value={planJson} label="Copiază planul JSON" size="xs" />
          </div>
        </details>
      </Card>
    </div>
  );
}
