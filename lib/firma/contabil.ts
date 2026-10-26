import { randomUUID } from "node:crypto";
import { db, failure, NO_DB, type Result } from "./db";
import { addDays, monthEnd, monthLabel, monthStart, todayIso } from "./format";
import { logEvent } from "./istoric";
import { readSettings } from "./setari";
import { downloadObject, putObject, signedLink } from "./storage";
import { makeZip, type ZipEntry } from "./zip";
import { driveMode, DriveError, downloadFile, listChildren } from "./drive/google";
import { saveToDrive } from "./drive";
import { EMAIL_MISSING, isEmailReady, sendFirmaEmail } from "./email";

/**
 * Pachetul lunar pentru contabil (migrarea 21): verificarea lunii (ce
 * lipsește), zip-ul cu folderul lunii și extrasul (pe Drive și în stocare) și
 * emailul către contabil, care pleacă doar la „Trimite”.
 */

const MIGRATION = "21 (00000000000021_firma_contabil.sql)";
const ZIP_PREFIX = "pentru contabil - ";
/** Peste atât, zip-ul nu se mai atașează: emailul are doar linkul. */
const ATTACH_LIMIT = 10 * 1024 * 1024;

export type FelLipsa = "factura" | "ciorna" | "cheltuiala" | "plata" | "extras";

export interface Lipsa {
  fel: FelLipsa;
  text: string;
  /** Oprește pachetul (până rezolvi sau alegi „oricum”). */
  blocheaza: boolean;
}

export interface Pachet {
  stare: "incomplet" | "complet" | "zip_gata" | "trimis";
  verificatLa: string | null;
  zipLink: string | null;
  zipMarime: number | null;
  zipFisiere: number | null;
  zipFacutLa: string | null;
  emailCatre: string | null;
  emailSubiect: string | null;
  emailText: string | null;
  emailStare: "nepregatit" | "pregatit" | "trimis" | "esuat";
  emailTrimisLa: string | null;
}

export interface MonthCheck {
  month: string;
  complete: boolean;
  items: Lipsa[];
  counts: { facturi: number; cheltuieli: number; plati: number; extrase: number };
  pachet: Pachet | null;
}

type Row = Record<string, unknown>;
const text = (value: unknown) => (typeof value === "string" && value !== "" ? value : null);

function toPachet(row: Row | null): Pachet | null {
  if (!row) return null;
  return {
    stare: (row.stare as Pachet["stare"]) ?? "incomplet",
    verificatLa: text(row.verificat_la),
    zipLink: text(row.zip_link),
    zipMarime: row.zip_marime === null || row.zip_marime === undefined ? null : Number(row.zip_marime),
    zipFisiere: row.zip_fisiere === null || row.zip_fisiere === undefined ? null : Number(row.zip_fisiere),
    zipFacutLa: text(row.zip_facut_la),
    emailCatre: text(row.email_catre),
    emailSubiect: text(row.email_subiect),
    emailText: text(row.email_text),
    emailStare: (row.email_stare as Pachet["emailStare"]) ?? "nepregatit",
    emailTrimisLa: text(row.email_trimis_la),
  };
}

