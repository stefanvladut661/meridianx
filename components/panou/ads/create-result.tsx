"use client";

import Link from "next/link";
import { useEffect, useRef, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, ExternalLink as ExternalIcon, FileJson } from "lucide-react";
import type { Platform } from "@/lib/ads/constants";
import { managerName } from "@/lib/ads/links";
import type { CreateResponse, CreatedObject } from "@/lib/ads/types";
import { countOf } from "@/lib/ads/plan-derive";
import { cn } from "@/lib/utils";
import { Btn, Card, Stamp, btnClass } from "../ui/primitives";
import { ProblemList } from "./problem-list";
import { JobProgress } from "./job-progress";

/**
 * Rezultatul creării: ce există acum în platformă, oprit, cu link direct.
 *
 * Patru ieșiri, fiecare cu instrucțiunea ei:
 *   creată       — linkul spre Ads Manager, unde omul o verifică și o pornește;
 *   dublură      — același plan a fost creat de curând: încă o dată doar intenționat;
 *   la jumătate  — ce apucase să se creeze (tot pe pauză) și ce a refuzat platforma;
 *   refuzată     — nimic creat, ce să corectezi.
 *
 * Panoul primește focus când apare: după un clic de câteva secunde, omul
 * (și cititorul de ecran) trebuie să afle rezultatul fără să-l caute.
 */

const KIND_LABEL: Record<CreatedObject["kind"], string> = {
  image: "Imaginea",
  campaign: "Campania",
  adset: "Setul de reclame",
  creative: "Materialul",
  ad: "Reclama",
};

function CreatedList({ created, platform }: { created: CreatedObject[]; platform: Platform }) {
  return (
    <ul className="mt-4 space-y-1 text-left font-mono text-[11px] leading-relaxed text-foreground/75">
      {created.map((object) => (
        <li key={`${object.kind}-${object.id}`} className="flex min-w-0 flex-wrap gap-x-2">
          <span className="text-muted-foreground">
            {object.kind === "adset" && platform === "tiktok"
              ? "Grupul de reclame"
              : object.kind === "adset" && platform === "google"
                ? "Grupul de anunțuri"
                : KIND_LABEL[object.kind]}
          </span>
          <span className="min-w-0 truncate text-foreground/90">{object.name}</span>
          <span className="text-muted-foreground">{object.id}</span>
        </li>
      ))}
    </ul>
  );
}

function ExternalButton({ href, children, primary }: { href: string; children: ReactNode; primary?: boolean }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={btnClass({ variant: primary ? "primary" : "outline", size: "sm" })}>
      {children}
      <ExternalIcon className="h-3.5 w-3.5" aria-hidden="true" />
      <span className="sr-only"> (se deschide într-o filă nouă)</span>
    </a>
  );
}

