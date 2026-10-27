import { createHash } from "node:crypto";
import { cachedProbes, probeClip, type ClipProbe } from "./clipuri";
import { clipView, type ClipView } from "./clip-view";
import { db, failure, NO_DB } from "./db";
import { isVideo, listFolder, resolveFolder, sameName, type ClipFile, type FolderRef } from "./drive";
import { IG_LIMITS, PLATFORMA_LABEL, TT_LIMITS, type Issue, type Platforma } from "./limite";
import { buildCaption, captionStats, normalizeHashtag, parsePlanText, readOra, validatePlan, type PlanInput, type SchemaIssue } from "./plan-schema";
import { readSettings, type Setari } from "./setari";
import { addDays, momentLabel, todayIn, zonedToUtc } from "./timp";

/**
 * Verificarea unui plan, înainte de orice: fișierele există în subfolder, sunt
 * 9:16 și intră în limitele platformelor (citite din fișier), orele sunt în
 * viitor și nu se suprapun (nici cu ce e deja în coadă), plafoanele pe 24 de
 * ore sunt respectate, descrierile intră în limite. Postările fără oră iau
 * următorul slot liber, în ordinea din listă.
 *
 * Citirea clipurilor necitite are un buget de timp: o verificare care n-a
 * apucat să le citească pe toate întoarce `pending`, iar editorul o cere din
 * nou până la zero. Aprobarea cere zero.
 */

/** O oră trebuie să fie la cel puțin atât în viitor (coada rulează la 5 minute). */
export const MIN_LEAD_MS = 10 * 60_000;
const DAY_MS = 24 * 60 * 60_000;
const SLOT_SEARCH_DAYS = 400;

export interface PreviewPost {
  index: number;
  fisier: string;
  fileId: string | null;
  clip: ClipView | null;
  platforme: Platforma[];
  /** ISO, UTC. */
  ora: string | null;
  oraLabel: string | null;
  sursaOra: "fixa" | "slot" | null;
  descriere: string;
  hashtaguri: string[];
  caption: string;
  stats: { chars: number; hashtags: number; mentions: number };
  instagram: { tip: "reel" | "trial_reel"; absolvire: "manual" | "automat" | null; inFeed: boolean; copertaMs: number | null } | null;
  tiktok: { mod: "ciorna" } | null;
  issues: Issue[];
}

export interface PlanIssue extends Issue {
  path?: string;
}

export interface VerifiedPlan {
  ok: true;
  /** Fără erori și cu toate clipurile citite: se poate aproba. */
  ready: boolean;
  pending: number;
  clipsTotal: number;
  folder: FolderRef | null;
  nume: string | null;
  fus: string;
  posts: PreviewPost[];
  issues: PlanIssue[];
  summary: { posts: number; instagram: number; tiktok: number; first: string | null; last: string | null; errors: number; warnings: number };
  fingerprint: string;
}

export type VerifyResult = VerifiedPlan | { ok: false; message: string; line: number | null; column: number | null; schema: SchemaIssue[] };

interface QueueEvent {
  platform: Platforma;
  time: number;
  /** null = postare din planul verificat. */
  label: string | null;
  post: number | null;
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value as Record<string, unknown>)
        .sort()
        .map((key) => [key, sortKeys((value as Record<string, unknown>)[key])])
    );
  }
  return value;
}

export function planFingerprint(plan: PlanInput): string {
  return createHash("sha256").update(JSON.stringify(sortKeys(plan))).digest("hex");
}