/** Ce lipsește pentru luna dată. Salvează rezultatul (pentru alertele de dimineață). */
export async function checkMonth(month: string, actor: string | null = null): Promise<Result<MonthCheck>> {
  const admin = db();
  if (!admin) return { ok: false, message: NO_DB };
  const from = monthStart(month);
  const to = monthEnd(month);
  const [invoices, drafts, expenses, payments, imports, existing] = await Promise.all([
    admin.from("firma_facturi").select("id, serie, numar, pasi").not("numar", "is", null).gte("data_emiterii", from).lte("data_emiterii", to).limit(2000),
    admin.from("firma_facturi").select("id").eq("starea", "ciorna").eq("luna", from).limit(2000),
    admin.from("firma_cheltuieli").select("id, furnizor, fisier_nume, suma, data_doc, drive_file_id").eq("luna", from).is("scoasa_la", null).limit(2000),
    admin.from("firma_tranzactii").select("id, data, suma, contrapartida, detalii, cheltuiala_id, potrivire").eq("directie", "out").gte("data", from).lte("data", to).limit(3000),
    admin.from("firma_importuri_banca").select("id, de_la, pana_la, drive_file_id, noi").lte("de_la", to).gte("pana_la", from).limit(200),
    admin.from("firma_pachete").select("*").eq("luna", from).maybeSingle(),
  ]);
  const error = invoices.error ?? drafts.error ?? expenses.error ?? payments.error ?? imports.error ?? existing.error;
  if (error) return failure(error, "17–21");

  const items: Lipsa[] = [];
  for (const row of (invoices.data ?? []) as Row[]) {
    const pasi = (row.pasi ?? {}) as { drive?: { stare?: string } };
    if (pasi.drive?.stare !== "ok") items.push({ fel: "factura", text: `Factura ${row.serie ?? ""} ${row.numar} nu e pe Drive.`, blocheaza: true });
  }
  const draftCount = (drafts.data ?? []).length;
  if (draftCount > 0) items.push({ fel: "ciorna", text: `${draftCount === 1 ? "O ciornă de factură" : `${draftCount} ciorne de facturi`} din ${monthLabel(month)} ${draftCount === 1 ? "nu e aprobată" : "nu sunt aprobate"}.`, blocheaza: false });
  for (const row of (expenses.data ?? []) as Row[]) {
    const name = text(row.furnizor) ?? String(row.fisier_nume);
    if (row.suma === null || !row.data_doc) items.push({ fel: "cheltuiala", text: `Cheltuiala „${name}” n-are suma sau data completate.`, blocheaza: true });
    else if (!row.drive_file_id) items.push({ fel: "cheltuiala", text: `Documentul cheltuielii „${name}” nu e pe Drive.`, blocheaza: true });
  }
  for (const row of (payments.data ?? []) as Row[]) {
    if (row.cheltuiala_id || row.potrivire === "ignorata") continue;
    items.push({ fel: "plata", text: `Plata de ${Math.abs(Number(row.suma)).toLocaleString("ro-RO", { minimumFractionDigits: 2 })} lei din ${row.data} către ${text(row.contrapartida) ?? "—"} n-are document (bon sau factură). Urcă-l în Cheltuieli sau ignoră plata în Încasări (ex. taxe, comisioane).`, blocheaza: true });
  }
  const statementRows = (imports.data ?? []) as Row[];
  if (statementRows.length === 0) items.push({ fel: "extras", text: `Extrasul din ${monthLabel(month)} nu e importat (Încasări → Importă exportul din BT Go).`, blocheaza: true });
  else {
    // Datele din extras sunt ale tranzacțiilor, nu ale perioadei exportate: o lună fără plăți în primele
    // sau ultimele zile pare „neacoperită”. De aceea acoperirea e doar un semn de verificat, nu blochează.
    const earliest = statementRows.map((row) => String(row.de_la)).sort()[0];
    const latest = statementRows.map((row) => String(row.pana_la)).sort().at(-1) ?? from;
    if (earliest > addDays(from, 5)) items.push({ fel: "extras", text: `Prima tranzacție importată e din ${earliest}. Dacă au fost plăți înainte, importă și exportul de la 1 ${monthLabel(month)}.`, blocheaza: false });
    if (todayIso() > to && latest < addDays(to, -5)) items.push({ fel: "extras", text: `Ultima tranzacție importată e din ${latest}. Dacă au fost plăți după, importă și restul lunii.`, blocheaza: false });
    if (!statementRows.some((row) => row.drive_file_id)) items.push({ fel: "extras", text: "Extrasul nu e pe Drive (legă Drive-ul, apoi importă-l din nou — rândurile nu se dublează).", blocheaza: true });
  }

  const complete = items.every((item) => !item.blocheaza);
  const previous = existing.data as Row | null;
  const keepState = previous?.stare === "zip_gata" || previous?.stare === "trimis";
  await admin.from("firma_pachete").upsert(
    { luna: from, stare: keepState ? previous.stare : complete ? "complet" : "incomplet", verificat_la: new Date().toISOString(), lipsuri: items, updated_by: actor ?? "cron" },
    { onConflict: "luna" }
  );
  const { data: fresh } = await admin.from("firma_pachete").select("*").eq("luna", from).maybeSingle();
  return {
    ok: true,
    data: {
      month,
      complete,
      items,
      counts: { facturi: (invoices.data ?? []).length, cheltuieli: (expenses.data ?? []).length, plati: (payments.data ?? []).length, extrase: statementRows.length },
      pachet: toPachet(fresh as Row | null),
    },
  };
}

