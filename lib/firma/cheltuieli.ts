import { db, failure, NO_DB, type Result } from "./db";
import { currentMonth, monthStart } from "./format";
import { logEvent } from "./istoric";
import type { Categorie, Cheltuiala, StareCitire } from "./cheltuieli-shared";
import type { ExpenseInput } from "./schemas";
import { readDocument } from "./ocr";
import { createUpload, downloadObject, isAllowedType, isAreaPath, signedLink } from "./storage";
import { driveMode } from "./drive/google";
import { moveToMonth, renameRegistered, saveToDrive } from "./drive";
import { readSettings } from "./setari";

/**
 * Cheltuielile (migrarea 19): urcarea din telefon, citirea automată
 * (furnizor, dată, sumă, categorie), corectura ta și fișierul în folderul
 * lunii de pe Drive. O cheltuială urcată din greșeală se scoate din listă
 * (rândul rămâne în bază, marcat), nu se șterge.
 */

const MIGRATION = "19 (00000000000019_firma_cheltuieli.sql)";
type Row = Record<string, unknown>;
const text = (value: unknown) => (typeof value === "string" && value !== "" ? value : null);

function toCheltuiala(row: Row): Cheltuiala {
  return {
    id: String(row.id),
    luna: String(row.luna),
    furnizor: text(row.furnizor),
    furnizorCui: text(row.furnizor_cui),
    nrDocument: text(row.nr_document),
    dataDoc: text(row.data_doc),
    suma: row.suma === null || row.suma === undefined ? null : Number(row.suma),
    moneda: (row.moneda as Cheltuiala["moneda"]) ?? "RON",
    categoria: (row.categoria as Categorie) ?? "altele",
    descriere: text(row.descriere),
    fisierNume: String(row.fisier_nume),
    fisierTip: String(row.fisier_tip),
    fisierMarime: row.fisier_marime === null || row.fisier_marime === undefined ? null : Number(row.fisier_marime),
    citireStare: (row.citire_stare as StareCitire) ?? "neinceputa",
    citireMesaj: text(row.citire_mesaj),
    confirmata: row.confirmata === true,
    driveLink: text(row.drive_link),
    driveMesaj: text(row.drive_mesaj),
    tranzactieId: text(row.tranzactie_id),
    createdAt: String(row.created_at),
  };
}

export async function listExpenses(month: string): Promise<Result<Cheltuiala[]>> {
  const admin = db();
  if (!admin) return { ok: false, message: NO_DB };
  const { data, error } = await admin.from("firma_cheltuieli").select("*").eq("luna", monthStart(month)).is("scoasa_la", null).order("data_doc", { ascending: false }).limit(2000);
  if (error) return failure(error, MIGRATION);
  return { ok: true, data: ((data ?? []) as Row[]).map(toCheltuiala) };
}

async function rowById(id: string): Promise<Row | null> {
  const admin = db();
  if (!admin) return null;
  const { data } = await admin.from("firma_cheltuieli").select("*").eq("id", id).maybeSingle();
  return (data as Row | null) ?? null;
}

export async function prepareExpenseUpload(type: string, size: number): Promise<Result<{ path: string; uploadUrl: string }>> {
  if (!isAllowedType(type, "cheltuieli")) return { ok: false, message: "Urcă o poză (JPEG, PNG, WebP) sau un PDF." };
  if (size > 20 * 1024 * 1024) return { ok: false, message: "Fișierul are peste 20 MB. Fă o poză mai mică sau un PDF mai scurt." };
  return createUpload("cheltuieli", type);
}

const extensionOf = (name: string) => (/\.([a-z0-9]{2,5})$/i.exec(name)?.[1] ?? "").toLowerCase();

/** Numele de pe Drive, în stilul folderului tău: „Furnizor - descriere 2026-10-26.pdf”. */
function driveName(row: Row): string {
  const supplier = text(row.furnizor) ?? "Cheltuiala";
  const what = text(row.descriere) ?? text(row.nr_document) ?? String(row.categoria ?? "");
  const day = text(row.data_doc) ?? "";
  const ext = extensionOf(String(row.fisier_nume)) || (row.fisier_tip === "application/pdf" ? "pdf" : "jpg");
  return `${[supplier, what].filter(Boolean).join(" - ")} ${day}`.trim().slice(0, 180) + `.${ext}`;
}

