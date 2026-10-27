import { createHash } from "node:crypto";
import { db, failure, NO_DB, type Result } from "./db";
import { monthEnd, monthStart } from "./format";
import { logEvent } from "./istoric";
import { decodeBytes, detectDelimiter, guessHeaderRow, headerSignature, normalizeRows, norm, parseCsv, suggestColumns, type BankLine, type ColumnMap, type Delimiter, type Encoding } from "./csv";
import { matchIncoming, matchOutgoing, type OpenExpense, type OpenInvoice } from "./incasari-match";
import { createUpload, downloadObject, isAllowedType, isAreaPath } from "./storage";
import { collectInvoice, isOblioConfigured, OblioError, OBLIO_MISSING, viewInvoice } from "./oblio/api";
import { driveMode } from "./drive/google";
import { saveToDrive } from "./drive";

/**
 * Încasările din extrasul BT Go (migrarea 20). Omul urcă exportul; la primul
 * import alege coloanele (formatul se ține minte după antet). Rândurile intră o
 * singură dată; încasările se potrivesc cu facturile, plățile cu cheltuielile.
 * O potrivire sigură marchează factura încasată în Oblio — doar după ce
 * verifică în Oblio că încasarea nu e deja acolo. Extrasul ajunge pe Drive.
 */

const MIGRATION = "20 (00000000000020_firma_incasari.sql)";
type Row = Record<string, unknown>;
const text = (value: unknown) => (typeof value === "string" && value !== "" ? value : null);

export interface SavedFormat {
  id: string;
  nume: string;
  randAntet: number;
  delimitator: Delimiter;
  codare: Encoding;
  coloane: ColumnMap;
}

export interface StatementPreview {
  path: string;
  delimiter: Delimiter;
  encoding: Encoding;
  headerRow: number;
  rows: string[][];
  totalRows: number;
  known: SavedFormat | null;
  suggestion: ColumnMap;
}

export async function prepareStatementUpload(type: string, size: number): Promise<Result<{ path: string; uploadUrl: string }>> {
  const effective = type || "text/csv";
  if (!isAllowedType(effective, "extrase") || effective === "application/pdf") return { ok: false, message: "Urcă exportul CSV din BT Go (nu PDF-ul extrasului: el nu se poate citi sigur)." };
  if (size > 10 * 1024 * 1024) return { ok: false, message: "Exportul are peste 10 MB; exportă o perioadă mai scurtă." };
  return createUpload("extrase", effective);
}

async function readFormat(signature: string): Promise<SavedFormat | null> {
  const admin = db();
  if (!admin) return null;
  const { data } = await admin.from("firma_formate_banca").select("*").eq("semnatura", signature).maybeSingle();
  if (!data) return null;
  return { id: String(data.id), nume: String(data.nume), randAntet: Number(data.rand_antet), delimitator: data.delimitator as Delimiter, codare: data.codare as Encoding, coloane: data.coloane as ColumnMap };
}

/** Primele rânduri ale fișierului, ca omul să aleagă (sau să recunoască) formatul. */
export async function previewStatement(path: string): Promise<Result<StatementPreview>> {
  if (!isAreaPath(path, "extrase")) return { ok: false, message: "Fișierul urcat nu e valid." };
  const bytes = await downloadObject(path);
  if (!bytes) return { ok: false, message: "Fișierul n-a ajuns în stocare. Urcă-l din nou." };
  const { text: content, encoding } = decodeBytes(bytes);
  const delimiter = detectDelimiter(content);
  const rows = parseCsv(content, delimiter);
  if (rows.length < 2) return { ok: false, message: "Fișierul nu pare un export CSV cu rânduri. Exportă din BT Go în format CSV." };
  const headerRow = guessHeaderRow(rows);
  // Un format salvat se recunoaște după antetul lui, oriunde ar fi rândul acela în fișier.
  let known: SavedFormat | null = null;
  for (let index = 0; index < Math.min(rows.length, 30) && !known; index++) {
    known = await readFormat(headerSignature(rows[index]));
  }
  return {
    ok: true,
    data: {
      path,
      delimiter: known?.delimitator ?? delimiter,
      encoding: known?.codare ?? encoding,
      headerRow: known?.randAntet ?? headerRow,
      rows: rows.slice(0, 25).map((row) => row.map((cell) => cell.slice(0, 80))),
      totalRows: rows.length,
      known,
      suggestion: known?.coloane ?? suggestColumns(rows[headerRow] ?? []),
    },
  };
}

