import { raiseAlert } from "./alerte";
import { markAccount, readAccount, saveRefreshed, type Cont } from "./conturi";
import { keyProblem } from "./cripto";
import { downloadClip } from "./drive";
import type { MaintainOutcome, Patch, PlatformHandler, StepContext, StepOutcome } from "./platforme";
import type { PostRow } from "./postari";
import { chunkRange, failReasonVerdict, fetchStatus, initInbox, refreshTokens, tiktokConfigured, TIKTOK_MISSING, TtError, uploadChunk, verdict, type TtVerdict } from "./tiktok";
import { momentLabel } from "./timp";

/**
 * TikTok pentru coadă: clipul ajunge în ciornele din aplicație (inbox), iar
 * tu îl publici de acolo, cu descrierea copiată din „De publicat pe TikTok”.
 *
 *   init        plafonul de ciorne, `inbox/video/init` (publish_id + adresa de urcare, valabilă o oră)
 *   urcare      bucățile, în ordine; după fiecare, progresul se scrie în rând
 *   verificare  `status/fetch`: SEND_TO_USER_INBOX = trimisă în ciorne
 *   în ciorne   la 30 de minute, 7 zile: PUBLISH_COMPLETE = ai publicat-o din aplicație
 *
 * Fără dubluri: înaintea unei trimiteri noi (după o întrerupere) se citește
 * starea celei vechi. Dacă TikTok are deja clipul, nu se trimite din nou.
 */

const UPLOAD_URL_TTL_MS = 55 * 60_000;
const PROCESSING_TIMEOUT_MS = 30 * 60_000;
const DAY = 24 * 60 * 60_000;
const NO_UPLOAD: Patch = { tt_publish_id: null, tt_upload_url: null, tt_upload_la: null, tt_chunk_size: null, tt_chunks_total: null, tt_chunks_trimise: null, tt_status: null };

/** Tokenul de acces (24 de ore), reînnoit cu 10 minute înainte să expire. */
async function freshToken(acc: Cont): Promise<{ ok: true; token: string } | { ok: false; verdict: TtVerdict }> {
  const expires = acc.tokenExpiraLa ? Date.parse(acc.tokenExpiraLa) : 0;
  if (acc.token && expires - Date.now() > 10 * 60_000) return { ok: true, token: acc.token };
  if (!acc.refresh) return { ok: false, verdict: { kind: "token", message: "Tokenul TikTok a expirat și nu se poate reînnoi. Coada s-a oprit: conectează TikTok din nou, în Setări → Conturi." } };
  try {
    const fresh = await refreshTokens(acc.refresh);
    const now = Date.now();
    const saved = await saveRefreshed("tiktok", { token: fresh.accessToken, tokenExpiraLa: new Date(now + fresh.expiresIn * 1000).toISOString(), refresh: fresh.refreshToken, refreshExpiraLa: new Date(now + fresh.refreshExpiresIn * 1000).toISOString() });
    if (!saved.ok) return { ok: false, verdict: { kind: "transient", message: `Tokenul TikTok reînnoit n-a putut fi salvat: ${saved.message}`, restart: false } };
    return { ok: true, token: fresh.accessToken };
  } catch (error) {
    const v = verdict(error);
    // La reînnoire, orice refuz cu cod (invalid_grant, invalid_request…) înseamnă că legătura nu mai e bună.
    if (error instanceof TtError && error.code && v.kind !== "limit") return { ok: false, verdict: { kind: "token", message: "Tokenul TikTok nu se mai poate reînnoi (expirat sau revocat). Coada s-a oprit: conectează TikTok din nou, în Setări → Conturi." } };
    return { ok: false, verdict: v };
  }
}

async function fromVerdict(v: TtVerdict, patch: Patch = {}): Promise<StepOutcome> {
  switch (v.kind) {
    case "token":
      await markAccount("tiktok", "expirat", v.message);
      return { kind: "blocked", message: v.message, code: "token_expirat", ms: 15 * 60_000, stopQueue: true, patch };
    case "account":
      return { kind: "blocked", message: v.message, code: "cont_restrictionat", ms: 60 * 60_000, stopQueue: true, patch };
    case "limit":
      return { kind: "blocked", message: v.message, code: "limita", ms: v.ms, stopQueue: false, patch };
    case "permanent":
      return { kind: "error", message: v.message, code: "refuzata", permanent: true, patch: { ...patch, ...NO_UPLOAD } };
    case "transient":
      return { kind: "error", message: v.message, code: "tiktok", permanent: false, patch: v.restart ? { ...patch, ...NO_UPLOAD } : patch };
  }
}