/** Fișierul cheltuielii în folderul lunii ei (o singură dată); dacă era în altă lună, îl mută. */
async function syncDrive(row: Row, actor: string): Promise<{ link: string | null; message: string | null }> {
  if (!driveMode()) return { link: null, message: "Drive-ul nu e legat." };
  const settings = await readSettings();
  if (!settings.ok || !settings.data.driveRadacina) return { link: null, message: "Folderul de pe Drive nu e ales în Setări." };
  // Un document fără furnizor și dată (ilizibil, necompletat) așteaptă: pe Drive ar ajunge cu un nume fără sens.
  if (!row.furnizor || !row.data_doc) return { link: null, message: "Se urcă pe Drive după ce completezi furnizorul și data." };
  const month = String(row.luna).slice(0, 7);
  if (row.drive_file_id) {
    const moved = await moveToMonth("cheltuiala", String(row.id), month, actor);
    const renamed = await renameRegistered("cheltuiala", String(row.id), driveName(row));
    const problem = !moved.ok ? moved.message : !renamed.ok ? renamed.message : null;
    return { link: text(row.drive_link), message: problem };
  }
  const bytes = await downloadObject(String(row.fisier_cale));
  if (!bytes) return { link: null, message: "Fișierul nu mai e în stocare." };
  const saved = await saveToDrive({ month, kind: "cheltuiala", sourceId: String(row.id), name: driveName(row), bytes, mimeType: String(row.fisier_tip), actor });
  if (!saved.ok) return { link: null, message: saved.message };
  const admin = db();
  await admin?.from("firma_cheltuieli").update({ drive_file_id: saved.data.fileId, drive_link: saved.data.link, drive_mesaj: null }).eq("id", row.id);
  return { link: saved.data.link, message: null };
}

/** Citirea automată și completarea rândului (fără să atingă ce ai confirmat de mână, decât la cerere). */
async function readInto(id: string, bytes: Buffer, type: string): Promise<{ state: StareCitire; message: string | null }> {
  const admin = db();
  if (!admin) return { state: "eroare", message: NO_DB };
  const result = await readDocument(bytes, type);
  if (!result.ok) {
    await admin.from("firma_cheltuieli").update({ citire_stare: result.skipped ? "sarita" : "eroare", citire_mesaj: result.message }).eq("id", id);
    return { state: result.skipped ? "sarita" : "eroare", message: result.message };
  }
  const found = result.data;
  const patch: Record<string, unknown> = {
    citire_stare: "ok",
    citire_mesaj: null,
    citire: found,
    confirmata: false,
    furnizor: found.furnizor,
    furnizor_cui: found.cui_furnizor ? found.cui_furnizor.replace(/\s/g, "").toUpperCase().slice(0, 20) : null,
    nr_document: found.numar_document?.slice(0, 60) ?? null,
    data_doc: found.data,
    suma: found.suma,
    moneda: found.moneda ?? "RON",
    categoria: found.categorie,
    descriere: found.descriere?.slice(0, 500) ?? null,
  };
  if (found.data) patch.luna = monthStart(found.data.slice(0, 7));
  await admin.from("firma_cheltuieli").update(patch).eq("id", id);
  return { state: "ok", message: null };
}