/** Ce e deja în coadă (sau a plecat în ultimele 24 de ore), pe platforme. */
async function queueEvents(): Promise<{ ok: true; events: QueueEvent[]; byClip: Map<string, string> } | { ok: false; message: string }> {
  const admin = db();
  if (!admin) return { ok: false, message: NO_DB };
  const since = new Date(Date.now() - DAY_MS).toISOString();
  const { data, error } = await admin
    .from("postari")
    .select("id, platforma, drive_file_id, fisier, stare, programata_la, publicata_la, trimisa_la")
    .or(`stare.in.(planificata,in_lucru),and(stare.in.(publicata,in_ciorne),programata_la.gte.${since})`)
    .limit(5000);
  if (error) return failure(error, "25 (00000000000025_postari_planuri.sql)");
  const events: QueueEvent[] = [];
  const byClip = new Map<string, string>();
  for (const row of data ?? []) {
    const platform = row.platforma as Platforma;
    const at = String(row.trimisa_la ?? row.publicata_la ?? row.programata_la);
    events.push({ platform, time: new Date(at).getTime(), label: `„${row.fisier}” (${momentLabel(at)})`, post: null });
    const state = row.stare === "publicata" ? "publicat" : row.stare === "in_ciorne" ? "trimis în ciorne" : "deja în coadă";
    byClip.set(`${row.drive_file_id}|${platform}`, `${state}, ${momentLabel(at)}`);
  }
  // Clipurile publicate mai demult (peste 24 de ore) contează doar pentru avertismentul de dublură.
  const { data: older } = await admin.from("postari").select("drive_file_id, platforma, stare, publicata_la, trimisa_la").in("stare", ["publicata", "in_ciorne"]).lt("programata_la", since).limit(5000);
  for (const row of older ?? []) {
    const key = `${row.drive_file_id}|${row.platforma}`;
    if (!byClip.has(key)) byClip.set(key, `${row.stare === "publicata" ? "publicat" : "trimis în ciorne"}, ${momentLabel(String(row.publicata_la ?? row.trimisa_la))}`);
  }
  return { ok: true, events, byClip };
}

function conflicts(events: QueueEvent[], platform: Platforma, time: number, gapMs: number, ignore?: QueueEvent): QueueEvent | null {
  for (const event of events) {
    if (event === ignore || event.platform !== platform) continue;
    const distance = Math.abs(event.time - time);
    if (gapMs === 0 ? distance < 60_000 : distance < gapMs) return event;
  }
  return null;
}

/** Cel mai mare număr de evenimente pe platformă într-o fereastră de 24 de ore care conține `time`. */
function windowPeak(events: QueueEvent[], platform: Platforma, time: number): number {
  const times = events.filter((event) => event.platform === platform).map((event) => event.time);
  times.push(time);
  times.sort((a, b) => a - b);
  let peak = 0;
  for (const start of times) {
    if (start > time || start + DAY_MS <= time) continue;
    const count = times.filter((t) => t >= start && t < start + DAY_MS).length;
    peak = Math.max(peak, count);
  }
  return peak;
}

function findFile(clips: ClipFile[], name: string): ClipFile | null {
  return clips.find((clip) => clip.name === name) ?? clips.find((clip) => sameName(clip.name, name)) ?? null;
}

function suggestions(clips: ClipFile[], name: string): string {
  const stem = name.toLowerCase().replace(/\.(mp4|mov)$/, "");
  const close = clips.filter((clip) => {
    const other = clip.name.toLowerCase();
    return other.startsWith(stem.slice(0, 6)) || stem.startsWith(other.slice(0, 6));
  });
  return close.length ? ` Poate: ${close.slice(0, 3).map((clip) => `„${clip.name}”`).join(", ")}.` : "";
}