async function account(): Promise<{ ok: true; token: string } | { ok: false; outcome: StepOutcome }> {
  if (!tiktokConfigured()) return { ok: false, outcome: { kind: "blocked", message: TIKTOK_MISSING, code: "tiktok_neconfigurat", ms: 15 * 60_000, stopQueue: false } };
  const problem = keyProblem();
  if (problem) return { ok: false, outcome: { kind: "blocked", message: problem, code: "cheie_tokenuri", ms: 15 * 60_000, stopQueue: true } };
  const result = await readAccount("tiktok");
  if (!result.ok) return { ok: false, outcome: { kind: "error", message: result.message, code: "baza", permanent: false } };
  const acc = result.data;
  if (!acc) return { ok: false, outcome: { kind: "blocked", message: "Contul TikTok nu e conectat: Postări → Setări → Conturi.", code: "cont_neconectat", ms: 15 * 60_000, stopQueue: false } };
  if (acc.stare === "expirat") return { ok: false, outcome: { kind: "blocked", message: acc.eroare ?? "Tokenul TikTok a expirat: conectează TikTok din nou, în Setări → Conturi.", code: "token_expirat", ms: 15 * 60_000, stopQueue: true } };
  if (!acc.token && !acc.refresh) return { ok: false, outcome: { kind: "blocked", message: "Tokenul TikTok nu se poate decripta (POSTARI_TOKEN_KEY s-a schimbat). Conectează TikTok din nou, în Setări → Conturi.", code: "token_ilizibil", ms: 15 * 60_000, stopQueue: true } };
  const token = await freshToken(acc);
  if (!token.ok) return { ok: false, outcome: await fromVerdict(token.verdict) };
  return token;
}

/** Ciornele trimise în ultimele 24 de ore (TikTok: „at most 5 pending shares within any 24-hour period”). */
async function draftsLastDay(ctx: StepContext): Promise<number> {
  const since = new Date(Date.now() - DAY).toISOString();
  const { count } = await ctx.admin.from("postari").select("id", { count: "exact", head: true }).eq("platforma", "tiktok").in("stare", ["in_ciorne", "publicata"]).gte("trimisa_la", since);
  return count ?? 0;
}

async function statusStep(post: PostRow, token: string): Promise<StepOutcome> {
  let status;
  try {
    status = await fetchStatus(token, post.ttPublishId as string);
  } catch (error) {
    return fromVerdict(verdict(error));
  }
  const patch: Patch = { tt_status: status.status.slice(0, 60) };
  if (status.status === "SEND_TO_USER_INBOX") return { kind: "drafted", patch };
  if (status.status === "PUBLISH_COMPLETE") return { kind: "published", patch: { ...patch, media_id: status.postIds[0] ?? null, publicata_de: "tu, din aplicația TikTok (raportat de TikTok)" } };
  if (status.status === "FAILED") return fromVerdict(failReasonVerdict(status.failReason), patch);
  const age = post.ttUploadLa ? Date.now() - Date.parse(post.ttUploadLa) : 0;
  if (age > PROCESSING_TIMEOUT_MS) return { kind: "error", message: "TikTok procesează clipul de peste 30 de minute. Se reîncearcă, cu o trimitere nouă.", code: "procesare_lunga", permanent: false, patch: NO_UPLOAD };
  return { kind: "wait", pas: "verificare", ms: 60_000, patch };
}

