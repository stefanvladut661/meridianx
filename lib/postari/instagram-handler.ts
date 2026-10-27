import { raiseAlert } from "./alerte";
import { readAccount, markAccount, saveRefreshed } from "./conturi";
import { keyProblem } from "./cripto";
import { CRON_ACTOR } from "./db";
import { downloadClip } from "./drive";
import { containerStatus, createReelContainer, IgError, mediaInfo, publishContainer, publishingLimit, recentReels, refreshToken, verdict, type IgVerdict } from "./instagram";
import { logEvent } from "./istoric";
import type { MaintainOutcome, Patch, PlatformHandler, StepContext, StepOutcome } from "./platforme";
import type { PostRow } from "./postari";
import { removeTemp, signedUrl, StorageError, tempPath, uploadResumable } from "./stocare";
import { momentLabel } from "./timp";

/**
 * Instagram pentru coadă. Pașii unei postări, fiecare reluabil:
 *
 *   copiere    clipul de pe Drive → bucket-ul `postari-temp`, pe bucăți (TUS)
 *   container  plafonul pe 24 de ore, linkul semnat, containerul REELS
 *   procesare  starea containerului (o dată pe minut, cum cere documentația)
 *   publicare  `ig_publicare_la` se scrie ÎNAINTE de `media_publish`; o rulare
 *              întreruptă după el nu republică: citește starea containerului
 *              (PUBLISHED = deja publicată) și caută postarea în ultimele Reels.
 *
 * Copia temporară se șterge după publicare sau după eșecul definitiv.
 */

const DAY = 24 * 60 * 60_000;
const REFRESH_EVERY_MS = 7 * DAY;
const REFRESH_WHEN_LEFT_MS = 14 * DAY;
/** Tokenul din panoul Meta e valabil 60 de zile; la conectare nu se știe exact de când e. */
export const DASHBOARD_TOKEN_MS = 60 * DAY;
const PROCESSING_TIMEOUT_MS = 30 * 60_000;
const NO_CONTAINER: Patch = { ig_container_id: null, ig_container_la: null, ig_publicare_la: null };

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type Account = { ok: true; igId: string; token: string } | { ok: false; outcome: StepOutcome };

async function account(): Promise<Account> {
  const problem = keyProblem();
  if (problem) return { ok: false, outcome: { kind: "blocked", message: problem, code: "cheie_tokenuri", ms: 15 * 60_000, stopQueue: true } };
  const result = await readAccount("instagram");
  if (!result.ok) return { ok: false, outcome: { kind: "error", message: result.message, code: "baza", permanent: false } };
  const acc = result.data;
  if (!acc) return { ok: false, outcome: { kind: "blocked", message: "Contul Instagram nu e conectat: Postări → Setări → Conturi.", code: "cont_neconectat", ms: 15 * 60_000, stopQueue: false } };
  if (acc.stare === "expirat") return { ok: false, outcome: { kind: "blocked", message: acc.eroare ?? "Tokenul Instagram a expirat: lipește unul nou în Postări → Setări → Conturi.", code: "token_expirat", ms: 15 * 60_000, stopQueue: true } };
  if (!acc.token) return { ok: false, outcome: { kind: "blocked", message: "Tokenul Instagram nu se poate decripta (POSTARI_TOKEN_KEY s-a schimbat). Conectează contul din nou, în Setări → Conturi.", code: "token_ilizibil", ms: 15 * 60_000, stopQueue: true } };
  return { ok: true, igId: acc.contId, token: acc.token };
}

/** Eroarea Instagram → ce face coada cu postarea. `patch` se scrie oricum (ex. containerul golit). */
async function fromVerdict(v: IgVerdict, patch: Patch = {}): Promise<StepOutcome> {
  switch (v.kind) {
    case "token":
      await markAccount("instagram", "expirat", v.message);
      return { kind: "blocked", message: v.message, code: "token_expirat", ms: 15 * 60_000, stopQueue: true, patch };
    case "account":
      return { kind: "blocked", message: v.message, code: "cont_restrictionat", ms: 60 * 60_000, stopQueue: true, patch };
    case "limit":
      return { kind: "blocked", message: v.message, code: "limita", ms: v.ms, stopQueue: false, patch };
    case "not_ready":
      return { kind: "wait", pas: "procesare", ms: 60_000, patch };
    case "permanent":
      return { kind: "error", message: v.message, code: "refuzata", permanent: true, patch: { ...patch, ...NO_CONTAINER } };
    case "transient":
      return { kind: "error", message: v.message, code: "instagram", permanent: false, patch: v.newContainer ? { ...patch, ...NO_CONTAINER } : patch };
  }
}

