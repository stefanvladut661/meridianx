import Link from "next/link";
import { OBJECTIVE_LABEL, resultLabel } from "@/lib/ads/constants";
import { formatAmount, formatCount, type Totals } from "@/lib/ads/metrics";
import { formatMoney } from "@/lib/ads/plan-derive";
import { campaignUrl, managerName } from "@/lib/ads/links";
import type { AdsCampaign } from "@/lib/ads/store";
import type { WorkspaceSummary } from "@/lib/ads/workspaces";
import { formatLeadDateTime } from "@/app/(admin)/admin/_components/format-date";
import { cn } from "@/lib/utils";
import { PauseGlyph } from "./pause-seal";
import { WARNING_TEXT } from "./tone";
import { campaignStatusLabel, isPausedStatus } from "./campaign-status";

/**
 * Campaniile create din portal, cele mai noi primele, din toate spațiile.
 *
 * Nu e tabel: pe telefon un tabel cu șase coloane ori derulează lateral,
 * ori se strânge până nu se mai citește. Fiecare campanie e un rând care
 * se rearanjează — numele și spațiul întâi, apoi bugetul, apoi linkul.
 *
 * Cifrele (cheltuiala și rezultatele de la creare) vin din sincronizarea
 * zilnică; o campanie fără cifre spune „încă nimic cheltuit”, nu „0”.
 */
export function CampaignList({
  campaigns,
  workspaces,
  currentId,
  totals,
}: {
  campaigns: AdsCampaign[];
  workspaces: WorkspaceSummary[];
  currentId: string;
  /** Cifrele de la creare, pe id de campanie. */
  totals: Map<string, Totals>;
}) {
  return (
    <ol className="divide-y divide-hair overflow-hidden rounded-panel-lg border border-hair bg-char">
      {campaigns.map((campaign) => {
        const workspace = workspaces.find((item) => item.id === campaign.workspace) ?? null;
        const paused = isPausedStatus(campaign.status);
        const url = campaignUrl(campaign.platform, campaign.adAccount, campaign.platformCampaignId);
        const spent = totals.get(campaign.id);
        return (
          <li
            key={campaign.id}
            className={cn(
              "grid gap-x-6 gap-y-3 px-5 py-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-6",
              campaign.workspace === currentId && "bg-[radial-gradient(90%_140%_at_0%_0%,rgb(255_255_255/0.05),transparent_60%)]"
            )}
          >
            <div className="flex min-w-0 gap-4">
              <span className="mt-0.5 shrink-0 text-bone/85" title={campaignStatusLabel(campaign.status)}>
                <PauseGlyph className={cn("h-9 w-9", !paused && "opacity-30")} />
              </span>
              <div className="min-w-0">
                <Link
                  href={`/admin/ads/${campaign.id}`}
                  className="text-[16px] font-semibold leading-snug text-bone underline-offset-4 hover:underline"
                >
                  {campaign.name}
                </Link>
                <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-dim">
                  <span
                    className={cn(
                      "rounded-full border px-2 py-0.5 font-md-mono text-[11px] tracking-wide",
                      workspace?.owner === "clienti"
                        ? "border-[#f0b429]/40 text-[#f5c451]"
                        : "border-hair-strong text-bone/80"
                    )}
                  >
                    {workspace?.name ?? campaign.workspace}
                  </span>
                  <span>{OBJECTIVE_LABEL[campaign.objective] ?? campaign.objective}</span>
                  <span aria-hidden>·</span>
                  <span className="font-md-mono text-[12px] tabular-nums">
                    {formatLeadDateTime(campaign.createdAt)}
                  </span>
                  {campaign.createdByEmail ? (
                    <>
                      <span aria-hidden>·</span>
                      <span className="break-all">{campaign.createdByEmail}</span>
                    </>
                  ) : null}
                </p>
                {campaign.creation === "partial" ? (
                  <p className={cn("mt-2 text-[13.5px] leading-snug", WARNING_TEXT)}>
                    Creată parțial: {campaign.creationError ?? "o parte din reclame lipsește."}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pl-[3.25rem] sm:justify-end sm:pl-0">
              <p className="text-[14px] text-bone/85">
                <span className="font-semibold tabular-nums text-bone">
                  {formatMoney(campaign.dailyBudget, campaign.currency)}
                </span>{" "}
                <span className="text-dim">pe zi</span>
              </p>
              <p className="text-[13.5px] tabular-nums text-bone/85">
                {spent && spent.spend > 0 ? (
                  <>
                    <span className="font-semibold text-bone">{formatAmount(spent.spend, campaign.currency)}</span>{" "}
                    <span className="text-dim">cheltuiți ·</span> {formatCount(spent.results)}{" "}
                    <span className="text-dim">{resultLabel(campaign.objective, campaign.platform).unit}</span>
                  </>
                ) : (
                  <span className="text-dim">încă nimic cheltuit</span>
                )}
              </p>
              <p className="font-md-mono text-[11.5px] uppercase tracking-[0.18em] text-bone/80">
                {campaignStatusLabel(campaign.status)}
              </p>
              <Link
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[13.5px] font-medium text-bone underline underline-offset-4 hover:text-bone/80"
              >
                {managerName(campaign.platform)}<span aria-hidden> ↗</span>
                <span className="sr-only"> (se deschide într-o filă nouă)</span>
              </Link>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
