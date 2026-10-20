import "server-only";

import { readJob, type JobRow } from "./jobs";
import { findWorkspace } from "./workspaces";
import { continueMetaJob, metaJobView, type MetaJobState } from "./meta/create";
import { continueTikTokJob, tiktokJobView, type TikTokJobState } from "./tiktok/create";
import type { CreateResponse, JobView } from "./types";

/** Lucrarea, cum o vede ecranul (pașii, ce s-a creat, până când așteaptă). */
export function jobViewOf(job: JobRow<unknown>): JobView {
  if (job.platform === "meta") return metaJobView(job as JobRow<MetaJobState>);
  if (job.platform === "tiktok") return tiktokJobView(job as JobRow<TikTokJobState>);
  return {
    id: job.id,
    platform: job.platform,
    status: job.status,
    stepsDone: job.stepsDone,
    stepsTotal: job.stepsTotal,
    next: null,
    waitUntil: job.waitUntil,
    message: job.message,
    created: [],
    adsManagerUrl: null,
  };
}

/**
 * „Continuă” pentru o creare pe pași, pe platforma ei. Lucrarea își știe
 * spațiul de lucru (tokenul și plafonul) din momentul creării; nu-l ia din
 * ce e ales acum pe ecran.
 */
export async function continueJob(jobId: string): Promise<CreateResponse> {
  const job = await readJob<unknown>(jobId);
  if (!job.ok) return { ok: false, message: job.message };
  if (!job.data) return { ok: false, message: "Lucrarea nu există." };
  const workspace = findWorkspace(job.data.workspace);
  if (!workspace) return { ok: false, message: `Spațiul ${job.data.workspace} nu mai există.` };
  switch (job.data.platform) {
    case "meta":
      return continueMetaJob(workspace, jobId);
    case "tiktok":
      return continueTikTokJob(workspace, jobId);
    default:
      return { ok: false, message: "Reluarea pe platforma asta vine într-o fază următoare." };
  }
}