function storageOutcome(error: unknown): StepOutcome {
  if (error instanceof StorageError) return { kind: "error", message: error.message, code: "stocare", permanent: !error.transient };
  return { kind: "error", message: "Copierea clipului a dat o eroare neașteptată. Se reîncearcă.", code: "stocare", permanent: false };
}

const copied = (post: PostRow) => Boolean(post.stocareCale) && post.stocareTusUrl === null && post.stocareOcteti !== null;

async function copyStep(post: PostRow, ctx: StepContext): Promise<StepOutcome> {
  const bytes = await downloadClip(post.driveFileId);
  if (!bytes.ok) return { kind: "error", message: bytes.message, code: "drive", permanent: bytes.missing };
  const total = bytes.data.length;
  if (post.marime !== null && total !== post.marime) {
    return { kind: "error", message: `Clipul de pe Drive s-a schimbat după aprobare (acum are ${total} octeți, la verificare avea ${post.marime}). Nu public un fișier neverificat: verifică-l într-un plan nou.`, code: "clip_schimbat", permanent: true };
  }
  if (total > ctx.settings.stocareLimitaMb * 1024 * 1024) return { kind: "error", message: `Clipul are peste ${ctx.settings.stocareLimitaMb} MB, limita stocării temporare.`, code: "prea_mare", permanent: true };
  const path = tempPath(post.id);
  let current: PostRow | null = post;
  try {
    const progress = await uploadResumable({
      path,
      bytes: bytes.data,
      uploadUrl: post.stocareCale === path ? post.stocareTusUrl : null,
      deadline: ctx.deadline,
      onChunk: async (step) => {
        if (!current) return false;
        current = await ctx.save(current, { stocare_cale: path, stocare_tus_url: step.uploadUrl, stocare_octeti: step.offset, pas: "copiere" });
        return current !== null;
      },
    });
    if (!current) return { kind: "progress", pas: "copiere" };
    if (!progress.done) return { kind: "wait", pas: "copiere", ms: 0 };
    return { kind: "progress", pas: "container", patch: { stocare_cale: path, stocare_tus_url: null, stocare_octeti: total } };
  } catch (error) {
    return storageOutcome(error);
  }
}

async function containerStep(post: PostRow, ctx: StepContext, igId: string, token: string): Promise<StepOutcome> {
  let videoUrl: string;
  try {
    const limit = await publishingLimit(igId, token);
    const cap = Math.min(ctx.settings.plafonInstagram, limit.total ?? ctx.settings.plafonInstagram);
    if (limit.used >= cap) return { kind: "blocked", message: `Plafonul de postări prin API pe 24 de ore e atins (${limit.used} din ${cap}). Postarea pleacă după ce se eliberează un loc.`, code: "plafon", ms: 30 * 60_000, stopQueue: false };
  } catch (error) {
    return fromVerdict(verdict(error));
  }
  try {
    videoUrl = await signedUrl(post.stocareCale ?? tempPath(post.id));
  } catch (error) {
    return storageOutcome(error);
  }
  const options = post.optiuni as { tip?: string; absolvire?: string | null; in_feed?: boolean; coperta_ms?: number | null };
  const trial = options.tip === "trial_reel" ? (options.absolvire === "automat" ? "SS_PERFORMANCE" : "MANUAL") : null;
  let containerId: string;
  try {
    containerId = await createReelContainer(igId, token, { videoUrl, caption: post.caption, shareToFeed: trial ? null : options.in_feed !== false, thumbOffsetMs: typeof options.coperta_ms === "number" ? options.coperta_ms : null, trial });
  } catch (error) {
    return fromVerdict(verdict(error));
  }
  const row = await ctx.save(post, { ig_container_id: containerId, ig_container_la: new Date().toISOString(), pas: "procesare" });
  if (!row) return { kind: "progress", pas: "procesare" };
  return statusStep(row, ctx, igId, token, true);
}

