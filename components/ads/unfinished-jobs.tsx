"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { CreateResponse, JobView } from "@/lib/ads/types";
import { formatLeadDateTime } from "@/app/(admin)/admin/_components/format-date";
import { ChannelIcon } from "./channel-icon";
import { JobProgress } from "./job-progress";

export interface UnfinishedJob {
  view: JobView;
  planName: string;
  createdAt: string;
  createdByEmail: string | null;
}

/**
 * Creările neterminate: cele care așteaptă limita de cereri a platformei sau
 * au rămas la jumătate pentru că fereastra s-a închis. „Reia” le duce mai
 * departe de unde au rămas; cele oprite de o eroare arată de ce.
 */
export function UnfinishedJobs({ jobs, continueJob }: { jobs: UnfinishedJob[]; continueJob: (input: { jobId: string }) => Promise<CreateResponse> }) {
  const router = useRouter();
  const [open, setOpen] = useState<Record<string, JobView>>({});
  const [done, setDone] = useState<Record<string, CreateResponse>>({});

  return (
    <ol className="mt-3 divide-y divide-hair rounded-xl border border-hair bg-white">
      {jobs.map(({ view, planName, createdAt, createdByEmail }) => {
        const live = open[view.id];
        const result = done[view.id];
        const resumable = view.status === "running" || view.status === "waiting";
        return (
          <li key={view.id} className="px-4 py-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-[14.5px] font-semibold text-bone">
                  <ChannelIcon platform={view.platform} labelled />
                  <span className="truncate">{planName}</span>
                </p>
                <p className="mt-0.5 text-[12.5px] text-dim">
                  {view.stepsDone} din {view.stepsTotal} pași · pornită {formatLeadDateTime(createdAt)}
                  {createdByEmail ? ` · ${createdByEmail}` : ""}
                </p>
                <p className={view.status === "failed" ? "mt-1 text-[13px] text-[var(--ap-error)]" : "mt-1 text-[13px] text-bone/80"}>
                  {view.status === "failed" ? `Oprită: ${view.message ?? "eroare"}` : (view.message ?? "Neterminată — fereastra s-a închis în timpul creării.")}
                </p>
              </div>
              {resumable && !live && !result ? (
                <button type="button" onClick={() => setOpen((current) => ({ ...current, [view.id]: view }))} className="btn btn-light !min-h-9 !px-3.5 !py-1.5 !text-[13px]">
                  Reia
                </button>
              ) : null}
            </div>
            {live && !result ? (
              <JobProgress
                key={`${live.id}|${live.stepsDone}|${live.status}|${live.waitUntil ?? ""}`}
                className="mt-3"
                job={live}
                continueJob={continueJob}
                onResult={(next) => {
                  if (!next.ok && next.job && (next.job.status === "running" || next.job.status === "waiting")) {
                    setOpen((current) => ({ ...current, [view.id]: next.job! }));
                  } else {
                    setDone((current) => ({ ...current, [view.id]: next }));
                    router.refresh();
                  }
                }}
              />
            ) : null}
            {result ? (
              <p role="status" className={result.ok ? "mt-2 text-[13.5px] text-[var(--ap-ok)]" : "mt-2 text-[13.5px] text-[var(--ap-error)]"}>
                {result.ok ? "Creată, pe pauză. O găsești în Campanii după următoarea actualizare." : result.message}
              </p>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
