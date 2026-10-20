import type { Metadata } from "next";
import Link from "next/link";
import { STORE_FAILURE_MESSAGE, listCampaigns, type AdsCampaign } from "@/lib/ads/store";
import { clientsForRequest } from "@/lib/ads/model/read";
import { readSelection } from "@/lib/ads/model/selection.server";
import { OBJECTIVE_LABEL, PLATFORM_LABEL } from "@/lib/ads/constants";
import { formatMoney } from "@/lib/ads/plan-derive";
import { findWorkspace, workspaceName } from "@/lib/ads/workspaces";
import { formatLeadDateTime } from "@/app/(admin)/admin/_components/format-date";
import { ChannelIcon } from "@/components/ads/channel-icon";
import { campaignStatusLabel } from "@/components/ads/campaign-status";
import { cn } from "@/lib/utils";
import { JOBS_MIGRATION_MISSING, listUnfinishedJobs } from "@/lib/ads/jobs";
import { jobViewOf } from "@/lib/ads/job-runner";
import { UnfinishedJobs, type UnfinishedJob } from "@/components/ads/unfinished-jobs";
import { continueJobAction } from "../v2-actions";

export const metadata: Metadata = {
  title: "Planuri — MERIDIAN Reclame",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const ENTRIES = [
  { href: "/admin/ads/nou", title: "Importă JSON", body: "Un plan lipit, făcut cu Claude sau de mână. Îl citești în română, îl verifici pe cont, îl creezi pe pauză." },
  { href: "/admin/ads/lot", title: "Lot", body: "Până la 50 de planuri odată, pe orice platformă. Planurile create deja se sar." },
  { href: "/admin/ads/cautare", title: "Plan de căutare", body: "Google Search: mai multe campanii, grupuri, cuvinte cheie și negative, într-o singură cerere." },
  { href: "/admin/ads/claude", title: "Pentru Claude", body: "Instrucțiunile și contextul conturilor, de lipit la începutul conversației în care scrii planurile." },
];

/**
 * /admin/ads/planuri — planurile create din portal (toate pe pauză), cu drumul
 * spre fișa fiecăruia, și intrările spre crearea unui plan nou.
 */
export default async function PlansPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const selection = await readSelection(params);
  const [plans, clients, jobs] = await Promise.all([listCampaigns(500), clientsForRequest(), listUnfinishedJobs()]);
  const unfinished: UnfinishedJob[] = jobs.ok
    ? jobs.data.map((job) => ({ view: jobViewOf(job), planName: job.planName, createdAt: job.createdAt, createdByEmail: job.createdByEmail }))
    : [];
  const client = clients.ok ? (clients.data.find((item) => item.id === selection.clientId) ?? clients.data[0] ?? null) : null;
  const all = params.toate === "1" || !client;
  const accounts = new Set((client?.accounts ?? []).map((account) => `${account.platform}|${account.adAccount}`));
  const rows = plans.ok
    ? plans.data.filter(
        (plan) =>
          (all || accounts.has(`${plan.platform}|${plan.adAccount}`)) && (selection.channel === "toate" || plan.platform === selection.channel)
      )
    : [];

  // Un plan de căutare creează mai multe campanii odată: un singur rând pe plan.
  const groups: AdsCampaign[][] = [];
  const seen = new Map<string, AdsCampaign[]>();
  for (const plan of rows) {
    if (plan.planGroupId) {
      const existing = seen.get(plan.planGroupId);
      if (existing) {
        existing.push(plan);
        continue;
      }
      const group = [plan];
      seen.set(plan.planGroupId, group);
      groups.push(group);
    } else {
      groups.push([plan]);
    }
  }

  return (
    <main className="px-4 pb-16 pt-6 sm:px-6">
      <h1 className="text-[1.5rem] font-semibold tracking-tight text-bone">Planuri</h1>
      <p className="mt-0.5 text-[13.5px] text-dim">Ce a creat portalul — totul pe pauză — și de unde faci un plan nou.</p>

      <ul className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {ENTRIES.map((entry) => (
          <li key={entry.href}>
            <Link href={entry.href} className="block h-full rounded-xl border border-hair bg-white px-4 py-3.5 hover:border-[var(--md-a1)] hover:bg-[var(--ap-hover)]">
              <span className="text-[14.5px] font-semibold text-bone">{entry.title}</span>
              <span className="mt-1 block text-[13px] leading-relaxed text-dim">{entry.body}</span>
            </Link>
          </li>
        ))}
      </ul>

      {unfinished.length > 0 ? (
        <section aria-labelledby="neterminate" className="mt-8">
          <h2 id="neterminate" className="text-[15px] font-semibold text-bone">
            Creări neterminate
          </h2>
          <p className="mt-0.5 text-[13px] text-dim">Așteaptă limita de cereri a platformei sau au rămas la jumătate. Ce s-a creat e pe pauză.</p>
          <UnfinishedJobs jobs={unfinished} continueJob={continueJobAction} />
        </section>
      ) : null}
      {!jobs.ok && jobs.message === JOBS_MIGRATION_MISSING ? <p className="mt-6 text-[13.5px] text-dim">{jobs.message}</p> : null}

      <section aria-labelledby="create" className="mt-8">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 id="create" className="text-[15px] font-semibold text-bone">
            {all ? "Toate planurile create" : `Planurile create pentru ${client?.name}`}
          </h2>
          {client ? (
            <Link href={all ? "/admin/ads/planuri" : "/admin/ads/planuri?toate=1"} className="text-[13.5px] font-medium text-[var(--md-a1)] underline underline-offset-4">
              {all ? `Doar ${client.name}` : "Arată toate planurile"}
            </Link>
          ) : null}
        </div>

        {!plans.ok ? <p className="mt-4 text-[14px] text-[var(--ap-error)]">{STORE_FAILURE_MESSAGE[plans.reason]}</p> : null}
        {plans.ok && groups.length === 0 ? (
          <p className="mt-4 max-w-xl rounded-xl border border-dashed border-hair-strong px-5 py-6 text-[14.5px] text-dim">
            Niciun plan creat {all ? "încă" : `pentru ${client?.name}`}. Începe din „Importă JSON” sau din „Lot”.
          </p>
        ) : null}

        {groups.length > 0 ? (
          <ol className="mt-3 divide-y divide-hair rounded-xl border border-hair bg-white">
            {groups.map((group) => {
              const first = group[0];
              const workspace = findWorkspace(first.workspace);
              const budget = group.reduce((sum, plan) => sum + plan.dailyBudget, 0);
              return (
                <li key={first.id} className="grid gap-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                  <div className="min-w-0">
                    <p className="flex min-w-0 items-center gap-2">
                      <ChannelIcon platform={first.platform} className="shrink-0" />
                      <span className="sr-only">{PLATFORM_LABEL[first.platform]}: </span>
                      <Link href={`/admin/ads/${first.id}`} className="truncate text-[14.5px] font-semibold text-bone hover:text-[var(--md-a1)] hover:underline">
                        {group.length > 1 ? `Plan de căutare · ${group.length} campanii (${first.name}, …)` : first.name}
                      </Link>
                    </p>
                    <p className="mt-0.5 text-[12.5px] text-dim">
                      {workspace ? workspaceName(workspace) : first.workspace} · {first.channel === "search" ? "Căutare" : (OBJECTIVE_LABEL[first.objective] ?? first.objective)} ·{" "}
                      {formatLeadDateTime(first.createdAt)}
                      {first.createdByEmail ? ` · ${first.createdByEmail}` : ""}
                    </p>
                    {group.some((plan) => plan.creation === "partial") ? (
                      <p className="mt-1 text-[13px] text-[var(--ap-warn)]">Creat parțial: {first.creationError ?? "o parte din reclame lipsește."}</p>
                    ) : null}
                  </div>
                  <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-bone/85 sm:justify-end">
                    <span className="tabular-nums">{formatMoney(budget, first.currency)} pe zi</span>
                    <span className={cn("rounded-md px-2 py-0.5 text-[12px] font-semibold", first.status === "PAUSED" ? "bg-[var(--ap-neutral-soft)]" : "bg-[var(--ap-ok-soft)] text-[var(--ap-ok)]")}>
                      {campaignStatusLabel(first.status)}
                    </span>
                  </p>
                </li>
              );
            })}
          </ol>
        ) : null}
      </section>
    </main>
  );
}
