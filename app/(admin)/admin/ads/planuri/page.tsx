import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, ArrowRight, FileJson, Layers, Plus, Search, ShieldCheck, Sparkles } from "lucide-react";
import { STORE_FAILURE_MESSAGE, listCampaigns, type AdsCampaign } from "@/lib/ads/store";
import { clientsForRequest } from "@/lib/ads/model/read";
import { readSelection } from "@/lib/ads/model/selection.server";
import { OBJECTIVE_LABEL } from "@/lib/ads/constants";
import { formatMoney } from "@/lib/ads/plan-derive";
import { findWorkspace, workspaceName } from "@/lib/ads/workspaces";
import { listWorkspaces } from "@/lib/ads/workspaces.server";
import { JOBS_MIGRATION_MISSING, listUnfinishedJobs } from "@/lib/ads/jobs";
import { jobViewOf } from "@/lib/ads/job-runner";
import { PAUSED } from "@/lib/ads/meta/paused";
import { ChannelMark } from "@/components/panou/ads/channel-mark";
import { UnfinishedJobs, type UnfinishedJob } from "@/components/panou/ads/unfinished-jobs";
import { PAGE_LEAD, PAGE_TITLE } from "@/components/panou/ads/tone";
import { dateTimeRo } from "@/components/panou/ui/format";
import { Card, Pill, SectionTitle, Stamp, btnClass } from "@/components/panou/ui/primitives";
import { EmptyState, ErrorState } from "@/components/panou/ui/states";
import { cn } from "@/lib/utils";
import { continueJobAction } from "../v2-actions";

