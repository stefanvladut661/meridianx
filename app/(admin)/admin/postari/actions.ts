"use server";

import { revalidatePath } from "next/cache";
import { runQueue } from "@/lib/postari/coada";
import { actorEmail, SESSION_EXPIRED } from "@/lib/postari/db";
import { logEvent } from "@/lib/postari/istoric";
import { PLATFORMA_LABEL } from "@/lib/postari/limite";
import { removePost, retryPost } from "@/lib/postari/postari";
import { setQueueRunning } from "@/lib/postari/setari";
import { momentLabel } from "@/lib/postari/timp";

export type ActionResult = { ok: true; message: string } | { ok: false; message: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** „Oprește coada” / „Pornește coada”. Postările deja plecate nu se ating. */
export async function setQueueAction(running: boolean, reason: unknown): Promise<ActionResult> {
  const actor = await actorEmail();
  if (!actor) return { ok: false, message: SESSION_EXPIRED };
  const motiv = typeof reason === "string" && reason.trim() ? reason.trim().slice(0, 300) : "Oprită din admin.";
  const result = await setQueueRunning(Boolean(running), running ? null : motiv, actor);
  if (!result.ok) return result;
  await logEvent({ actor, zona: "coada", actiune: running ? "coadă pornită" : "coadă oprită", rezultat: "ok", mesaj: running ? "Postările pleacă din nou la orele din plan." : motiv });
  revalidatePath("/admin/postari", "layout");
  return { ok: true, message: running ? "Coada merge. Postările pleacă la orele din plan." : "Coada e oprită. Nimic nu pleacă până o pornești." };
}

export async function removePostAction(id: unknown): Promise<ActionResult> {
  const actor = await actorEmail();
  if (!actor) return { ok: false, message: SESSION_EXPIRED };
  if (typeof id !== "string" || !UUID.test(id)) return { ok: false, message: "Postarea nu e validă." };
  const result = await removePost(id, actor);
  if (!result.ok) return result;
  const post = result.data;
  await logEvent({ actor, zona: "coada", actiune: "scoasă din coadă", tinta: id, rezultat: "ok", mesaj: `„${post.fisier}” pe ${PLATFORMA_LABEL[post.platforma]} (${momentLabel(post.programataLa)}).` });
  revalidatePath("/admin/postari", "layout");
  return { ok: true, message: `„${post.fisier}” e scoasă din coadă și nu mai pleacă pe ${PLATFORMA_LABEL[post.platforma]}.` };
}

export async function retryPostAction(id: unknown): Promise<ActionResult> {
  const actor = await actorEmail();
  if (!actor) return { ok: false, message: SESSION_EXPIRED };
  if (typeof id !== "string" || !UUID.test(id)) return { ok: false, message: "Postarea nu e validă." };
  const result = await retryPost(id, actor);
  if (!result.ok) return result;
  const post = result.data;
  await logEvent({ actor, zona: "coada", actiune: "repusă în coadă", tinta: id, rezultat: "ok", mesaj: `„${post.fisier}” pe ${PLATFORMA_LABEL[post.platforma]}: pleacă la rularea următoare.` });
  revalidatePath("/admin/postari", "layout");
  return { ok: true, message: `„${post.fisier}” e din nou în coadă și pleacă la rularea următoare (cel mult 5 minute), sau acum, cu „Rulează acum”.` };
}

/** „Rulează acum”: o rulare a cozii, fără să aștepți Supabase Cron. Pleacă doar ce e deja la timp. */
export async function runNowAction(): Promise<ActionResult> {
  const actor = await actorEmail();
  if (!actor) return { ok: false, message: SESSION_EXPIRED };
  const result = await runQueue({ source: "manual", actor });
  revalidatePath("/admin/postari", "layout");
  if (!result.ok) return result;
  const s = result.summary;
  if (s.coadaOprita) return { ok: true, message: "Coada e oprită: rularea n-a luat nimic. Pornește coada întâi." };
  if (s.luate === 0) return { ok: true, message: `Nimic de trimis acum: nicio postare nu e la timp.${s.intarziate ? ` ${s.intarziate} rămase în urmă au fost marcate eșuate.` : ""}` };
  return { ok: true, message: `Rulare terminată: ${s.luate} luate, ${s.publicate} publicate, ${s.ciorne} în ciorne, ${s.asteapta} în așteptare, ${s.reincercari} de reîncercat, ${s.esuate} eșuate${s.amanate ? `, ${s.amanate} continuă la rularea următoare` : ""}.` };
}