/** Fișierele lunii: din folderul de pe Drive (tot ce e acolo), altfel din copiile adminului. */
async function monthFiles(month: string): Promise<Result<{ entries: ZipEntry[]; source: "drive" | "admin"; skipped: string[] }>> {
  const admin = db();
  if (!admin) return { ok: false, message: NO_DB };
  const from = monthStart(month);
  const skipped: string[] = [];
  const { data: folder } = await admin.from("firma_luni_drive").select("folder_id").eq("luna", from).maybeSingle();
  if (driveMode() && folder?.folder_id) {
    try {
      const listed = await listChildren(String(folder.folder_id));
      const entries: ZipEntry[] = [];
      for (const file of listed) {
        if (file.name.startsWith(ZIP_PREFIX)) continue;
        if (file.mimeType.startsWith("application/vnd.google-apps")) {
          skipped.push(`${file.name} (document Google: exportă-l ca PDF în folder)`);
          continue;
        }
        entries.push({ name: file.name, bytes: await downloadFile(file.id) });
      }
      return { ok: true, data: { entries, source: "drive", skipped } };
    } catch (caught) {
      return { ok: false, message: caught instanceof DriveError ? caught.message : "Drive n-a răspuns." };
    }
  }
  // Fără Drive: ce a trecut prin admin (bonurile, extrasele; facturile din Oblio).
  const entries: ZipEntry[] = [];
  const [expenses, imports, invoices, clients] = await Promise.all([
    admin.from("firma_cheltuieli").select("fisier_cale, fisier_nume, furnizor, data_doc").eq("luna", from).is("scoasa_la", null).limit(2000),
    admin.from("firma_importuri_banca").select("fisier_cale, fisier_nume, de_la, pana_la").lte("de_la", monthEnd(month)).gte("pana_la", from).limit(200),
    admin.from("firma_facturi").select("serie, numar, link_oblio, client_id").not("numar", "is", null).gte("data_emiterii", from).lte("data_emiterii", monthEnd(month)).limit(2000),
    admin.from("firma_clienti").select("id, nume").limit(5000),
  ]);
  const clientName = new Map((clients.data ?? []).map((row) => [String(row.id), String(row.nume)]));
  for (const row of (invoices.data ?? []) as Row[]) {
    if (!row.link_oblio) continue;
    try {
      const response = await fetch(String(row.link_oblio), { signal: AbortSignal.timeout(20_000) });
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.subarray(0, 4).toString("latin1") === "%PDF") entries.push({ name: `Factura${row.serie ?? ""}${row.numar}-${(clientName.get(String(row.client_id)) ?? "").toUpperCase().replace(/[^A-Z0-9.]+/g, "_")}.pdf`, bytes });
      else skipped.push(`Factura ${row.serie ?? ""} ${row.numar} (PDF-ul nu s-a putut lua din Oblio)`);
    } catch {
      skipped.push(`Factura ${row.serie ?? ""} ${row.numar} (Oblio n-a răspuns)`);
    }
  }
  for (const row of [...((expenses.data ?? []) as Row[]), ...((imports.data ?? []) as Row[])]) {
    const bytes = await downloadObject(String(row.fisier_cale));
    if (bytes) entries.push({ name: String(row.fisier_nume), bytes });
    else skipped.push(`${row.fisier_nume} (nu mai e în stocare)`);
  }
  return { ok: true, data: { entries, source: "admin", skipped } };
}

export interface ZipOutcome {
  files: number;
  size: number;
  source: "drive" | "admin";
  skipped: string[];
  driveLink: string | null;
  driveMessage: string | null;
}

export async function buildPackage(month: string, force: boolean, actor: string): Promise<Result<ZipOutcome>> {
  const admin = db();
  if (!admin) return { ok: false, message: NO_DB };
  const check = await checkMonth(month, actor);
  if (!check.ok) return check;
  if (!check.data.complete && !force) return { ok: false, message: "Luna nu e completă. Rezolvă ce lipsește sau alege „Fă zip-ul oricum”." };

  const files = await monthFiles(month);
  if (!files.ok) return files;
  if (files.data.entries.length === 0) return { ok: false, message: `N-am găsit niciun fișier pentru ${monthLabel(month)}.` };
  const zip = makeZip(files.data.entries);
  const stamp = new Date().toISOString().slice(0, 16).replace("T", " ").replace(":", "");
  const zipName = `${ZIP_PREFIX}${monthLabel(month)} - ${stamp}.zip`;
  const path = `pachete/${randomUUID()}.zip`;
  const stored = await putObject(path, zip, "application/zip");
  if (!stored.ok) return stored;

  let driveLink: string | null = null;
  let driveId: string | null = null;
  let driveMessage: string | null = null;
  if (driveMode()) {
    const saved = await saveToDrive({ month, kind: "pachet", sourceId: `${month}:${Date.now()}`, name: zipName, bytes: zip, mimeType: "application/zip", actor });
    if (saved.ok) {
      driveLink = saved.data.link;
      driveId = saved.data.fileId;
    } else driveMessage = saved.message;
  } else driveMessage = "Drive-ul nu e legat: zip-ul e doar în admin.";

  const settings = await readSettings();
  const accountant = settings.ok ? settings.data.emailContabil : null;
  const size = (zip.length / 1024 / 1024).toLocaleString("ro-RO", { maximumFractionDigits: 1 });
  const linkLine = driveLink ? `Zip-ul e și pe Drive: ${driveLink}` : null;
  const body = [
    "Bună ziua,",
    `Vă trimit documentele firmei pentru ${monthLabel(month)}: facturile emise, documentele de cheltuieli și extrasul de cont (${files.data.entries.length} fișiere, ${size} MB).`,
    zip.length <= ATTACH_LIMIT ? "Le găsiți în arhiva atașată." : "Arhiva e prea mare pentru atașament; o găsiți la linkul de mai jos.",
    linkLine,
    "Mulțumesc,",
  ]
    .filter(Boolean)
    .join("\n\n");

  const { error } = await admin
    .from("firma_pachete")
    .update({
      stare: "zip_gata",
      zip_cale: path,
      zip_drive_id: driveId,
      zip_link: driveLink,
      zip_marime: zip.length,
      zip_fisiere: files.data.entries.length,
      zip_facut_la: new Date().toISOString(),
      email_catre: accountant,
      email_subiect: `Documentele pentru ${monthLabel(month)}`,
      email_text: body,
      email_stare: "pregatit",
      updated_by: actor,
    })
    .eq("luna", monthStart(month));
  if (error) return failure(error, MIGRATION);
  await logEvent({
    actor,
    zona: "contabil",
    actiune: `zip-ul pentru ${monthLabel(month)}`,
    rezultat: "ok",
    mesaj: `${files.data.entries.length} fișiere, ${size} MB, din ${files.data.source === "drive" ? "folderul de pe Drive" : "copiile din admin"}${force && !check.data.complete ? " (făcut deși luna nu era completă)" : ""}${driveMessage ? `; ${driveMessage}` : ""}`,
  });
  return { ok: true, data: { files: files.data.entries.length, size: zip.length, source: files.data.source, skipped: files.data.skipped, driveLink, driveMessage } };
}

