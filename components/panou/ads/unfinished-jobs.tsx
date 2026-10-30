"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { CreateResponse, JobView } from "@/lib/ads/types";
import { dateTimeRo } from "../ui/format";
import { Btn, Card } from "../ui/primitives";
import { ChannelMark } from "./channel-mark";
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
    <ul className="space-y-2.5">
      {jobs.map(({ view, planName, createdAt, createdByEmail }) => {
        const live = open[view.id];
        const result = done[view.id];
        const resumable = view.status === "running" || view.status === "waiting";
        return (
          <li key={view.id}>
            <Card className="p-4 sm:p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <ChannelMark platform={view.platform} size="sm" />
                    <h3 className="truncate text-[14px] font-medium">{planName}</h3>
                  </div>
                  <p className="mt-1.5 text-[11.5px] text-muted-foreground">
                    {view.stepsDone} din {view.stepsTotal} pași · pornită {dateTimeRo(createdAt)}
                    {createdByEmail ? ` · ${createdByEmail}` : ""}
                  </p>
                  <p className={view.status === "failed" ? "mt-1 text-[12px] text-rose" : "mt-1 text-[12px] text-foreground/80"}>
                    {view.status === "failed" ? `Oprită: ${view.message ?? "eroare"}` : (view.message ?? "Neterminată — fereastra s-a închis în timpul creării.")}
                  </p>
                </div>
                {resumable && !live && !result ? (
                  <Btn variant="primary" size="sm" onClick={() => setOpen((current) => ({ ...current, [view.id]: view }))}>
                    Reia
                  </Btn>
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
                <p role="status" className={result.ok ? "mt-2 text-[12.5px] text-mint" : "mt-2 text-[12.5px] text-rose"}>
                  {result.ok ? "Creată, pe pauză. O găsești în Campanii după următoarea actualizare." : result.message}
                </p>
              ) : null}
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
