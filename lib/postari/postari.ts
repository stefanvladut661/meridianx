import { db, failure, NO_DB, type Result } from "./db";
import type { Platforma } from "./limite";
import type { PostView, Stare } from "./coada-shared";

/**
 * Rândurile din `postari`: citirea pentru ecrane și acțiunile omului
 * („Scoate din coadă”, „Reîncearcă”). Publicarea și trimiterea le face coada
 * (`lib/postari/coada.ts`). Rândurile publicate nu se șterg și nu se
 * modifică de aici: o postare publicată nu se mai poate scoate și nici
 * reîncerca.
 */

const MIGRATION = "25–26 (postari_planuri, postari_coada)";

/** Rândul întreg, cum îl folosește coada. */
export interface PostRow {
  id: string;
  planId: string;
  element: number;
  platforma: Platforma;
  driveFileId: string;
  fisier: string;
  folderId: string;
  marime: number | null;
  durataMs: number | null;
  descriere: string;
  hashtaguri: string[];
  caption: string;
  optiuni: Record<string, unknown>;
  programataLa: string;
  sursaOra: "fixa" | "slot";
  stare: Stare;
  pas: string | null;
  incercari: number;
  urmatoareaIncercare: string | null;
  lucrataDe: string | null;
  termenLucru: string | null;
  eroare: string | null;
  eroareCod: string | null;
  stocareCale: string | null;
  stocareTusUrl: string | null;
  stocareOcteti: number | null;
  igContainerId: string | null;
  igContainerLa: string | null;
  igPublicareLa: string | null;
  ttPublishId: string | null;
  ttUploadUrl: string | null;
  ttUploadLa: string | null;
  ttChunkSize: number | null;
  ttChunksTotal: number | null;
  ttChunksTrimise: number | null;
  ttStatus: string | null;
  mediaId: string | null;
  link: string | null;
  avertisment: string | null;
  trimisaLa: string | null;
  publicataLa: string | null;
  verificarePanaLa: string | null;
  reluataLa: string | null;
}

const str = (value: unknown): string | null => (typeof value === "string" ? value : null);
const num = (value: unknown): number | null => (value === null || value === undefined ? null : Number(value));

export function toPostRow(row: Record<string, unknown>): PostRow {
  return {
    id: String(row.id),
    planId: String(row.plan_id),
    element: Number(row.element),
    platforma: row.platforma as Platforma,
    driveFileId: String(row.drive_file_id),
    fisier: String(row.fisier),
    folderId: String(row.folder_id),
    marime: num(row.marime),
    durataMs: num(row.durata_ms),
    descriere: String(row.descriere ?? ""),
    hashtaguri: Array.isArray(row.hashtaguri) ? (row.hashtaguri as string[]) : [],
    caption: String(row.caption ?? ""),
    optiuni: (row.optiuni as Record<string, unknown> | null) ?? {},
    programataLa: String(row.programata_la),
    sursaOra: row.sursa_ora === "slot" ? "slot" : "fixa",
    stare: row.stare as Stare,
    pas: str(row.pas),
    incercari: Number(row.incercari ?? 0),
    urmatoareaIncercare: str(row.urmatoarea_incercare),
    lucrataDe: str(row.lucrata_de),
    termenLucru: str(row.termen_lucru),
    eroare: str(row.eroare),
    eroareCod: str(row.eroare_cod),
    stocareCale: str(row.stocare_cale),
    stocareTusUrl: str(row.stocare_tus_url),
    stocareOcteti: num(row.stocare_octeti),
    igContainerId: str(row.ig_container_id),
    igContainerLa: str(row.ig_container_la),
    igPublicareLa: str(row.ig_publicare_la),
    ttPublishId: str(row.tt_publish_id),
    ttUploadUrl: str(row.tt_upload_url),
    ttUploadLa: str(row.tt_upload_la),
    ttChunkSize: num(row.tt_chunk_size),
    ttChunksTotal: num(row.tt_chunks_total),
    ttChunksTrimise: num(row.tt_chunks_trimise),
    ttStatus: str(row.tt_status),
    mediaId: str(row.media_id),
    link: str(row.link),
    avertisment: str(row.avertisment),
    trimisaLa: str(row.trimisa_la),
    publicataLa: str(row.publicata_la),
    verificarePanaLa: str(row.verificare_pana_la),
    reluataLa: str(row.reluata_la),
  };
}

/**
 * Se mai poate scoate din coadă? Planificată sau eșuată, da. În lucru, doar
 * dacă nicio rulare nu lucrează acum la ea și n-a trecut de pasul fără
 * întoarcere: cererea de publicare la Instagram, ultima bucată urcată la TikTok.
 */