async function sendStep(post: PostRow, ctx: StepContext, token: string): Promise<StepOutcome> {
  // O trimitere veche, neterminată: dacă TikTok are deja clipul, nu se trimite din nou.
  if (post.ttPublishId) {
    const stale = !post.ttUploadLa || Date.now() - Date.parse(post.ttUploadLa) > UPLOAD_URL_TTL_MS;
    if (stale) {
      const check = await fetchStatus(token, post.ttPublishId).catch(() => null);
      if (check && ["PROCESSING_UPLOAD", "SEND_TO_USER_INBOX", "PUBLISH_COMPLETE"].includes(check.status) && (check.status !== "PROCESSING_UPLOAD" || (check.uploadedBytes ?? 0) >= (post.marime ?? Infinity))) {
        return { kind: "progress", pas: "verificare", patch: { tt_chunks_trimise: post.ttChunksTotal } };
      }
      return { kind: "progress", pas: "init", patch: NO_UPLOAD };
    }
  }

  const bytes = await downloadClip(post.driveFileId);
  if (!bytes.ok) return { kind: "error", message: bytes.message, code: "drive", permanent: bytes.missing };
  const size = bytes.data.length;
  if (post.marime !== null && size !== post.marime) return { kind: "error", message: `Clipul de pe Drive s-a schimbat după aprobare (acum are ${size} octeți, la verificare avea ${post.marime}). Nu trimit un fișier neverificat: verifică-l într-un plan nou.`, code: "clip_schimbat", permanent: true };

  let current: PostRow = post;
  if (!current.ttPublishId) {
    const sent = await draftsLastDay(ctx);
    const cap = Math.min(ctx.settings.plafonTiktok, 5);
    if (sent >= cap) return { kind: "blocked", message: `Au plecat deja ${sent} ciorne în ultimele 24 de ore (plafonul e ${cap}). Clipul așteaptă un loc.`, code: "plafon", ms: 30 * 60_000, stopQueue: false };
    let init;
    try {
      init = await initInbox(token, size);
    } catch (error) {
      return fromVerdict(verdict(error));
    }
    const saved = await ctx.save(current, { tt_publish_id: init.publishId, tt_upload_url: init.uploadUrl, tt_upload_la: new Date().toISOString(), tt_chunk_size: init.chunkSize, tt_chunks_total: init.total, tt_chunks_trimise: 0, tt_status: null, pas: "urcare" });
    if (!saved) return { kind: "progress", pas: "urcare" };
    current = saved;
  }

  const plan = { chunkSize: current.ttChunkSize as number, total: current.ttChunksTotal as number };
  let index = current.ttChunksTrimise ?? 0;
  while (index < plan.total) {
    if (Date.now() > ctx.deadline - 12_000) return { kind: "wait", pas: "urcare", ms: 0 };
    let complete: boolean;
    try {
      complete = await uploadChunk(current.ttUploadUrl as string, bytes.data, chunkRange(index, plan, size));
    } catch (error) {
      return fromVerdict(verdict(error));
    }
    index += 1;
    const saved = await ctx.save(current, { tt_chunks_trimise: index, pas: index >= plan.total || complete ? "verificare" : "urcare" });
    if (!saved) return { kind: "progress", pas: "urcare" };
    current = saved;
    if (complete) break;
  }
  return statusStep(current, token);
}

export const tiktokHandler: PlatformHandler = {
  platform: "tiktok",

  async maintain(ctx): Promise<MaintainOutcome> {
    const result = await readAccount("tiktok");
    if (!result.ok || !result.data || result.data.stare === "expirat") return { notes: [] };
    const acc = result.data;
    const refreshUntil = acc.refreshExpiraLa ? Date.parse(acc.refreshExpiraLa) : null;
    // Tokenul de reînnoire ține 365 de zile de la conectare; cu 14 zile înainte, alertă (o dată pe zi).
    if (refreshUntil !== null && refreshUntil - Date.now() < 14 * DAY) {
      await raiseAlert({ cheie: "cont_expira:tiktok", tip: "cont_expira", subiect: "conectarea TikTok expiră curând", mesaj: `Conectarea contului TikTok expiră ${momentLabel(acc.refreshExpiraLa as string)} (TikTok o ține cel mult un an).\n\nConectează TikTok din nou, din Postări → Setări → Conturi, înainte de data asta.` }, ctx.settings.emailAlerte);
    }
    return { notes: [] };
  },

  async step(post, ctx) {
    const acc = await account();
    if (!acc.ok) return acc.outcome;
    if (post.stare === "in_ciorne") {
      // Ai publicat-o din aplicație? TikTok raportează PUBLISH_COMPLETE.
      if (!post.ttPublishId) return { kind: "wait", ms: 24 * 60 * 60_000 };
      const outcome = await statusStep(post, acc.token);
      if (outcome.kind === "drafted" || outcome.kind === "wait") return { kind: "wait", ms: 30 * 60_000, patch: outcome.patch };
      if (outcome.kind === "error" && post.ttStatus === "SEND_TO_USER_INBOX") return { kind: "wait", ms: 30 * 60_000, patch: { avertisment: `TikTok raportează acum: ${outcome.message}` } };
      return outcome;
    }
    if (post.ttPublishId && post.ttChunksTotal !== null && (post.ttChunksTrimise ?? 0) >= post.ttChunksTotal) return statusStep(post, acc.token);
    return sendStep(post, ctx, acc.token);
  },
};
