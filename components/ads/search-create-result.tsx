"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import type { SearchCreateResponse } from "@/lib/ads/google/search/types";
import { countOf } from "@/lib/ads/plan-derive";
import { cn } from "@/lib/utils";
import { PauseGlyph } from "./pause-seal";
import { ProblemList } from "./problem-list";
import { ERROR_TEXT, WARNING_TEXT } from "./tone";

/**
 * Rezultatul creării unui plan de căutare. Pe Google crearea e atomică:
 * fie toate campaniile există acum, oprite, fie nimic — nu există „la
 * jumătate”. Panoul primește focus când apare.
 */

/** „1 grup”, „2 grupuri”, „20 de grupuri”. */
function counted(count: number, one: string, many: string): string {
  return count === 1 ? `1 ${one}` : countOf(count, many);
}

function ExternalLink({ href, children, light }: { href: string; children: React.ReactNode; light?: boolean }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={cn("btn !min-h-11", light ? "btn-light" : "btn-ghost")}>
      {children}
      <span aria-hidden> ↗</span>
      <span className="sr-only"> (se deschide într-o filă nouă)</span>
    </a>
  );
}

export function SearchCreateResult({ result }: { result: SearchCreateResponse }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.focus({ preventScroll: false });
  }, [result]);

  if (result.ok) {
    const single = result.campaigns.length === 1;
    return (
      <div ref={ref} tabIndex={-1} role="status" className="rounded-panel-lg border border-bone/40 bg-char px-5 py-6 sm:px-7">
        <div className="flex items-center gap-4">
          <PauseGlyph className="h-12 w-12 shrink-0 text-bone" />
          <div>
            <p className="font-md-display text-[1.625rem] font-semibold leading-none tracking-tight text-bone">
              {single ? "Creată pe pauză." : "Create pe pauză."}
            </p>
            <p className="mt-2 text-[14.5px] leading-snug text-bone/75">
              {single ? "O campanie" : countOf(result.campaigns.length, "campanii")}, {counted(result.counts.adGroups, "grup", "grupuri")},{" "}
              {counted(result.counts.keywords, "cuvânt cheie", "cuvinte cheie")} și {counted(result.counts.ads, "anunț", "anunțuri")} — toate
              oprite. Verifică-le în Google Ads și pornește-le de acolo, când sunt gata.
            </p>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <ExternalLink href={result.accountUrl} light>
            Deschide în Google Ads
          </ExternalLink>
          <Link href="/admin/ads" className="btn btn-ghost !min-h-11">
            Lista de campanii
          </Link>
        </div>
        {result.storeWarning ? <p className={cn("mt-4 text-[13.5px] leading-snug", WARNING_TEXT)}>{result.storeWarning}</p> : null}
        <ul className="mt-4 space-y-1 font-md-mono text-[12px] leading-relaxed text-bone/75">
          {result.campaigns.map((campaign) => (
            <li key={campaign.id} className="flex min-w-0 flex-wrap gap-x-2">
              <span className="text-dim">Campania</span>
              <a href={campaign.url} target="_blank" rel="noopener noreferrer" className="min-w-0 truncate text-bone/90 underline-offset-4 hover:underline">
                {campaign.name}
                <span className="sr-only"> (se deschide într-o filă nouă)</span>
              </a>
              <span className="text-dim">{campaign.id}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 font-md-mono text-[11.5px] text-dim">
          {counted(result.counts.operations, "operație", "operații")} într-o singură cerere · {counted(result.counts.negatives, "negativ", "negative")} ·{" "}
          {counted(result.counts.assets, "material", "materiale")}
        </p>
      </div>
    );
  }

  if (result.duplicate) {
    return (
      <div ref={ref} tabIndex={-1} role="alert" className="rounded-panel-lg border border-[#f0b429]/40 bg-[#f0b429]/[0.05] px-5 py-5 sm:px-6">
        <p className={cn("text-[15.5px] font-semibold", WARNING_TEXT)}>Planul ăsta a fost deja creat.</p>
        <p className="mt-2 text-[14px] leading-relaxed text-bone/80">{result.message}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <ExternalLink href={result.duplicate.adsManagerUrl}>Deschide campaniile existente</ExternalLink>
          <Link href={`/admin/ads/${result.duplicate.recordId}`} className="btn btn-ghost !min-h-11">
            Fișa din portal
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div ref={ref} tabIndex={-1} role="alert" className="space-y-3">
      <div className="rounded-panel-lg border border-[#d93025]/35 bg-[#d93025]/[0.05] px-5 py-4">
        <p className={cn("text-[15px] font-semibold", ERROR_TEXT)}>Nu s-a creat nimic.</p>
        <p className="mt-1.5 text-[14px] leading-relaxed text-bone/80">{result.message}</p>
      </div>
      {result.problems && result.problems.length > 0 ? <ProblemList title="De corectat" problems={result.problems} tone="error" /> : null}
    </div>
  );
}