/** Emailul către contabil, doar la „Trimite”: zip-ul atașat dacă e mic, altfel linkul. */
export async function sendPackage(month: string, edits: { to: string[]; subject: string; text: string }, actor: string): Promise<Result<{ attached: boolean }>> {
  const admin = db();
  if (!admin) return { ok: false, message: NO_DB };
  if (!isEmailReady()) return { ok: false, message: EMAIL_MISSING };
  const { data: row, error } = await admin.from("firma_pachete").select("*").eq("luna", monthStart(month)).maybeSingle();
  if (error) return failure(error, MIGRATION);
  if (!row?.zip_cale) return { ok: false, message: "Fă întâi zip-ul lunii." };
  const size = Number(row.zip_marime ?? 0);
  let attachments: { filename: string; content: Buffer; contentType: string }[] = [];
  if (size <= ATTACH_LIMIT) {
    const bytes = await downloadObject(String(row.zip_cale));
    if (!bytes) return { ok: false, message: "Zip-ul nu mai e în stocare. Fă-l din nou." };
    attachments = [{ filename: `Documente ${monthLabel(month)}.zip`, content: bytes, contentType: "application/zip" }];
  } else if (!row.zip_link) {
    return { ok: false, message: "Zip-ul e prea mare pentru atașament și nu e pe Drive. Leagă Drive-ul și fă zip-ul din nou." };
  }
  await admin.from("firma_pachete").update({ email_catre: edits.to.join(", "), email_subiect: edits.subject, email_text: edits.text }).eq("luna", monthStart(month));
  const sent = await sendFirmaEmail({ to: edits.to, subject: edits.subject, text: edits.text, senderName: "MERIDIAN · contabilitate", replyTo: actor.includes("@") ? actor : null, attachments });
  await admin
    .from("firma_pachete")
    .update(sent.ok ? { email_stare: "trimis", email_trimis_la: new Date().toISOString(), stare: "trimis", updated_by: actor } : { email_stare: "esuat", updated_by: actor })
    .eq("luna", monthStart(month));
  await logEvent({ actor, zona: "contabil", actiune: `pachetul pentru ${monthLabel(month)} trimis`, rezultat: sent.ok ? "ok" : "eroare", mesaj: sent.ok ? `către ${edits.to.join(", ")}${attachments.length ? ", cu zip-ul atașat" : ", cu linkul"}` : sent.message });
  if (!sent.ok) return { ok: false, message: sent.message };
  return { ok: true, data: { attached: attachments.length > 0 } };
}

export async function packageDownload(month: string): Promise<Result<{ url: string }>> {
  const admin = db();
  if (!admin) return { ok: false, message: NO_DB };
  const { data } = await admin.from("firma_pachete").select("zip_cale").eq("luna", monthStart(month)).maybeSingle();
  if (!data?.zip_cale) return { ok: false, message: "Zip-ul nu e făcut încă." };
  const url = await signedLink(String(data.zip_cale), 600);
  if (!url) return { ok: false, message: "Zip-ul nu se poate descărca acum." };
  return { ok: true, data: { url } };
}