/** Starea containerului; la FINISHED publică. `fresh`: tocmai creat, mai verificăm de două ori în rularea asta. */
async function statusStep(post: PostRow, ctx: StepContext, igId: string, token: string, fresh = false): Promise<StepOutcome> {
  const containerId = post.igContainerId as string;
  // Documentația: „querying a container's status once per minute”. În rularea în care a fost creat, încă două verificări, la 20 și 15 s.
  const pauses = fresh ? [20_000, 15_000] : [0];
  for (const pause of pauses) {
    if (pause > 0) {
      if (Date.now() + pause > ctx.deadline - 12_000) break;
      await sleep(pause);
    }
    let status: Awaited<ReturnType<typeof containerStatus>>;
    try {
      status = await containerStatus(containerId, token);
    } catch (error) {
      return fromVerdict(verdict(error));
    }
    if (status.statusCode === "FINISHED") return publishStep(post, ctx, igId, token);
    if (status.statusCode === "PUBLISHED") return recoverStep(post, ctx, igId, token);
    if (status.statusCode === "EXPIRED") return { kind: "progress", pas: "container", patch: NO_CONTAINER };
    if (status.statusCode === "ERROR") {
      const subcode = Number(String(status.status ?? "").match(/\d{6,8}/)?.[0] ?? NaN);
      const v: IgVerdict = Number.isFinite(subcode) ? verdict(new IgError(status.status ?? "ERROR", 400, null, subcode, false)) : { kind: "transient", message: `Instagram n-a putut procesa clipul${status.status ? ` (${status.status})` : ""}. Se reîncearcă, cu un container nou.`, newContainer: true };
      return fromVerdict(v.kind === "not_ready" ? { kind: "transient", message: v.message, newContainer: true } : v, NO_CONTAINER);
    }
    // IN_PROGRESS (sau o stare necunoscută): așteaptă, dar nu la nesfârșit.
    const age = post.igContainerLa ? Date.now() - new Date(post.igContainerLa).getTime() : 0;
    if (age > PROCESSING_TIMEOUT_MS) return { kind: "error", message: "Instagram procesează clipul de peste 30 de minute. Se reîncearcă, cu un container nou.", code: "procesare_lunga", permanent: false, patch: NO_CONTAINER };
  }
  return { kind: "wait", pas: "procesare", ms: 60_000 };
}

async function publishStep(post: PostRow, ctx: StepContext, igId: string, token: string): Promise<StepOutcome> {
  const marked = await ctx.save(post, { ig_publicare_la: new Date().toISOString(), pas: "publicare" });
  if (!marked) return { kind: "progress", pas: "publicare" };
  let result: { mediaId: string; configIssue: string | null };
  try {
    result = await publishContainer(igId, token, post.igContainerId as string);
  } catch (error) {
    // Fără răspuns: nu se știe dacă a publicat. `ig_publicare_la` rămâne; rularea următoare verifică, nu republică.
    if (error instanceof IgError && error.noResponse) return { kind: "wait", pas: "publicare", ms: 60_000 };
    // Un răspuns cu eroare: publicarea n-a avut loc.
    return fromVerdict(verdict(error), { ig_publicare_la: null });
  }
  return finish(post, token, result.mediaId, result.configIssue);
}

async function finish(post: PostRow, token: string, mediaId: string, configIssue: string | null): Promise<StepOutcome> {
  const info = await mediaInfo(mediaId, token).catch(() => null);
  const warning = configIssue ? `Publicată, dar Instagram raportează: ${configIssue}. Verific-o în aplicație.` : !info?.permalink ? "Publicată; linkul nu s-a putut citi. O găsești în aplicație." : null;
  return { kind: "published", patch: { media_id: mediaId, link: info?.permalink ?? null, avertisment: warning, publicata_de: "coada (Instagram, automat)" } };
}

const parseIgTime = (value: string | null) => (value ? Date.parse(value.replace(/([+-]\d\d)(\d\d)$/, "$1:$2")) : NaN);

/** După o cerere de publicare fără rezultat știut. */
async function recoverStep(post: PostRow, ctx: StepContext, igId: string, token: string): Promise<StepOutcome> {
  let status: Awaited<ReturnType<typeof containerStatus>>;
  try {
    status = await containerStatus(post.igContainerId as string, token);
  } catch (error) {
    const v = verdict(error);
    return v.kind === "transient" ? { kind: "wait", pas: "publicare", ms: 60_000 } : fromVerdict(v);
  }
  if (status.statusCode === "FINISHED") return publishStep(post, ctx, igId, token);
  if (status.statusCode === "IN_PROGRESS") return { kind: "wait", pas: "publicare", ms: 60_000 };
  if (status.statusCode !== "PUBLISHED") return { kind: "error", message: "Publicarea s-a întrerupt, iar containerul nu mai e bun. Se reîncearcă, cu un container nou.", code: "instagram", permanent: false, patch: NO_CONTAINER };
  // Publicată: căutăm postarea printre ultimele Reels, după momentul cererii.
  const since = (post.igPublicareLa ? Date.parse(post.igPublicareLa) : Date.now()) - 2 * 60_000;
  const reels = await recentReels(igId, token).catch(() => []);
  const ids = reels.map((reel) => reel.id);
  const { data: taken } = ids.length ? await ctx.admin.from("postari").select("media_id").in("media_id", ids) : { data: [] };
  const used = new Set((taken ?? []).map((row) => String(row.media_id)));
  const match = reels.filter((reel) => !used.has(reel.id) && parseIgTime(reel.timestamp) >= since).sort((a, b) => parseIgTime(a.timestamp) - parseIgTime(b.timestamp))[0];
  if (match) return finish(post, token, match.id, null);
  return { kind: "published", patch: { avertisment: "Publicată (containerul e PUBLISHED), dar postarea nu s-a găsit printre ultimele Reels. O găsești în aplicație.", publicata_de: "coada (Instagram, automat)" } };
}