export const metadata: Metadata = {
  title: "Planuri — MERIDIAN Reclame",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/** Statusul citit din platformă, în română: doar afișare, portalul nu scrie alt status decât pauza. */
const STATUS_LABEL: Record<string, string> = {
  paused: "Oprită",
  disable: "Oprită",
  active: "Pornită",
  enable: "Pornită",
  enabled: "Pornită",
  removed: "Ștearsă",
  delivery_ok: "Pornită",
  in_process: "Se procesează",
  with_issues: "Cu probleme",
  archived: "Arhivată",
  deleted: "Ștearsă",
  delete: "Ștearsă",
  budget_exceed: "Buget epuizat",
};

function statusKey(status: string): string {
  return status.toLowerCase().replace(/^campaign_status_/, "");
}

function statusLabel(status: string): string {
  return STATUS_LABEL[statusKey(status)] ?? statusKey(status).replace(/_/g, " ");
}

function isPaused(status: string): boolean {
  return status === PAUSED || statusKey(status) === "paused" || statusKey(status) === "disable";
}

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

  // Cifrele de sus: doar ce știm din bază, fără nicio cifră inventată.
  const partial = groups.filter((group) => group.some((plan) => plan.creation === "partial")).length;
  const complete = groups.length - partial;

  // Plafonul zilnic al spațiilor, în lei: același care oprește un zero în plus la creare.
  const workspaces = listWorkspaces();
  const capOf = (owner: "agentie" | "clienti") => workspaces.find((workspace) => workspace.owner === owner)?.dailyBudgetCap.RON ?? null;
  const agencyCap = capOf("agentie");
  const clientsCap = capOf("clienti");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className={PAGE_TITLE}>Planuri</h1>
          <p className={PAGE_LEAD}>Schițe verificate pe conturile reale, apoi create oprite. Un plan nu pornește nimic.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/admin/ads/cautare" className={btnClass({ variant: "ghost", size: "sm" })}>
            <Search className="h-4 w-4" aria-hidden="true" /> Plan de căutare
          </Link>
          <Link href="/admin/ads/creeaza" className={btnClass({ variant: "outline", size: "sm" })}>
            <Sparkles className="h-4 w-4" aria-hidden="true" /> Creează ghidat
          </Link>
          <Link href="/admin/ads/lot" className={btnClass({ variant: "outline", size: "sm" })}>
            <Layers className="h-4 w-4" aria-hidden="true" /> Lot
          </Link>
          <Link href="/admin/ads/nou" className={btnClass({ variant: "primary", size: "sm" })}>
            <Plus className="h-4 w-4" aria-hidden="true" /> Plan nou
          </Link>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {(
          [
            ["Planuri create", complete, "mint"],
            ["Create parțial, de verificat", partial, "rose"],
            ["Creări neterminate", unfinished.length, "sky"],
          ] as const
        ).map(([label, value, tone]) => (
          <Card key={label} className="flex items-center justify-between py-3.5">
            <span className="text-[12px] text-muted-foreground">{label}</span>
            <span className={cn("pu-num text-[20px]", tone === "mint" ? "text-mint" : tone === "sky" ? "text-sky" : "text-rose")}>{value}</span>
          </Card>
        ))}
      </div>

      <div className="flex items-start gap-2.5 rounded-xl border border-white/[0.08] bg-white/[0.025] px-3.5 py-2.5 text-[11.5px] leading-relaxed text-muted-foreground">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-mint" aria-hidden="true" />
        <p>
          Plafonul zilnic al spațiului de lucru:{" "}
          {agencyCap !== null ? (
            <>
              <span className="text-foreground">{formatMoney(agencyCap, "RON")}</span> pentru reclamele agenției
            </>
          ) : null}
          {agencyCap !== null && clientsCap !== null ? ", " : ""}
          {clientsCap !== null ? (
            <>
              <span className="text-foreground">{formatMoney(clientsCap, "RON")}</span> pentru banii clienților
            </>
          ) : null}
          . La creare, bugetul planului se compară cu plafonul — un zero în plus e prins înainte să ajungă în platformă. Un plan creat în ultimele 14 zile se sare la lot, ca să nu se dubleze.
        </p>
      </div>

      {unfinished.length > 0 ? (
        <section aria-labelledby="neterminate" className="space-y-3">
          <div id="neterminate">
            <SectionTitle title="Creări neterminate" hint="Așteaptă limita de cereri a platformei sau au rămas la jumătate. Ce s-a creat e pe pauză." />
          </div>
          <UnfinishedJobs jobs={unfinished} continueJob={continueJobAction} />
        </section>
      ) : null}
      {!jobs.ok && jobs.message === JOBS_MIGRATION_MISSING ? <p className="text-[12px] text-muted-foreground">{jobs.message}</p> : null}

      <section aria-labelledby="create" className="space-y-3">
        <div id="create">
          <SectionTitle
            title={all ? "Toate planurile create" : `Planurile create pentru ${client?.name}`}
            hint="Ce a creat portalul — totul pe pauză."
            action={
              client ? (
                <Link
                  href={all ? "/admin/ads/planuri" : "/admin/ads/planuri?toate=1"}
                  className="text-[12px] font-medium text-lav underline underline-offset-4"
                >
                  {all ? `Doar ${client.name}` : "Arată toate planurile"}
                </Link>
              ) : null
            }
          />
        </div>

        {!plans.ok ? (
          <Card className="p-0">
            <ErrorState title="Planurile nu se pot citi" text={STORE_FAILURE_MESSAGE[plans.reason]} />
          </Card>
        ) : null}

        {plans.ok && groups.length === 0 ? (
          <Card className="p-0">
            <EmptyState
              icon={FileJson}
              title="Niciun plan încă"
              text={`Niciun plan creat ${all ? "încă" : `pentru ${client?.name}`}. Lipește un plan scris cu asistentul AI sau pornește de la formularul ghidat. Îl citim în română înainte să creeze ceva.`}
              action={
                <Link href="/admin/ads/nou" className={btnClass({ variant: "primary", size: "sm" })}>
                  Lipește un plan
                </Link>
              }
              hint="Planurile nu ating conturile până nu apeși „Creează pe pauză”."
            />
          </Card>
        ) : null}

        {groups.length > 0 ? (
          <ul className="space-y-2.5">
            {groups.map((group) => {
              const first = group[0];
              const workspace = findWorkspace(first.workspace);
              const budget = group.reduce((sum, plan) => sum + plan.dailyBudget, 0);
              const paused = isPaused(first.status);
              const isPartial = group.some((plan) => plan.creation === "partial");
              return (
                <li key={first.id}>
                  <Card className="p-4 sm:p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="min-w-0 text-[14px] font-medium">
                            <Link href={`/admin/ads/${first.id}`} className="hover:text-lav hover:underline">
                              {group.length > 1 ? `Plan de căutare · ${group.length} campanii (${first.name}, …)` : first.name}
                            </Link>
                          </h2>
                          {isPartial ? (
                            <Pill tone="rose" dot>
                              Creat parțial
                            </Pill>
                          ) : (
                            <Pill tone="mint" dot>
                              Creată
                            </Pill>
                          )}
                          {paused ? <Stamp /> : <Pill tone="apricot">{statusLabel(first.status)} în platformă</Pill>}
                        </div>
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-muted-foreground">
                          <ChannelMark platform={first.platform} size="sm" />
                          <span>{workspace ? workspaceName(workspace) : first.workspace}</span>
                          <span aria-hidden="true">·</span>
                          <span>{first.channel === "search" ? "Căutare" : (OBJECTIVE_LABEL[first.objective] ?? first.objective)}</span>
                          <span aria-hidden="true">·</span>
                          <span className="pu-num">{formatMoney(budget, first.currency)}/zi</span>
                          <span aria-hidden="true">·</span>
                          <span>{dateTimeRo(first.createdAt)}</span>
                          {first.createdByEmail ? (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="break-all">{first.createdByEmail}</span>
                            </>
                          ) : null}
                        </div>
                      </div>
                      <Link href={`/admin/ads/${first.id}`} className={btnClass({ variant: "outline", size: "sm" })}>
                        Vezi campania <ArrowRight className="h-4 w-4" aria-hidden="true" />
                      </Link>
                    </div>

                    {isPartial ? (
                      <ul className="mt-3 space-y-1.5 border-t border-white/[0.06] pt-3">
                        <li className="flex items-start gap-2 text-[11.5px] leading-relaxed">
                          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-apricot" aria-hidden="true" />
                          <span className="text-[#FFD0AC]">
                            <span className="text-muted-foreground">Creat parțial:</span> {first.creationError ?? "o parte din reclame lipsește."}
                          </span>
                        </li>
                      </ul>
                    ) : null}
                  </Card>
                </li>
              );
            })}
          </ul>
        ) : null}
      </section>

      <Card className="flex flex-wrap items-center justify-between gap-3 border-lav/20 bg-lav/[0.05]">
        <div>
          <p className="text-[12.5px] font-medium text-[#D8CCFF]">Scrii planurile cu Claude?</p>
          <p className="mt-0.5 text-[11.5px] text-[#D8CCFF]/70">Ia instrucțiunile și contextul conturilor de pe pagina „Pentru Claude”.</p>
        </div>
        <Link href="/admin/ads/claude" className={btnClass({ variant: "outline", size: "sm" })}>
          Deschide instrucțiunile
        </Link>
      </Card>
    </div>
  );
}