export function canRemove(row: Pick<PostRow, "stare" | "platforma" | "termenLucru" | "igPublicareLa" | "ttChunksTotal" | "ttChunksTrimise">, now = Date.now()): boolean {
  if (row.stare === "planificata" || row.stare === "esuata") return true;
  if (row.stare !== "in_lucru") return false;
  if (row.termenLucru && new Date(row.termenLucru).getTime() > now) return false;
  if (row.platforma === "instagram") return !row.igPublicareLa;
  return !(row.ttChunksTotal !== null && row.ttChunksTrimise !== null && row.ttChunksTrimise >= row.ttChunksTotal);
}

function toView(row: Record<string, unknown>, planNames: Map<string, string | null>, now: number): PostView {
  const post = toPostRow(row);
  return {
    id: post.id,
    planId: post.planId,
    planNume: planNames.get(post.planId) ?? null,
    element: post.element,
    platforma: post.platforma,
    fisier: post.fisier,
    driveFileId: post.driveFileId,
    descriere: post.descriere,
    hashtaguri: post.hashtaguri,
    caption: post.caption,
    optiuni: post.optiuni as PostView["optiuni"],
    durataMs: post.durataMs,
    programataLa: post.programataLa,
    sursaOra: post.sursaOra,
    stare: post.stare,
    pas: post.pas,
    incercari: post.incercari,
    urmatoareaIncercare: post.urmatoareaIncercare,
    ocupata: Boolean(post.termenLucru && new Date(post.termenLucru).getTime() > now),
    eroare: post.eroare,
    eroareCod: post.eroareCod,
    link: post.link,
    avertisment: post.avertisment,
    trimisaLa: post.trimisaLa,
    publicataLa: post.publicataLa,
    publicataDe: str(row.publicata_de),
    scoasaLa: str(row.scoasa_la),
    reluataLa: post.reluataLa,
    sePoateScoate: canRemove(post, now),
  };
}

const VIEW_COLUMNS =
  "id, plan_id, element, platforma, drive_file_id, fisier, folder_id, marime, durata_ms, descriere, hashtaguri, caption, optiuni, programata_la, sursa_ora, stare, pas, incercari, urmatoarea_incercare, lucrata_de, termen_lucru, eroare, eroare_cod, ig_publicare_la, tt_chunks_total, tt_chunks_trimise, link, avertisment, trimisa_la, publicata_la, publicata_de, scoasa_la, reluata_la";

/** Postările dintr-un interval (după ora din plan), plus toate cele încă active sau eșuate, oricând ar fi. */
export async function listPosts(range: { from: string; to: string }): Promise<Result<PostView[]>> {
  const admin = db();
  if (!admin) return { ok: false, message: NO_DB };
  const { data, error } = await admin
    .from("postari")
    .select(VIEW_COLUMNS)
    .or(`and(programata_la.gte.${range.from},programata_la.lt.${range.to}),stare.in.(in_lucru,in_ciorne,esuata)`)
    .order("programata_la", { ascending: true })
    .order("element", { ascending: true })
    .limit(2000);
  if (error) return failure(error, MIGRATION);
  const planIds = [...new Set((data ?? []).map((row) => String(row.plan_id)))];
  const planNames = new Map<string, string | null>();
  if (planIds.length) {
    const { data: plans } = await admin.from("postari_planuri").select("id, nume").in("id", planIds);
    for (const plan of plans ?? []) planNames.set(String(plan.id), (plan.nume as string | null) ?? null);
  }
  const now = Date.now();
  return { ok: true, data: (data ?? []).map((row) => toView(row as Record<string, unknown>, planNames, now)) };
}

export async function readPost(id: string): Promise<Result<PostRow | null>> {
  const admin = db();
  if (!admin) return { ok: false, message: NO_DB };
  const { data, error } = await admin.from("postari").select("*").eq("id", id).maybeSingle();
  if (error) return failure(error, MIGRATION);
  return { ok: true, data: data ? toPostRow(data as Record<string, unknown>) : null };
}

/**
 * „Scoate din coadă”. Scrierea se face doar dacă rândul e încă în starea în
 * care l-a văzut verificarea (și nicio rulare nu l-a luat între timp).
 */
