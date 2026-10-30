"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PLATFORM_LABEL } from "@/lib/ads/constants";
import type { CreateResponse, JobView } from "@/lib/ads/types";
import { cn } from "@/lib/utils";

/**
 * O creare pe pași care încă merge: progresul (pașii gata din total, pasul
 * următor), iar la limita de cereri a platformei, ora la care se reia — cu
 * numărătoare inversă. Când ora vine (sau când o cerere a predat din lipsă de
 * timp), reia singură, cât timp pagina e deschisă; „Reia acum” face același lucru.
 */

const time = new Intl.DateTimeFormat("ro-RO", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Europe/Bucharest" });

function remaining(until: string | null, now: number): number {
  return until ? Math.max(0, Math.ceil((Date.parse(until) - now) / 1000)) : 0;
}

function clock(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}

export function JobProgress({
  job,
  continueJob,
  onResult,
  className,
}: {
  job: JobView;
  continueJob: (input: { jobId: string }) => Promise<CreateResponse>;
  onResult: (result: CreateResponse) => void;
  className?: string;
}) {
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);
  const left = job.status === "waiting" ? remaining(job.waitUntil, now) : 0;

  const resume = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      onResult(await continueJob({ jobId: job.id }));
    } catch {
      setError("Serverul n-a răspuns. Încearcă „Reia acum” peste câteva secunde — ce s-a creat rămâne, nimic nu se dublează.");
    } finally {
      setBusy(false);
    }
  }, [continueJob, job.id, onResult]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  // Reia singură: imediat dacă lucrarea doar a predat (limita de timp), la ora spusă dacă așteaptă.
  useEffect(() => {
    if (busy || started.current || job.status === "failed" || job.status === "done") return;
    if (job.status === "waiting" && left > 0) return;
    started.current = true;
    void resume();
  }, [busy, job.status, left, resume]);

  const percent = job.stepsTotal > 0 ? Math.round((job.stepsDone / job.stepsTotal) * 100) : 0;
  const platform = PLATFORM_LABEL[job.platform];

  return (
    <div tabIndex={-1} role="status" className={cn("rounded-xl border border-hair bg-char px-5 py-5", className)}>
      <p className="text-[15.5px] font-semibold text-bone">
        {job.status === "waiting" ? `${platform} a cerut o pauză. Crearea se reia singură.` : "Se creează pe pauză, pas cu pas…"}
      </p>
      <p className="mt-1.5 text-[14px] leading-relaxed text-bone/80">{job.message}</p>

      <div className="mt-4">
        <div className="flex justify-between text-[13px] text-dim">
          <span>
            {job.stepsDone} din {job.stepsTotal} pași gata{job.next ? ` · urmează ${job.next}` : ""}
          </span>
          <span className="tabular-nums">{percent}%</span>
        </div>
        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[var(--ap-neutral-soft)]" aria-hidden>
          <div className="h-full rounded-full bg-[var(--md-a1)] transition-[width] duration-300" style={{ width: `${percent}%` }} />
        </div>
      </div>

      {job.status === "waiting" && job.waitUntil ? (
        <p className="mt-3 text-[13.5px] text-bone/85">
          Reiau la <strong className="tabular-nums">{time.format(new Date(job.waitUntil))}</strong>
          {left > 0 ? (
            <>
              {" "}
              · mai sunt <span className="tabular-nums">{clock(left)}</span>
            </>
          ) : null}
          . Pagina poate rămâne deschisă; dacă o închizi, reiei din Planuri.
        </p>
      ) : null}

      {job.created.length > 0 ? (
        <p className="mt-3 text-[13px] text-dim">
          Create deja, pe pauză: {job.created.map((object) => object.name).slice(0, 4).join(" · ")}
          {job.created.length > 4 ? ` · și încă ${job.created.length - 4}` : ""}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" disabled={busy || left > 0} onClick={() => void resume()} className="btn btn-light !min-h-10 !px-4 !py-2 !text-[13.5px]">
          {busy ? "Se lucrează…" : "Reia acum"}
        </button>
        {job.adsManagerUrl ? (
          <a href={job.adsManagerUrl} target="_blank" rel="noopener noreferrer" className="btn btn-ghost !min-h-10 !px-4 !py-2 !text-[13.5px]">
            Vezi ce s-a creat în {platform}
            <span className="sr-only"> (se deschide într-o filă nouă)</span>
          </a>
        ) : null}
      </div>
      {error ? (
        <p role="alert" className="mt-3 text-[13.5px] text-[var(--ap-error)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