function fingerprint(line: BankLine, occurrence: number): string {
  return createHash("sha256")
    .update([line.data, line.suma.toFixed(2), line.moneda, norm(line.detalii), norm(line.contrapartida ?? ""), line.referinta ?? "", occurrence].join("|"))
    .digest("hex");
}

async function openInvoices(): Promise<OpenInvoice[]> {
  const admin = db();
  if (!admin) return [];
  const [{ data: invoices }, { data: clients }] = await Promise.all([
    admin.from("firma_facturi").select("id, serie, numar, total, incasat, moneda, client_id").not("numar", "is", null).limit(5000),
    admin.from("firma_clienti").select("id, nume, cui").limit(5000),
  ]);
  const byId = new Map((clients ?? []).map((row) => [String(row.id), row]));
  return (invoices ?? [])
    .filter((row) => Number(row.incasat ?? 0) < Number(row.total ?? 0) - 0.005)
    .map((row) => ({
      id: String(row.id),
      serie: text(row.serie),
      numar: String(row.numar),
      total: Number(row.total),
      incasat: Number(row.incasat ?? 0),
      moneda: String(row.moneda ?? "RON"),
      clientNume: String(byId.get(String(row.client_id))?.nume ?? ""),
      clientCui: text(byId.get(String(row.client_id))?.cui),
    }));
}

async function openExpenses(): Promise<OpenExpense[]> {
  const admin = db();
  if (!admin) return [];
  const { data } = await admin.from("firma_cheltuieli").select("id, suma, moneda, data_doc, furnizor").is("tranzactie_id", null).is("scoasa_la", null).not("suma", "is", null).not("data_doc", "is", null).limit(5000);
  return (data ?? []).map((row) => ({ id: String(row.id), suma: Number(row.suma), moneda: String(row.moneda ?? "RON"), dataDoc: String(row.data_doc), furnizor: text(row.furnizor) }));
}

/**
 * Încasarea în Oblio pentru un rând legat de o factură. Întâi citește
 * factura din Oblio: dacă încasările de acolo o acoperă deja (ai marcat-o tu,
 * sau un import anterior), nu mai adaugă nimic.
 */
async function collectForLine(lineId: string, invoiceId: string, actor: string): Promise<{ state: "facuta" | "sarita" | "eroare"; message: string | null }> {
  const admin = db();
  if (!admin) return { state: "eroare", message: NO_DB };
  const [{ data: line }, { data: invoice }] = await Promise.all([admin.from("firma_tranzactii").select("*").eq("id", lineId).maybeSingle(), admin.from("firma_facturi").select("*").eq("id", invoiceId).maybeSingle()]);
  if (!line || !invoice || !invoice.numar || !invoice.serie) return { state: "eroare", message: "Factura nu e emisă (n-are număr)." };
  if (line.oblio_incasare === "facuta") return { state: "facuta", message: null };
  const save = async (state: "facuta" | "sarita" | "eroare", message: string | null) => {
    await admin.from("firma_tranzactii").update({ oblio_incasare: state, oblio_mesaj: message }).eq("id", lineId);
    return { state, message };
  };
  if (!isOblioConfigured()) return save("eroare", OBLIO_MISSING);
  const reference = String(line.referinta ?? `OP ${line.data}`).slice(0, 40);
  try {
    const current = await viewInvoice(String(invoice.serie), String(invoice.numar));
    const collected = current.collects.reduce((sum, item) => sum + item.value, 0);
    const total = Number(invoice.total);
    if (collected >= total - 0.005 || current.collects.some((item) => item.number === reference)) {
      await admin.from("firma_facturi").update({ incasat: collected, incasata_la: current.collects.map((item) => item.issueDate).sort().at(-1) ?? line.data }).eq("id", invoiceId);
      return save("sarita", "Încasarea era deja în Oblio.");
    }
    const value = Math.min(Number(line.suma), Math.round((total - collected) * 100) / 100);
    const result = await collectInvoice(String(invoice.serie), String(invoice.numar), { documentNumber: reference, value, issueDate: String(line.data), mentions: "Marcat din adminul MERIDIAN, după extrasul BT" });
    const after = result.collects.reduce((sum, item) => sum + item.value, 0);
    await admin.from("firma_facturi").update({ incasat: after || collected + value, incasata_la: line.data }).eq("id", invoiceId);
    await logEvent({ actor, zona: "incasari", actiune: "încasare marcată în Oblio", tinta: invoiceId, rezultat: "ok", mesaj: `${invoice.serie} ${invoice.numar}: ${value} ${invoice.moneda ?? "RON"} din ${line.data} (${reference})` });
    return save("facuta", null);
  } catch (error) {
    const message = error instanceof OblioError ? error.message : "Oblio n-a răspuns.";
    await logEvent({ actor, zona: "incasari", actiune: "încasarea în Oblio n-a mers", tinta: invoiceId, rezultat: "eroare", mesaj: message });
    return save("eroare", message);
  }
}