export function CreateResult({
  result,
  platform,
  onCreateAnyway,
  pending,
  continueJob,
  onResult,
  onAnother,
}: {
  result: CreateResponse;
  platform: Platform;
  onCreateAnyway: () => void;
  pending: boolean;
  /** v2: reluarea unei creări pe pași (limita de cereri a platformei). */
  continueJob?: (input: { jobId: string }) => Promise<CreateResponse>;
  onResult?: (result: CreateResponse) => void;
  /** „Lipește alt plan”: golește editorul și pornește de la capăt. Fără el, butonul nu apare. */
  onAnother?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const manager = managerName(platform);
  useEffect(() => {
    ref.current?.focus({ preventScroll: false });
  }, [result]);

  if (!result.ok && result.job && continueJob && onResult && (result.job.status === "running" || result.job.status === "waiting")) {
    const job = result.job;
    return (
      <div ref={ref} tabIndex={-1} className="outline-none">
        {/* O stare nouă = o componentă nouă: reluarea automată pornește din nou pentru ea. */}
        <JobProgress key={`${job.id}|${job.stepsDone}|${job.status}|${job.waitUntil ?? ""}`} job={job} continueJob={continueJob} onResult={onResult} />
      </div>
    );
  }

  if (result.ok) {
    const ads = result.created.filter((object) => object.kind === "ad").length;
    return (
      <div ref={ref} tabIndex={-1} role="status" className="outline-none">
        <Card className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-mint/25 bg-mint/10">
            <CheckCircle2 className="h-5 w-5 text-mint" aria-hidden="true" />
          </div>
          <h2 className="text-[19px] font-semibold">Campanie creată pe pauză</h2>
          <p className="mx-auto mt-2 max-w-md text-[13px] leading-relaxed text-muted-foreground">
            {ads === 1 ? "O reclamă" : countOf(ads, "reclame")} pe pauză. Nu livrează nimic până nu o pornești în {manager}: verific-o acolo și pornește-o când e gata.
          </p>
          <div className="mt-4 flex justify-center">
            <Stamp />
          </div>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Link href="/admin/ads" className={btnClass({ variant: "outline", size: "sm" })}>
              Vezi campaniile
            </Link>
            <ExternalButton href={result.adsManagerUrl} primary={!onAnother}>
              Deschide în {manager}
            </ExternalButton>
            {onAnother ? (
              <Btn variant="primary" size="sm" icon={FileJson} onClick={onAnother}>
                Lipește alt plan
              </Btn>
            ) : null}
          </div>
          {result.storeWarning ? <p className="mt-4 text-[12.5px] leading-snug text-apricot">{result.storeWarning}</p> : null}
          <CreatedList created={result.created} platform={platform} />
        </Card>
      </div>
    );
  }

  if (result.duplicate) {
    return (
      <div ref={ref} tabIndex={-1} role="alert" className="rounded-xl border border-apricot/25 bg-apricot/[0.07] px-4 py-4 outline-none">
        <p className="flex items-center gap-2 text-[13.5px] font-medium text-[#FFD0AC]">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Planul ăsta a fost deja creat.
        </p>
        <p className="mt-2 text-[12.5px] leading-relaxed text-[#FFD0AC]/85">{result.message}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <ExternalButton href={result.duplicate.adsManagerUrl}>Deschide campania existentă</ExternalButton>
          <Btn variant="outline" size="sm" onClick={onCreateAnyway} disabled={pending}>
            {pending ? "Se creează…" : "Creează încă una, intenționat"}
          </Btn>
        </div>
      </div>
    );
  }

  if (result.partial) {
    return (
      <div ref={ref} tabIndex={-1} role="alert" className="rounded-xl border border-apricot/25 bg-apricot/[0.07] px-4 py-4 outline-none">
        <p className="flex items-center gap-2 text-[13.5px] font-medium text-[#FFD0AC]">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Crearea s-a oprit la jumătate. Ce există e pe pauză.
        </p>
        <p className="mt-2 text-[12.5px] leading-relaxed text-[#FFD0AC]/85">{result.message}</p>
        <p className="mt-2 text-[12.5px] leading-relaxed text-[#FFD0AC]/85">
          Completează ce lipsește din {manager} sau șterge campania de acolo și creeaz-o din nou după corectură.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <ExternalButton href={result.partial.adsManagerUrl}>Deschide în {manager}</ExternalButton>
        </div>
        <CreatedList created={result.partial.created} platform={platform} />
      </div>
    );
  }

  return (
    <div ref={ref} tabIndex={-1} role="alert" className={cn("space-y-2 outline-none")}>
      <div className="rounded-xl border border-rose/25 bg-rose/[0.07] px-4 py-3">
        <p className="flex items-center gap-2 text-[13.5px] font-medium text-[#FFC2CE]">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Nu s-a creat nimic.
        </p>
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-[#FFC2CE]/85">{result.message}</p>
      </div>
      {result.problems && result.problems.length > 0 ? (
        <ProblemList title="De corectat" problems={result.problems} tone="error" />
      ) : null}
    </div>
  );
}