export async function verifyPlan(text: string, options: { probeBudgetMs: number; now?: Date }): Promise<VerifyResult> {
  const started = Date.now();
  const now = options.now ?? new Date();
  const parsed = parsePlanText(text);
  if (!parsed.ok) return { ok: false, message: parsed.message, line: parsed.line, column: parsed.column, schema: [] };
  const valid = validatePlan(parsed.value);
  if (!valid.ok) return { ok: false, message: "Planul are câmpuri lipsă sau greșite.", line: null, column: null, schema: valid.issues };
  const plan = valid.plan;

  const settingsResult = await readSettings();
  if (!settingsResult.ok) return { ok: false, message: settingsResult.message, line: null, column: null, schema: [] };
  const settings: Setari = settingsResult.data;
  const fus = plan.sloturi?.fus ?? plan.fus ?? settings.sloturiFus;
  const issues: PlanIssue[] = [];

  // --- Folderul și fișierele -------------------------------------------------
  const folder = await resolveFolder(plan.folder);
  let clips: ClipFile[] = [];
  if (!folder.ok) issues.push({ nivel: "eroare", mesaj: folder.message, path: "folder" });
  else {
    const listing = await listFolder(folder.data);
    if (!listing.ok) issues.push({ nivel: "eroare", mesaj: listing.message, path: "folder" });
    else clips = listing.data.clips;
  }

  const files = plan.postari.map((post) => (folder.ok ? findFile(clips, post.fisier) : null));
  const needed = [...new Map(files.filter((file): file is ClipFile => Boolean(file)).map((file) => [file.id, file])).values()];
  const known = await cachedProbes(needed.map((file) => ({ id: file.id, size: file.size })));
  const probes = known.ok ? known.data : new Map<string, ClipProbe>();
  if (!known.ok) issues.push({ nivel: "eroare", mesaj: known.message });
  let pending = 0;
  for (const file of needed) {
    if (probes.has(file.id)) continue;
    if (Date.now() - started >= options.probeBudgetMs) {
      pending += 1;
      continue;
    }
    const probe = await probeClip(file, folder.ok ? folder.data.id : null);
    if (probe.ok) probes.set(file.id, probe.data);
    else {
      pending += 1;
      issues.push({ nivel: "eroare", mesaj: `„${file.name}” nu s-a putut citi: ${probe.message}` });
    }
  }

  // --- Coada existentă ----------------------------------------------------------
  const queue = await queueEvents();
  if (!queue.ok) issues.push({ nivel: "eroare", mesaj: queue.message });
  const events: QueueEvent[] = queue.ok ? [...queue.events] : [];
  const gapMs = settings.distantaMinimaMin * 60_000;
  const caps: Record<Platforma, number> = { instagram: settings.plafonInstagram, tiktok: settings.plafonTiktok };

  // --- Postările ----------------------------------------------------------------
  const posts: PreviewPost[] = plan.postari.map((post, index) => {
    const file = files[index];
    const probe = file ? (probes.get(file.id) ?? null) : null;
    const hashtaguri = post.hashtaguri;
    const caption = buildCaption(post.descriere, hashtaguri);
    const ig = post.platforme.includes("instagram") ? (post.instagram ?? { tip: "reel" as const }) : null;
    return {
      index,
      fisier: post.fisier,
      fileId: file?.id ?? null,
      clip: file ? clipView(file, probe, settings.stocareLimitaMb) : null,
      platforme: post.platforme,
      ora: null,
      oraLabel: null,
      sursaOra: null,
      descriere: post.descriere,
      hashtaguri,
      caption,
      stats: captionStats(caption),
      instagram: ig ? { tip: ig.tip, absolvire: ig.tip === "trial_reel" ? (ig.absolvire ?? "manual") : null, inFeed: ig.tip === "reel" ? (ig.in_feed ?? true) : false, copertaMs: ig.coperta_ms ?? null } : null,
      tiktok: post.platforme.includes("tiktok") ? { mod: "ciorna" } : null,
      issues: [],
    };
  });

  for (const post of posts) {
    const input = plan.postari[post.index];
    const add = (nivel: Issue["nivel"], mesaj: string) => post.issues.push({ nivel, mesaj });
    if (!folder.ok) continue;
    const file = files[post.index];
    if (!file) {
      add("eroare", `„${input.fisier}” nu e în „${folder.data.path}”.${suggestions(clips, input.fisier)}`);
      continue;
    }
    if (!isVideo(file)) add("eroare", "Fișierul nu e un clip MP4 sau MOV.");
    if (file.name !== input.fisier) add("atentie", `Pe Drive se numește „${file.name}”.`);
    if (!post.clip?.probed) continue;
    post.issues.push(...post.clip.common);
    if (post.platforme.includes("instagram")) post.issues.push(...post.clip.instagram);
    if (post.platforme.includes("tiktok")) post.issues.push(...post.clip.tiktok);
  }

  // Dubluri: același clip de două ori pe aceeași platformă, în plan sau în coadă.
  const seen = new Map<string, number>();
  for (const post of posts) {
    if (!post.fileId) continue;
    for (const platform of post.platforme) {
      const key = `${post.fileId}|${platform}`;
      const earlier = seen.get(key);
      if (earlier !== undefined) post.issues.push({ nivel: "atentie", mesaj: `Același clip e și la postarea ${earlier + 1}, tot pe ${PLATFORMA_LABEL[platform]}.` });
      else seen.set(key, post.index);
      const before = queue.ok ? queue.byClip.get(key) : undefined;
      if (before) post.issues.push({ nivel: "atentie", mesaj: `Clipul e ${before} pe ${PLATFORMA_LABEL[platform]}.` });
    }
  }

  // Descrierile și opțiunile.
  for (const post of posts) {
    const input = plan.postari[post.index];
    const bad = input.hashtaguri.filter((tag) => normalizeHashtag(tag) === null);
    if (bad.length) post.issues.push({ nivel: "eroare", mesaj: `Hashtag-uri cu spații sau semne: ${bad.map((tag) => `„${tag}”`).join(", ")}. Un hashtag are doar litere, cifre și „_”.` });
    if (post.platforme.includes("instagram")) {
      if (post.stats.chars > IG_LIMITS.captionChars) post.issues.push({ nivel: "eroare", mesaj: `Descrierea are ${post.stats.chars} de caractere; Instagram primește cel mult 2200.` });
      if (post.stats.hashtags > IG_LIMITS.hashtags) post.issues.push({ nivel: "eroare", mesaj: `Descrierea are ${post.stats.hashtags} de hashtag-uri; Instagram primește cel mult 30.` });
      if (post.stats.mentions > IG_LIMITS.mentions) post.issues.push({ nivel: "eroare", mesaj: `Descrierea are ${post.stats.mentions} de @; Instagram primește cel mult 20.` });
      if (input.instagram?.tip === "trial_reel" && input.instagram.in_feed !== undefined) post.issues.push({ nivel: "atentie", mesaj: "„in_feed” nu contează la un trial reel (se arată întâi doar celor care nu te urmăresc); e ignorat." });
      if (input.instagram?.tip !== "trial_reel" && input.instagram?.absolvire) post.issues.push({ nivel: "atentie", mesaj: "„absolvire” contează doar la „trial_reel”; e ignorată." });
      if (input.instagram?.coperta_ms !== undefined && post.clip?.durationMs && input.instagram.coperta_ms > post.clip.durationMs) post.issues.push({ nivel: "eroare", mesaj: "„coperta_ms” e după sfârșitul clipului." });
    } else if (input.instagram) post.issues.push({ nivel: "atentie", mesaj: "Are opțiuni „instagram”, dar Instagram nu e în „platforme”; sunt ignorate." });
    if (post.platforme.includes("tiktok") && post.stats.chars > TT_LIMITS.captionChars) post.issues.push({ nivel: "eroare", mesaj: `Descrierea are ${post.stats.chars} de caractere; TikTok primește cel mult 2200.` });
    if (!post.platforme.includes("tiktok") && input.tiktok) post.issues.push({ nivel: "atentie", mesaj: "Are opțiuni „tiktok”, dar TikTok nu e în „platforme”; sunt ignorate." });
    if (!post.descriere.trim()) post.issues.push({ nivel: "atentie", mesaj: "Fără descriere." });
  }

  // --- Orele fixe ---------------------------------------------------------------
  const earliest = now.getTime() + MIN_LEAD_MS;
  for (const post of posts) {
    const raw = plan.postari[post.index].ora;
    if (!raw) continue;
    const read = readOra(raw);
    if (!read) {
      post.issues.push({ nivel: "eroare", mesaj: `Ora „${raw}” nu există în calendar.` });
      continue;
    }
    const time = read.kind === "local" ? zonedToUtc(read.day, read.time, fus).getTime() : read.date.getTime();
    post.ora = new Date(time).toISOString();
    post.oraLabel = momentLabel(post.ora, fus, true);
    post.sursaOra = "fixa";
    if (time < earliest) post.issues.push({ nivel: "eroare", mesaj: time < now.getTime() ? `Ora ${post.oraLabel} a trecut.` : `Ora ${post.oraLabel} e prea aproape: coada rulează la 5 minute, deci pune cel puțin 10 minute de acum.` });
    for (const platform of post.platforme) {
      const clash = conflicts(events, platform, time, gapMs);
      if (clash) {
        post.issues.push({ nivel: "eroare", mesaj: clash.label ? `Se suprapune pe ${PLATFORMA_LABEL[platform]} cu ${clash.label} din coadă (distanța minimă e ${settings.distantaMinimaMin} min).` : `Se suprapune pe ${PLATFORMA_LABEL[platform]} cu postarea ${(clash.post ?? 0) + 1} din plan (distanța minimă e ${settings.distantaMinimaMin} min).` });
      }
    }
    for (const platform of post.platforme) events.push({ platform, time, label: null, post: post.index });
  }

  // --- Sloturile: postările fără oră, în ordinea din listă ------------------------
  const ore = [...(plan.sloturi?.ore ?? settings.sloturiOre)].sort();
  const startDay = plan.sloturi?.start ?? addDays(todayIn(fus, now), 1);
  let cursor = { day: startDay, slot: 0 };
  for (const post of posts) {
    if (plan.postari[post.index].ora) continue;
    let placed = false;
    for (let guard = 0; guard < SLOT_SEARCH_DAYS * ore.length && !placed; guard += 1) {
      const time = zonedToUtc(cursor.day, ore[cursor.slot], fus).getTime();
      const next = cursor.slot + 1 < ore.length ? { day: cursor.day, slot: cursor.slot + 1 } : { day: addDays(cursor.day, 1), slot: 0 };
      if (time >= earliest && post.platforme.every((platform) => !conflicts(events, platform, time, gapMs) && windowPeak(events, platform, time) <= caps[platform])) {
        post.ora = new Date(time).toISOString();
        post.oraLabel = momentLabel(post.ora, fus, true);
        post.sursaOra = "slot";
        for (const platform of post.platforme) events.push({ platform, time, label: null, post: post.index });
        placed = true;
      }
      cursor = next;
    }
    if (!placed) post.issues.push({ nivel: "eroare", mesaj: `N-am găsit un slot liber în următoarele ${SLOT_SEARCH_DAYS} de zile.` });
  }

  // --- Plafoanele pe 24 de ore (orele fixe; sloturile le respectă deja) ----------
  for (const post of posts) {
    if (post.sursaOra !== "fixa" || !post.ora) continue;
    const time = new Date(post.ora).getTime();
    for (const platform of post.platforme) {
      const others = events.filter((event) => !(event.post === post.index && event.platform === platform));
      const peak = windowPeak(others, platform, time);
      if (peak > caps[platform]) {
        post.issues.push({
          nivel: "eroare",
          mesaj:
            platform === "instagram"
              ? `Cu ea, pe Instagram ar pleca ${peak} postări în 24 de ore; plafonul e ${caps.instagram} (Setări).`
              : `Cu ea, pe TikTok ar ajunge ${peak} ciorne în 24 de ore; TikTok primește cel mult ${caps.tiktok} nepublicate.`,
        });
      }
    }
  }

  const all = posts.flatMap((post) => post.issues).concat(issues);
  const errors = all.filter((issue) => issue.nivel === "eroare").length;
  const warnings = all.length - errors;
  const times = posts.map((post) => post.ora).filter((value): value is string => Boolean(value)).sort();
  return {
    ok: true,
    ready: errors === 0 && pending === 0 && folder.ok,
    pending,
    clipsTotal: needed.length,
    folder: folder.ok ? folder.data : null,
    nume: plan.nume ?? null,
    fus,
    posts,
    issues,
    summary: {
      posts: posts.length,
      instagram: posts.filter((post) => post.platforme.includes("instagram")).length,
      tiktok: posts.filter((post) => post.platforme.includes("tiktok")).length,
      first: times[0] ?? null,
      last: times[times.length - 1] ?? null,
      errors,
      warnings,
    },
    fingerprint: planFingerprint(plan),
  };
}
