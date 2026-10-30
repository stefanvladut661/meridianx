import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { STATUS_LABEL } from "@/lib/ads/model/status";
import type { NormalizedStatus } from "@/lib/ads/model/types";
import { Card, Pill, Stamp, btnClass, type PillTone } from "@/components/panou/ui/primitives";
import { dateRo, num } from "@/components/panou/ui/format";

/**
 * Lista campaniilor de căutare ale clientului, ca în redesign (SearchPage,
 * „Campanii de căutare”): un card pe campanie, cu starea, bugetul și
 * trimiterea spre fișa ei. Fără stare — se randează pe server.
 */

export interface CautariCampanie {
  id: string;
  name: string;
  status: NormalizedStatus;
  statusDetail: string | null;
  client: string;
  /** Strategia de licitare, așa cum o citește Google. */
  bidding: string | null;
  /** Bugetul zilnic, deja formatat cu moneda („50 lei”). */
  budget: string | null;
  createdAt: string | null;
  /** Cheltuiala perioadei, formatată; null = campania n-a livrat în perioadă. */
  spend: string | null;
  clicks: number | null;
  /** Creată din portal (are rând în `ads_campaigns`). */
  fromPortal: boolean;
  fisaHref: string;
  googleHref: string | null;
}

const TONE: Record<NormalizedStatus, PillTone> = {
  active: "mint",
  paused: "dark",
  rejected: "rose",
  review: "apricot",
  issues: "apricot",
  scheduled: "lav",
  ended: "neutral",
  archived: "neutral",
  removed: "neutral",
  other: "neutral",
};

export function CautariCampaniiLista({ items, period }: { items: CautariCampanie[]; period: string }) {
  return (
    <ul className="space-y-2.5">
      {items.map((campaign) => (
        <li key={campaign.id}>
          <Card className="p-4 sm:p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-[14px] font-medium [overflow-wrap:anywhere]">{campaign.name}</h2>
                  <span title={campaign.statusDetail ?? undefined}>
                    <Pill tone={TONE[campaign.status]} dot>
                      {STATUS_LABEL[campaign.status]}
                    </Pill>
                  </span>
                  {campaign.fromPortal && campaign.status === "paused" ? <Stamp /> : null}
                </div>
                <p className="mt-1 text-[11.5px] text-muted-foreground">
                  {[
                    campaign.client,
                    campaign.bidding ? `Căutare · ${campaign.bidding}` : "Căutare",
                    campaign.budget ? `${campaign.budget}/zi` : null,
                    campaign.createdAt ? `creată ${dateRo(campaign.createdAt)}` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                <p className="pu-num mt-1 text-[11.5px] text-muted-foreground/80">
                  {campaign.spend !== null
                    ? `${campaign.spend} cheltuiți · ${num(campaign.clicks)} clicuri · ${period}`
                    : `fără livrare ${period}`}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <Link href={campaign.fisaHref} className={btnClass({ size: "sm", variant: "outline" })}>
                  Fișa campaniei
                </Link>
                {campaign.googleHref ? (
                  <a href={campaign.googleHref} target="_blank" rel="noopener noreferrer" className={btnClass({ size: "sm", variant: "ghost" })}>
                    Deschide în Google
                    <ExternalLink className="h-4 w-4" aria-hidden="true" />
                    <span className="sr-only"> (se deschide într-o filă nouă)</span>
                  </a>
                ) : null}
              </div>
            </div>
          </Card>
        </li>
      ))}
    </ul>
  );
}
