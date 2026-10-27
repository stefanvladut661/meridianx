import { db, failure, NO_DB, type Result } from "./db";
import { logEvent } from "./istoric";
import { parsePlanText, validatePlan } from "./plan-schema";
import { verifyPlan, type VerifiedPlan } from "./plan-verify";

/**
 * Aprobarea unui plan: singurul drum prin care ceva intră în coadă. Planul se
 * verifică din nou, pe server, chiar înainte de scriere (fără citiri noi de
 * clipuri: toate trebuie să fie deja citite). Amprenta planului e unică, deci
 * un dublu-clic sau același plan lipit a doua oară nu dublează postările.
 *
 * `expected` sunt orele din previzualizarea pe care a văzut-o omul. Dacă
 * verificarea de acum dă alte ore (coada s-a schimbat între timp, sau un slot
 * a ajuns prea aproape), planul nu se aprobă: se aprobă doar ce s-a văzut.
 */

const MIGRATION = "25 (00000000000025_postari_planuri.sql)";

export type ApproveResult = { ok: true; planId: string; rows: number; verified: VerifiedPlan } | { ok: false; message: string; verified?: VerifiedPlan };

export async function approvePlan(text: string, actor: string, expected: (string | null)[]): Promise<ApproveResult> {
  const admin = db();
  if (!admin) return { ok: false, message: NO_DB };
  const verified = await verifyPlan(text, { probeBudgetMs: 0 });
  if (!verified.ok) return { ok: false, message: verified.schema[0]?.message ?? verified.message };
  if (verified.pending > 0) return { ok: false, message: `Mai sunt ${verified.pending} clipuri de citit. Apasă „Verifică planul” și așteaptă să se termine.`, verified };
  if (!verified.ready || !verified.folder) return { ok: false, message: `Planul are ${verified.summary.errors} ${verified.summary.errors === 1 ? "eroare" : "erori"}. Corectează-le și verifică din nou.`, verified };
  const moved = verified.posts.filter((post, index) => post.ora !== (expected[index] ?? null));
  if (expected.length !== verified.posts.length || moved.length > 0) {
    return { ok: false, message: `De la verificare s-au schimbat orele la ${moved.length || verified.posts.length} ${moved.length === 1 ? "postare" : "postări"} (coada s-a schimbat sau a trecut timpul). Nu s-a aprobat nimic: verifică din nou și uită-te la ore.`, verified };
  }

  const parsed = parsePlanText(text);
  const valid = parsed.ok ? validatePlan(parsed.value) : null;
  if (!valid?.ok) return { ok: false, message: "Planul nu se mai poate citi." };
  const plan = valid.plan;

  const stored = {
    ...plan,
    fus: verified.fus,
    postari: plan.postari.map((post, index) => ({ ...post, ora_rezolvata: verified.posts[index].ora, sursa_ora: verified.posts[index].sursaOra })),
  };
  const { data: planRow, error: planError } = await admin
    .from("postari_planuri")
    .insert({ nume: verified.nume, folder_id: verified.folder.id, folder_cale: verified.folder.path.slice(0, 600), plan: stored, amprenta: verified.fingerprint, nr_postari: verified.posts.length, aprobat_de: actor })
    .select("id")
    .single();
  if (planError) {
    if (planError.code === "23505") return { ok: false, message: "Planul ăsta e deja aprobat: postările lui sunt în coadă. Schimbă-l dacă vrei să-l mai programezi o dată.", verified };
    return { ...failure(planError, MIGRATION), verified };
  }
  const planId = String(planRow.id);

  const rows = verified.posts.flatMap((post) =>
    post.platforme.map((platforma) => ({
      plan_id: planId,
      element: post.index,
      platforma,
      drive_file_id: post.fileId,
      fisier: post.clip?.name ?? post.fisier,
      folder_id: verified.folder?.id,
      marime: post.clip?.size ?? null,
      durata_ms: post.clip?.durationMs ?? null,
      descriere: post.descriere,
      hashtaguri: post.hashtaguri,
      caption: post.caption,
      optiuni: platforma === "instagram" && post.instagram ? { tip: post.instagram.tip, absolvire: post.instagram.absolvire, in_feed: post.instagram.inFeed, coperta_ms: post.instagram.copertaMs } : {},
      programata_la: post.ora,
      sursa_ora: post.sursaOra,
      stare: "planificata",
    }))
  );
  // Un singur insert = o singură instrucțiune: intră toate rândurile sau niciunul.
  const { error: rowsError } = await admin.from("postari").insert(rows);
  if (rowsError) {
    await admin.from("postari_planuri").delete().eq("id", planId);
    await logEvent({ actor, zona: "plan", actiune: "plan neaprobat", rezultat: "eroare", mesaj: rowsError.message });
    return { ...failure(rowsError, MIGRATION), verified };
  }
  await logEvent({
    actor,
    zona: "plan",
    actiune: "plan aprobat",
    tinta: planId,
    rezultat: "ok",
    mesaj: `${verified.nume ? `„${verified.nume}”: ` : ""}${verified.posts.length} postări (${verified.summary.instagram} pe Instagram, ${verified.summary.tiktok} pe TikTok), din „${verified.folder.path}”.`,
    detalii: { amprenta: verified.fingerprint, primul: verified.summary.first, ultimul: verified.summary.last },
  });
  return { ok: true, planId, rows: rows.length, verified };
}

export interface PlanRow {
  id: string;
  nume: string | null;
  folderCale: string;
  nrPostari: number;
  aprobatLa: string;
  aprobatDe: string;
}

export async function listPlans(limit = 20): Promise<Result<PlanRow[]>> {
  const admin = db();
  if (!admin) return { ok: false, message: NO_DB };
  const { data, error } = await admin.from("postari_planuri").select("id, nume, folder_cale, nr_postari, aprobat_la, aprobat_de").order("aprobat_la", { ascending: false }).limit(limit);
  if (error) return failure(error, MIGRATION);
  return { ok: true, data: (data ?? []).map((row) => ({ id: String(row.id), nume: (row.nume as string | null) ?? null, folderCale: String(row.folder_cale), nrPostari: Number(row.nr_postari), aprobatLa: String(row.aprobat_la), aprobatDe: String(row.aprobat_de) })) };
}