export interface ImportOutcome {
  importId: string;
  lines: number;
  added: number;
  duplicates: number;
  skipped: { row: number; reason: string }[];
  sure: number;
  toConfirm: number;
  collected: number;
  collectErrors: number;
  driveMessage: string | null;
}

export async function importStatement(
  input: { path: string; name: string; headerRow: number; delimiter: Delimiter; encoding: Encoding; columns: ColumnMap; formatName: string },
  actor: string
): Promise<Result<ImportOutcome>> {
  const admin = db();
  if (!admin) return { ok: false, message: NO_DB };
  if (!isAreaPath(input.path, "extrase")) return { ok: false, message: "Fișierul urcat nu e valid." };
  const bytes = await downloadObject(input.path);
  if (!bytes) return { ok: false, message: "Fișierul nu mai e în stocare. Urcă-l din nou." };
  const rows = parseCsv(decodeBytes(bytes, input.encoding).text, input.delimiter);
  const header = rows[input.headerRow];
  if (!header) return { ok: false, message: "Rândul antetului ales nu există în fișier." };
  const { lines, skipped } = normalizeRows(rows, input.headerRow, input.columns);
  if (lines.length === 0) return { ok: false, message: `Niciun rând nu s-a putut citi cu coloanele alese${skipped[0] ? ` (rândul ${skipped[0].row}: ${skipped[0].reason})` : ""}. Verifică coloana datei și a sumei.` };

  // Formatul ales se ține minte după antet.
  const signature = headerSignature(header);
  const { data: format, error: formatError } = await admin
    .from("firma_formate_banca")
    .upsert({ semnatura: signature, nume: input.formatName.slice(0, 120) || "Export BT Go", rand_antet: input.headerRow, delimitator: input.delimiter, codare: input.encoding, coloane: input.columns, created_by: actor }, { onConflict: "semnatura" })
    .select("id")
    .single();
  if (formatError || !format) return failure(formatError, MIGRATION);

  const dates = lines.map((line) => line.data).sort();
  const { data: imported, error: importError } = await admin
    .from("firma_importuri_banca")
    .insert({ fisier_cale: input.path, fisier_nume: input.name.slice(0, 300), format_id: format.id, de_la: dates[0], pana_la: dates.at(-1), randuri: lines.length, luna: monthStart(String(dates.at(-1)).slice(0, 7)), created_by: actor })
    .select("id")
    .single();
  if (importError || !imported) return failure(importError, MIGRATION);
  const importId = String(imported.id);

  // Amprenta: același rând din două exporturi (săptămâna, apoi luna) intră o singură dată.
  const seen = new Map<string, number>();
  const withPrints = lines.map((line) => {
    const base = `${line.data}|${line.suma}|${norm(line.detalii)}|${norm(line.contrapartida ?? "")}|${line.referinta ?? ""}`;
    const occurrence = (seen.get(base) ?? 0) + 1;
    seen.set(base, occurrence);
    return { line, print: fingerprint(line, occurrence) };
  });
  // Câte 100 de amprente pe cerere: o listă lungă în adresă depășește limita PostgREST.
  const known = new Set<string>();
  for (let start = 0; start < withPrints.length; start += 100) {
    const { data: existing } = await admin.from("firma_tranzactii").select("amprenta").in("amprenta", withPrints.slice(start, start + 100).map((item) => item.print));
    for (const row of existing ?? []) known.add(String(row.amprenta));
  }
  const fresh = withPrints.filter((item) => !known.has(item.print));

  const invoices = await openInvoices();
  const expenses = await openExpenses();
  const usedExpenses = new Set<string>();
  let sure = 0;
  let toConfirm = 0;
  const sureInvoiceLines: { lineId: string; invoiceId: string }[] = [];
  for (const { line, print } of fresh) {
    const direction = line.suma > 0 ? "in" : "out";
    const result = direction === "in" ? matchIncoming(line, invoices) : matchOutgoing(line, expenses.filter((expense) => !usedExpenses.has(expense.id)));
    const { data: inserted, error } = await admin
      .from("firma_tranzactii")
      .insert({
        import_id: importId,
        data: line.data,
        suma: line.suma,
        moneda: line.moneda,
        detalii: line.detalii || null,
        contrapartida: line.contrapartida,
        referinta: line.referinta,
        amprenta: print,
        directie: direction,
        potrivire: result.potrivire,
        factura_id: direction === "in" && result.potrivire === "sigura" ? result.id : null,
        cheltuiala_id: direction === "out" && result.potrivire === "sigura" ? result.id : null,
        candidati: result.candidati,
        motiv: result.motiv,
      })
      .select("id")
      .single();
    if (error || !inserted) {
      if (error?.code === "23505") continue;
      return failure(error, MIGRATION);
    }
    if (result.potrivire === "sigura" && result.id) {
      sure += 1;
      if (direction === "in") {
        sureInvoiceLines.push({ lineId: String(inserted.id), invoiceId: result.id });
        // Aceeași factură nu se mai potrivește sigur cu alt rând din același import.
        const invoice = invoices.find((item) => item.id === result.id);
        if (invoice) invoice.incasat += line.suma;
      } else {
        usedExpenses.add(result.id);
        await admin.from("firma_cheltuieli").update({ tranzactie_id: inserted.id }).eq("id", result.id);
      }
    } else if (result.potrivire === "de_confirmat") toConfirm += 1;
  }

  let collected = 0;
  let collectErrors = 0;
  for (const item of sureInvoiceLines) {
    const done = await collectForLine(item.lineId, item.invoiceId, actor);
    if (done.state === "facuta" || done.state === "sarita") collected += 1;
    else collectErrors += 1;
  }

  // Extrasul (fișierul urcat) în folderul lunii ultimei tranzacții.
  let driveMessage: string | null = null;
  if (driveMode()) {
    const name = `Extras BT ${dates[0]} - ${dates.at(-1)}.${/\.(\w{3,4})$/.exec(input.name)?.[1] ?? "csv"}`;
    const saved = await saveToDrive({ month: String(dates.at(-1)).slice(0, 7), kind: "extras", sourceId: importId, name, bytes, mimeType: "text/csv", actor });
    if (saved.ok) await admin.from("firma_importuri_banca").update({ drive_file_id: saved.data.fileId, drive_link: saved.data.link }).eq("id", importId);
    else driveMessage = saved.message;
  } else driveMessage = "Drive-ul nu e legat.";

  await admin.from("firma_importuri_banca").update({ noi: fresh.length, duplicate: withPrints.length - fresh.length, drive_mesaj: driveMessage }).eq("id", importId);
  await logEvent({
    actor,
    zona: "incasari",
    actiune: "extras importat",
    tinta: importId,
    rezultat: collectErrors ? "eroare" : "ok",
    mesaj: `${input.name}: ${fresh.length} noi, ${withPrints.length - fresh.length} deja importate, ${sure} potrivite sigur, ${toConfirm} de confirmat${collectErrors ? `, ${collectErrors} încasări nemarcate în Oblio` : ""}${skipped.length ? `, ${skipped.length} rânduri sărite` : ""}`,
  });
  return { ok: true, data: { importId, lines: lines.length, added: fresh.length, duplicates: withPrints.length - fresh.length, skipped, sure, toConfirm, collected, collectErrors, driveMessage } };
}