/** După urcarea din browser: rândul, citirea, Drive-ul. */
export async function finishExpenseUpload(input: { path: string; name: string; type: string }, actor: string): Promise<Result<{ id: string; read: StareCitire; readMessage: string | null; driveMessage: string | null }>> {
  const admin = db();
  if (!admin) return { ok: false, message: NO_DB };
  if (!isAreaPath(input.path, "cheltuieli") || !isAllowedType(input.type, "cheltuieli")) return { ok: false, message: "Fișierul urcat nu e valid." };
  const bytes = await downloadObject(input.path);
  if (!bytes) return { ok: false, message: "Fișierul n-a ajuns în stocare. Urcă-l din nou." };

  const { data, error } = await admin
    .from("firma_cheltuieli")
    .insert({ luna: monthStart(currentMonth()), fisier_cale: input.path, fisier_nume: input.name.slice(0, 300), fisier_tip: input.type, fisier_marime: bytes.length, created_by: actor })
    .select("id")
    .single();
  if (error || !data) return failure(error, MIGRATION);
  const id = String(data.id);

  const read = await readInto(id, bytes, input.type);
  const row = await rowById(id);
  const drive = row ? await syncDrive(row, actor) : { link: null, message: null };
  if (drive.message) await admin.from("firma_cheltuieli").update({ drive_mesaj: drive.message }).eq("id", id);
  await logEvent({
    actor,
    zona: "cheltuieli",
    actiune: "cheltuială urcată",
    tinta: id,
    rezultat: read.state === "eroare" ? "eroare" : "ok",
    mesaj: [row?.furnizor ? String(row.furnizor) : input.name, read.message, drive.message ? `Drive: ${drive.message}` : drive.link ? "pe Drive" : null].filter(Boolean).join(" · "),
  });
  return { ok: true, data: { id, read: read.state, readMessage: read.message, driveMessage: drive.message } };
}

export async function rereadExpense(id: string, actor: string): Promise<Result<{ read: StareCitire; message: string | null }>> {
  const row = await rowById(id);
  if (!row) return { ok: false, message: "Cheltuiala nu mai există." };
  const bytes = await downloadObject(String(row.fisier_cale));
  if (!bytes) return { ok: false, message: "Fișierul nu mai e în stocare." };
  const read = await readInto(id, bytes, String(row.fisier_tip));
  const fresh = await rowById(id);
  if (fresh) await syncDrive(fresh, actor);
  await logEvent({ actor, zona: "cheltuieli", actiune: "cheltuială citită din nou", tinta: id, rezultat: read.state === "eroare" ? "eroare" : "ok", mesaj: read.message });
  return { ok: true, data: { read: read.state, message: read.message } };
}

export async function saveExpense(id: string, input: ExpenseInput, actor: string): Promise<Result<{ driveMessage: string | null }>> {
  const admin = db();
  if (!admin) return { ok: false, message: NO_DB };
  const { error } = await admin
    .from("firma_cheltuieli")
    .update({
      furnizor: input.furnizor,
      furnizor_cui: input.furnizorCui,
      nr_document: input.nrDocument,
      data_doc: input.dataDoc,
      suma: input.suma,
      moneda: input.moneda,
      categoria: input.categoria,
      descriere: input.descriere,
      luna: monthStart(input.dataDoc.slice(0, 7)),
      confirmata: true,
    })
    .eq("id", id);
  if (error) return failure(error, MIGRATION);
  const row = await rowById(id);
  const drive = row ? await syncDrive(row, actor) : { link: null, message: null };
  await admin.from("firma_cheltuieli").update({ drive_mesaj: drive.message }).eq("id", id);
  await logEvent({ actor, zona: "cheltuieli", actiune: "cheltuială confirmată", tinta: id, rezultat: "ok", mesaj: `${input.furnizor} · ${input.suma} ${input.moneda}${drive.message ? ` · Drive: ${drive.message}` : ""}` });
  return { ok: true, data: { driveMessage: drive.message } };
}

export async function hideExpense(id: string, actor: string): Promise<Result<null>> {
  const admin = db();
  if (!admin) return { ok: false, message: NO_DB };
  const { error } = await admin.from("firma_cheltuieli").update({ scoasa_la: new Date().toISOString() }).eq("id", id);
  if (error) return failure(error, MIGRATION);
  await logEvent({ actor, zona: "cheltuieli", actiune: "cheltuială scoasă din listă", tinta: id, rezultat: "ok", mesaj: "rândul rămâne în bază; fișierul de pe Drive nu se atinge" });
  return { ok: true, data: null };
}

export async function expensePreview(id: string): Promise<Result<{ url: string; type: string }>> {
  const row = await rowById(id);
  if (!row) return { ok: false, message: "Cheltuiala nu mai există." };
  const url = await signedLink(String(row.fisier_cale), 3600);
  if (!url) return { ok: false, message: "Fișierul nu se poate deschide acum." };
  return { ok: true, data: { url, type: String(row.fisier_tip) } };
}