export async function removePost(id: string, actor: string): Promise<Result<PostRow>> {
  const admin = db();
  if (!admin) return { ok: false, message: NO_DB };
  const current = await readPost(id);
  if (!current.ok) return current;
  const post = current.data;
  if (!post) return { ok: false, message: "Postarea nu mai există. Reîncarcă pagina." };
  if (post.stare === "publicata" || post.stare === "in_ciorne") return { ok: false, message: "Postarea a plecat deja. Pe cele plecate le gestionezi din aplicație." };
  if (post.stare === "scoasa") return { ok: true, data: post };
  if (!canRemove(post)) return { ok: false, message: "Coada lucrează acum la postarea asta sau a trecut de pasul după care nu se mai poate opri. Așteaptă rezultatul." };
  const now = new Date().toISOString();
  let query = admin
    .from("postari")
    .update({ stare: "scoasa", scoasa_la: now, scoasa_de: actor, urmatoarea_incercare: null, lucrata_de: null, termen_lucru: null, updated_at: now })
    .eq("id", id)
    .eq("stare", post.stare)
    .or(`termen_lucru.is.null,termen_lucru.lt.${now}`);
  if (post.platforma === "instagram") query = query.is("ig_publicare_la", null);
  const { data, error } = await query.select("*");
  if (error) return failure(error, MIGRATION);
  if (!data || data.length === 0) return { ok: false, message: "Postarea tocmai a pornit. Reîncarcă pagina ca să vezi unde e." };
  return { ok: true, data: toPostRow(data[0] as Record<string, unknown>) };
}

/**
 * „Reîncearcă”: o postare eșuată intră din nou în coadă, acum, cu încercările
 * de la zero. Pornește de la pasul la care a rămas (un clip deja copiat nu se
 * mai copiază).
 */
export async function retryPost(id: string, actor: string): Promise<Result<PostRow>> {
  const admin = db();
  if (!admin) return { ok: false, message: NO_DB };
  const current = await readPost(id);
  if (!current.ok) return current;
  const post = current.data;
  if (!post) return { ok: false, message: "Postarea nu mai există. Reîncarcă pagina." };
  if (post.stare !== "esuata") return { ok: false, message: "Se reîncearcă doar o postare eșuată." };
  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("postari")
    .update({ stare: post.pas ? "in_lucru" : "planificata", incercari: 0, urmatoarea_incercare: null, eroare: null, eroare_cod: null, eroare_la: null, reluata_la: now, reluata_de: actor, updated_at: now })
    .eq("id", id)
    .eq("stare", "esuata")
    .select("*");
  if (error) return failure(error, MIGRATION);
  if (!data || data.length === 0) return { ok: false, message: "Postarea s-a schimbat între timp. Reîncarcă pagina." };
  return { ok: true, data: toPostRow(data[0] as Record<string, unknown>) };
}

/** „Publicat” pe o ciornă TikTok: doar starea din admin; postarea din aplicație nu se atinge. */
export async function markPublishedByHand(id: string, actor: string): Promise<Result<PostRow>> {
  const admin = db();
  if (!admin) return { ok: false, message: NO_DB };
  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("postari")
    .update({ stare: "publicata", publicata_la: now, publicata_de: actor, verificare_pana_la: null, urmatoarea_incercare: null, updated_at: now })
    .eq("id", id)
    .eq("platforma", "tiktok")
    .eq("stare", "in_ciorne")
    .select("*");
  if (error) return failure(error, MIGRATION);
  if (!data || data.length === 0) {
    const current = await readPost(id);
    if (current.ok && current.data?.stare === "publicata") return { ok: true, data: current.data };
    return { ok: false, message: "Ciorna nu mai e în listă (poate a fost marcată deja). Reîncarcă pagina." };
  }
  return { ok: true, data: toPostRow(data[0] as Record<string, unknown>) };
}

export interface RunInfo {
  id: string;
  sursa: "cron" | "manual";
  inceputLa: string;
  durataMs: number | null;
  rezultat: Record<string, unknown>;
  eroare: string | null;
}

/** Ultima rulare pornită de Supabase Cron (nu de „Rulează acum”): arată dacă jobul merge. */
export async function lastCronRun(): Promise<string | null> {
  const admin = db();
  if (!admin) return null;
  const { data } = await admin.from("postari_rulari").select("inceput_la").eq("sursa", "cron").order("inceput_la", { ascending: false }).limit(1).maybeSingle();
  return data ? String(data.inceput_la) : null;
}

export async function lastRuns(limit = 5): Promise<Result<RunInfo[]>> {
  const admin = db();
  if (!admin) return { ok: false, message: NO_DB };
  const { data, error } = await admin.from("postari_rulari").select("id, sursa, inceput_la, durata_ms, rezultat, eroare").order("inceput_la", { ascending: false }).limit(limit);
  if (error) return failure(error, "26 (00000000000026_postari_coada.sql)");
  return {
    ok: true,
    data: (data ?? []).map((row) => ({ id: String(row.id), sursa: row.sursa === "manual" ? "manual" : "cron", inceputLa: String(row.inceput_la), durataMs: num(row.durata_ms), rezultat: (row.rezultat as Record<string, unknown>) ?? {}, eroare: str(row.eroare) })),
  };
}