// ------------------------------------------------------------ lista și confirmarea

export interface Tranzactie {
  id: string;
  data: string;
  suma: number;
  moneda: string;
  detalii: string | null;
  contrapartida: string | null;
  referinta: string | null;
  directie: "in" | "out";
  potrivire: "nepotrivita" | "sigura" | "de_confirmat" | "confirmata" | "ignorata";
  facturaId: string | null;
  facturaNume: string | null;
  cheltuialaId: string | null;
  cheltuialaNume: string | null;
  candidati: { id: string; motiv: string; nume: string }[];
  motiv: string | null;
  oblioIncasare: "nu" | "facuta" | "sarita" | "eroare";
  oblioMesaj: string | null;
}

export interface ImportRow {
  id: string;
  fisierNume: string;
  deLa: string | null;
  panaLa: string | null;
  noi: number;
  duplicate: number;
  driveLink: string | null;
  driveMesaj: string | null;
  createdAt: string;
}

export async function listBank(month: string): Promise<Result<{ lines: Tranzactie[]; imports: ImportRow[]; openInvoices: { id: string; nume: string }[]; openExpenses: { id: string; nume: string }[] }>> {
  const admin = db();
  if (!admin) return { ok: false, message: NO_DB };
  const [lines, imports, invoices, clients, expenses] = await Promise.all([
    admin.from("firma_tranzactii").select("*").gte("data", monthStart(month)).lte("data", monthEnd(month)).order("data", { ascending: false }).limit(3000),
    admin.from("firma_importuri_banca").select("*").order("created_at", { ascending: false }).limit(30),
    admin.from("firma_facturi").select("id, serie, numar, total, incasat, client_id, moneda").not("numar", "is", null).limit(5000),
    admin.from("firma_clienti").select("id, nume").limit(5000),
    admin.from("firma_cheltuieli").select("id, furnizor, suma, moneda, data_doc, tranzactie_id").is("scoasa_la", null).limit(5000),
  ]);
  const error = lines.error ?? imports.error;
  if (error) return failure(error, MIGRATION);
  const clientName = new Map((clients.data ?? []).map((row) => [String(row.id), String(row.nume)]));
  const invoiceName = new Map(
    (invoices.data ?? []).map((row) => [String(row.id), `${row.serie ?? ""} ${row.numar} · ${clientName.get(String(row.client_id)) ?? ""} · ${Number(row.total).toLocaleString("ro-RO", { minimumFractionDigits: 2 })} ${row.moneda ?? "RON"}`])
  );
  const expenseName = new Map((expenses.data ?? []).map((row) => [String(row.id), `${row.furnizor ?? "cheltuială"} · ${row.data_doc ?? "fără dată"} · ${row.suma ?? "?"} ${row.moneda ?? "RON"}`]));
  return {
    ok: true,
    data: {
      lines: ((lines.data ?? []) as Row[]).map((row) => {
        const direction = row.directie === "out" ? "out" : "in";
        const names = direction === "in" ? invoiceName : expenseName;
        return {
          id: String(row.id),
          data: String(row.data),
          suma: Number(row.suma),
          moneda: String(row.moneda ?? "RON"),
          detalii: text(row.detalii),
          contrapartida: text(row.contrapartida),
          referinta: text(row.referinta),
          directie: direction,
          potrivire: row.potrivire as Tranzactie["potrivire"],
          facturaId: text(row.factura_id),
          facturaNume: row.factura_id ? (invoiceName.get(String(row.factura_id)) ?? null) : null,
          cheltuialaId: text(row.cheltuiala_id),
          cheltuialaNume: row.cheltuiala_id ? (expenseName.get(String(row.cheltuiala_id)) ?? null) : null,
          candidati: (Array.isArray(row.candidati) ? (row.candidati as { id: string; motiv: string }[]) : []).map((item) => ({ ...item, nume: names.get(item.id) ?? "nu mai există" })),
          motiv: text(row.motiv),
          oblioIncasare: (row.oblio_incasare as Tranzactie["oblioIncasare"]) ?? "nu",
          oblioMesaj: text(row.oblio_mesaj),
        };
      }),
      imports: ((imports.data ?? []) as Row[]).map((row) => ({
        id: String(row.id),
        fisierNume: String(row.fisier_nume),
        deLa: text(row.de_la),
        panaLa: text(row.pana_la),
        noi: Number(row.noi ?? 0),
        duplicate: Number(row.duplicate ?? 0),
        driveLink: text(row.drive_link),
        driveMesaj: text(row.drive_mesaj),
        createdAt: String(row.created_at),
      })),
      openInvoices: (invoices.data ?? []).filter((row) => Number(row.incasat ?? 0) < Number(row.total) - 0.005).map((row) => ({ id: String(row.id), nume: invoiceName.get(String(row.id)) ?? "" })),
      openExpenses: (expenses.data ?? []).filter((row) => !row.tranzactie_id).map((row) => ({ id: String(row.id), nume: expenseName.get(String(row.id)) ?? "" })),
    },
  };
}

