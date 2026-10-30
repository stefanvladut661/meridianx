"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { AlertTriangle, CheckCircle2, ExternalLink } from "lucide-react";
import type { SearchCreateResponse } from "@/lib/ads/google/search/types";
import { countOf } from "@/lib/ads/plan-derive";
import { InlineNote } from "@/components/panou/ui/actions";
import { Card, Stamp, btnClass } from "@/components/panou/ui/primitives";
import { PlanProbleme } from "./cautari-plan-probleme";

/**
 * Rezultatul creării unui plan de căutare. Pe Google crearea e atomică:
 * fie toate campaniile există acum, oprite, fie nimic — nu există „la
 * jumătate”. Panoul primește focus când apare.
 */

/** „1 grup”, „2 grupuri”, „20 de grupuri”. */
function counted(count: number, one: string, many: string): string {
  return count === 1 ? `1 ${one}` : countOf(count, many);
}

function ExternalButton({ href, primary, children }: { href: string; primary?: boolean; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={btnClass({ variant: primary ? "primary" : "outline", size: "sm" })}>
      {children}
      <ExternalLink className="ml-1.5 h-3.5 w-3.5" aria-hidden="true" />
      <span className="sr-only"> (se deschide într-o filă nouă)</span>
    </a>
  );
}

export function CautariPlanResult({ result }: { result: SearchCreateResponse }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.focus({ preventScroll: false });
  }, [result]);

  if (result.ok) {
    const single = result.campaigns.length === 1;
    return (
      <div ref={ref} tabIndex={-1} role="status" className="outline-none">
        <Card className="border-mint/25">
          <div className="flex flex-wrap items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-mint/25 bg-mint/10">
              <CheckCircle2 className="h-5 w-5 text-mint" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-[19px] font-semibold">{single ? "Campanie creată pe pauză" : "Campanii create pe pauză"}</h3>
                <Stamp />
              </div>
              <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
                {single ? "O campanie" : countOf(result.campaigns.length, "campanii")}, {counted(result.counts.adGroups, "grup", "grupuri")},{" "}
                {counted(result.counts.keywords, "cuvânt cheie", "cuvinte cheie")} și {counted(result.counts.ads, "anunț", "anunțuri")} — toate oprite. Nu livrează nimic până nu le
                pornești tu, în Google Ads.
              </p>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <ExternalButton href={result.accountUrl} primary>
              Deschide în Google Ads
            </ExternalButton>
            <Link href="/admin/ads" className={btnClass({ variant: "outline", size: "sm" })}>
              Lista de campanii
            </Link>
          </div>

          {result.storeWarning ? (
            <InlineNote tone="apricot" className="mt-4">
              {result.storeWarning}
            </InlineNote>
          ) : null}

          <ul className="mt-4 space-y-1 font-mono text-[11px] leading-relaxed text-muted-foreground">
            {result.campaigns.map((campaign) => (
              <li key={campaign.id} className="flex min-w-0 flex-wrap gap-x-2">
                <span>Campania</span>
                <a href={campaign.url} target="_blank" rel="noopener noreferrer" className="min-w-0 truncate text-foreground/90 underline-offset-4 hover:underline">
                  {campaign.name}
                  <span className="sr-only"> (se deschide într-o filă nouă)</span>
                </a>
                <span>{campaign.id}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 border-t border-white/[0.06] pt-3 font-mono text-[10.5px] text-muted-foreground">
            {counted(result.counts.operations, "operație", "operații")} într-o singură cerere · {counted(result.counts.negatives, "negativ", "negative")} ·{" "}
            {counted(result.counts.assets, "material", "materiale")}
          </p>
        </Card>
      </div>
    );
  }

  if (result.duplicate) {
    return (
      <div ref={ref} tabIndex={-1} role="alert" className="outline-none">
        <Card className="border-apricot/25 bg-apricot/[0.035]">
          <p className="flex items-center gap-2 text-[14px] font-semibold text-[#FFD0AC]">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            Planul ăsta a fost deja creat.
          </p>
          <p className="mt-2 text-[12.5px] leading-relaxed text-foreground/80">{result.message}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <ExternalButton href={result.duplicate.adsManagerUrl}>Deschide campaniile existente</ExternalButton>
            <Link href={`/admin/ads/${result.duplicate.recordId}`} className={btnClass({ variant: "outline", size: "sm" })}>
              Fișa din portal
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div ref={ref} tabIndex={-1} role="alert" className="space-y-2 outline-none">
      <InlineNote tone="rose">
        <p className="flex items-center gap-2 text-[13px] font-semibold">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
          Nu s-a creat nimic.
        </p>
        <p className="mt-1.5">{result.message}</p>
      </InlineNote>
      {result.problems && result.problems.length > 0 ? <PlanProbleme title="De corectat" problems={result.problems} tone="error" /> : null}
    </div>
  );
}