export const instagramHandler: PlatformHandler = {
  platform: "instagram",

  async maintain(ctx): Promise<MaintainOutcome> {
    const result = await readAccount("instagram");
    if (!result.ok || !result.data || result.data.stare === "expirat") return { notes: [] };
    const acc = result.data;
    if (!acc.token) {
      const message = keyProblem() ?? "Tokenul Instagram nu se poate decripta (POSTARI_TOKEN_KEY s-a schimbat). Conectează contul din nou, în Setări → Conturi.";
      await markAccount("instagram", "eroare", message);
      return { notes: [message], stopQueue: { message, code: "token_ilizibil" } };
    }
    const now = Date.now();
    const expires = acc.tokenExpiraLa ? Date.parse(acc.tokenExpiraLa) : null;
    if (expires !== null && expires <= now) {
      const message = `Tokenul Instagram a expirat (${momentLabel(acc.tokenExpiraLa as string)}) și nu se mai poate reînnoi. Coada s-a oprit: generează un token nou în panoul Meta și lipește-l în Postări → Setări → Conturi.`;
      await markAccount("instagram", "expirat", message);
      return { notes: [message], stopQueue: { message, code: "token_expirat" } };
    }
    const last = Date.parse(acc.reinnoitLa ?? acc.conectatLa);
    const due = now - last >= REFRESH_EVERY_MS || (expires !== null && expires - now < REFRESH_WHEN_LEFT_MS);
    // Documentația: tokenul se poate reînnoi doar după ce are cel puțin 24 de ore.
    if (!due || now - last < DAY) return { notes: [] };
    try {
      const fresh = await refreshToken(acc.token);
      const until = new Date(now + (fresh.expiresIn ?? DASHBOARD_TOKEN_MS / 1000) * 1000).toISOString();
      const saved = await saveRefreshed("instagram", { token: fresh.token, tokenExpiraLa: until });
      if (!saved.ok) return { notes: [`Instagram: tokenul reînnoit n-a putut fi salvat (${saved.message}).`] };
      await logEvent({ actor: CRON_ACTOR, zona: "conturi", actiune: "token reînnoit", tinta: "instagram", rezultat: "ok", mesaj: `Instagram: tokenul e valabil până ${momentLabel(until)}.` });
      return { notes: ["Instagram: token reînnoit."] };
    } catch (error) {
      const v = verdict(error);
      if (v.kind === "token") {
        const message = "Tokenul Instagram nu se mai poate reînnoi (expirat sau revocat). Coada s-a oprit: generează un token nou în panoul Meta și lipește-l în Postări → Setări → Conturi.";
        await markAccount("instagram", "expirat", message);
        await logEvent({ actor: CRON_ACTOR, zona: "conturi", actiune: "token nereînnoit", tinta: "instagram", rezultat: "eroare", mesaj: message });
        return { notes: [message], stopQueue: { message, code: "token_expirat" } };
      }
      await logEvent({ actor: CRON_ACTOR, zona: "conturi", actiune: "token nereînnoit", tinta: "instagram", rezultat: "eroare", mesaj: `Instagram: ${v.message} Se reîncearcă la rularea următoare.` });
      if (expires !== null && expires - now < 7 * DAY) {
        await raiseAlert({ cheie: "cont_expira:instagram", tip: "cont_expira", subiect: "tokenul Instagram expiră curând", mesaj: `Tokenul Instagram expiră ${momentLabel(acc.tokenExpiraLa as string)} și reînnoirea automată nu merge acum (${v.message}).\n\nDacă nu se rezolvă singur până atunci, generează un token nou în panoul Meta și lipește-l în Postări → Setări → Conturi.` }, ctx.settings.emailAlerte);
      }
      return { notes: [`Instagram: reînnoirea tokenului n-a mers (${v.message}).`] };
    }
  },

  async step(post, ctx) {
    const acc = await account();
    if (!acc.ok) return acc.outcome;
    if (post.igPublicareLa && !post.mediaId) return recoverStep(post, ctx, acc.igId, acc.token);
    if (!copied(post)) return copyStep(post, ctx);
    if (!post.igContainerId) return containerStep(post, ctx, acc.igId, acc.token);
    return statusStep(post, ctx, acc.igId, acc.token);
  },

  async cleanup(post) {
    if (!post.stocareCale) return null;
    const removed = await removeTemp(post.stocareCale);
    return removed ? { stocare_cale: null, stocare_tus_url: null, stocare_octeti: null } : null;
  },
};