/** Confirmarea ta: rândul e plata facturii (→ încasarea în Oblio) sau a cheltuielii. */
export async function confirmLine(lineId: string, targetId: string, actor: string): Promise<Result<{ oblio: string | null }>> {
  const admin = db();
  if (!admin) return { ok: false, message: NO_DB };
  const { data: line, error } = await admin.from("firma_tranzactii").select("*").eq("id", lineId).maybeSingle();
  if (error) return failure(error, MIGRATION);
  if (!line) return { ok: false, message: "Rândul nu mai există." };
  if (line.directie === "in") {
    await admin.from("firma_tranzactii").update({ potrivire: "confirmata", factura_id: targetId, motiv: "confirmat de tine" }).eq("id", lineId);
    const done = await collectForLine(lineId, targetId, actor);
    await logEvent({ actor, zona: "incasari", actiune: "încasare confirmată", tinta: lineId, rezultat: done.state === "eroare" ? "eroare" : "ok", mesaj: done.message });
    return { ok: true, data: { oblio: done.state === "facuta" ? "Încasarea e marcată în Oblio." : done.state === "sarita" ? "Încasarea era deja în Oblio." : `Încasarea n-a putut fi marcată în Oblio: ${done.message}` } };
  }
  await admin.from("firma_tranzactii").update({ potrivire: "confirmata", cheltuiala_id: targetId, motiv: "confirmat de tine" }).eq("id", lineId);
  await admin.from("firma_cheltuieli").update({ tranzactie_id: lineId }).eq("id", targetId);
  await logEvent({ actor, zona: "incasari", actiune: "plată legată de o cheltuială", tinta: lineId, rezultat: "ok" });
  return { ok: true, data: { oblio: null } };
}

export async function ignoreLine(lineId: string, actor: string): Promise<Result<null>> {
  const admin = db();
  if (!admin) return { ok: false, message: NO_DB };
  const { data: line } = await admin.from("firma_tranzactii").select("oblio_incasare, cheltuiala_id").eq("id", lineId).maybeSingle();
  if (line?.oblio_incasare === "facuta") return { ok: false, message: "Încasarea e deja marcată în Oblio; adminul n-o scoate de acolo. Dacă e greșită, șterge încasarea din Oblio, de mână." };
  if (line?.cheltuiala_id) await admin.from("firma_cheltuieli").update({ tranzactie_id: null }).eq("id", line.cheltuiala_id);
  const { error } = await admin.from("firma_tranzactii").update({ potrivire: "ignorata", factura_id: null, cheltuiala_id: null, motiv: "ignorat de tine" }).eq("id", lineId);
  if (error) return failure(error, MIGRATION);
  await logEvent({ actor, zona: "incasari", actiune: "rând ignorat", tinta: lineId, rezultat: "ok" });
  return { ok: true, data: null };
}

/** Potrivește din nou rândurile rămase nepotrivite (după facturi sau cheltuieli noi). */
export async function rematch(actor: string): Promise<Result<{ checked: number; sure: number; toConfirm: number }>> {
  const admin = db();
  if (!admin) return { ok: false, message: NO_DB };
  const { data, error } = await admin.from("firma_tranzactii").select("*").eq("potrivire", "nepotrivita").limit(3000);
  if (error) return failure(error, MIGRATION);
  const invoices = await openInvoices();
  const expenses = await openExpenses();
  let sure = 0;
  let toConfirm = 0;
  for (const row of (data ?? []) as Row[]) {
    const line = { data: String(row.data), suma: Number(row.suma), moneda: String(row.moneda ?? "RON"), detalii: String(row.detalii ?? ""), contrapartida: text(row.contrapartida), referinta: text(row.referinta) };
    const result = row.directie === "in" ? matchIncoming(line, invoices) : matchOutgoing(line, expenses);
    if (result.potrivire === "nepotrivita") continue;
    await admin
      .from("firma_tranzactii")
      .update({ potrivire: result.potrivire, candidati: result.candidati, motiv: result.motiv, factura_id: row.directie === "in" && result.potrivire === "sigura" ? result.id : null, cheltuiala_id: row.directie === "out" && result.potrivire === "sigura" ? result.id : null })
      .eq("id", row.id);
    if (result.potrivire === "sigura" && result.id) {
      sure += 1;
      if (row.directie === "in") await collectForLine(String(row.id), result.id, actor);
      else await admin.from("firma_cheltuieli").update({ tranzactie_id: row.id }).eq("id", result.id);
    } else toConfirm += 1;
  }
  await logEvent({ actor, zona: "incasari", actiune: "potrivire din nou", rezultat: "ok", mesaj: `${(data ?? []).length} verificate, ${sure} sigure, ${toConfirm} de confirmat` });
  return { ok: true, data: { checked: (data ?? []).length, sure, toConfirm } };
}
