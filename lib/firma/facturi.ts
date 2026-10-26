import { randomUUID } from "node:crypto";
import { db, failure, NO_DB, type Db, type Result } from "./db";
import { addDays, monthLabel, monthStart, todayIso } from "./format";
import { contractInMonth, priceForMonth } from "./contracte-shared";
import { listClients } from "./clienti";
import { readSettings } from "./setari";
import { logEvent } from "./istoric";
import { invoiceTotal, type Factura, type NumePas, type Pas, type RandFactura, type StareEmail, type StareFactura } from "./facturi-shared";
import { createInvoice, isOblioConfigured, listInvoices as oblioList, OblioError, OBLIO_MISSING, sendEinvoice } from "./oblio/api";
import { saveInvoicePdfToDrive } from "./drive/invoices";
import { EMAIL_MISSING, isEmailReady, sendFirmaEmail } from "./email";

/**
 * Facturile (migrarea 17). Ciornele se pregătesc din contracte (sau de mână),
 * iar aprobarea — doar a omului — le emite în Oblio, le trimite în e-Factura,
 * le pune PDF-ul pe Drive și le pregătește emailul. Emailul pleacă doar la
 * „Trimite”. Nimic de aici nu anulează, nu stornează și nu șterge o factură emisă.
 */

const MIGRATION = "17 (00000000000017_firma_facturi.sql)";
type Row = Record<string, unknown>;

const text = (value: unknown) => (typeof value === "string" && value !== "" ? value : null);

function toFactura(row: Row, clientName: string): Factura {
  const rows = Array.isArray(row.randuri) ? (row.randuri as RandFactura[]) : [];
  return {
    id: String(row.id),
    clientId: String(row.client_id),
    clientNume: clientName,
    contractId: text(row.contract_id),
    felul: row.felul === "manuala" ? "manuala" : "contract",
    luna: text(row.luna),
    starea: (row.starea as StareFactura) ?? "ciorna",
    serie: text(row.serie),
    numar: text(row.numar),
    linkOblio: text(row.link_oblio),
    dataPlanificata: String(row.data_planificata),
    dataEmiterii: text(row.data_emiterii),
    zileScadenta: Number(row.zile_scadenta ?? 5),
    scadenta: text(row.scadenta),
    moneda: row.moneda === "EUR" ? "EUR" : "RON",
    randuri: rows.map((item) => ({ denumire: String(item.denumire ?? ""), descriere: item.descriere ? String(item.descriere) : null, cantitate: Number(item.cantitate ?? 1), um: String(item.um ?? "buc"), pretUnitar: Number(item.pretUnitar ?? 0) })),
    total: Number(row.total ?? 0),
    mentiuni: text(row.mentiuni),
    efacturaCod: row.efactura_cod === null || row.efactura_cod === undefined ? null : Number(row.efactura_cod),
    efacturaText: text(row.efactura_text),
    driveLink: text(row.drive_link),
    emailStare: (row.email_stare as StareEmail) ?? "nepregatit",
    emailCatre: text(row.email_catre),
    emailSubiect: text(row.email_subiect),
    emailText: text(row.email_text),
    emailTrimisLa: text(row.email_trimis_la),
    incasat: Number(row.incasat ?? 0),
    incasataLa: text(row.incasata_la),
    pasi: (row.pasi && typeof row.pasi === "object" ? row.pasi : {}) as Factura["pasi"],
    aprobataDe: text(row.aprobata_de),
    aprobataLa: text(row.aprobata_la),
    createdAt: String(row.created_at),
  };
}

async function clientNames(admin: Db): Promise<Map<string, string>> {
  const { data } = await admin.from("firma_clienti").select("id, nume").limit(5000);
  return new Map((data ?? []).map((row) => [String(row.id), String(row.nume)]));
}

/** Luna de care ține factura: luna facturată, altfel luna emiterii (sau a planificării). */
export function invoiceMonth(invoice: Pick<Factura, "luna" | "dataEmiterii" | "dataPlanificata">): string {
  return (invoice.luna ?? invoice.dataEmiterii ?? invoice.dataPlanificata).slice(0, 7);
}

export async function listInvoices(filter: { month?: string | null; clientId?: string | null; includeDiscarded?: boolean } = {}): Promise<Result<Factura[]>> {
  const admin = db();
  if (!admin) return { ok: false, message: NO_DB };
  let query = admin.from("firma_facturi").select("*").order("data_planificata", { ascending: false }).limit(5000);
  if (filter.clientId) query = query.eq("client_id", filter.clientId);
  const [{ data, error }, names] = await Promise.all([query, clientNames(admin)]);
  if (error) return failure(error, MIGRATION);
  let invoices = ((data ?? []) as Row[]).map((row) => toFactura(row, names.get(String(row.client_id)) ?? "client șters"));
  if (!filter.includeDiscarded) invoices = invoices.filter((invoice) => invoice.starea !== "renuntat");
  if (filter.month) invoices = invoices.filter((invoice) => invoiceMonth(invoice) === filter.month);
  return { ok: true, data: invoices };
}

export async function invoiceById(id: string): Promise<Result<Factura | null>> {
  const admin = db();
  if (!admin) return { ok: false, message: NO_DB };
  const { data, error } = await admin.from("firma_facturi").select("*").eq("id", id).maybeSingle();
  if (error) return failure(error, MIGRATION);
  if (!data) return { ok: true, data: null };
  const names = await clientNames(admin);
  return { ok: true, data: toFactura(data as Row, names.get(String(data.client_id)) ?? "client șters") };
}

// ------------------------------------------------------------ ciornele

export interface PrepareOutcome {
  created: number;
  existing: number;
  skipped: { client: string; reason: string }[];
}

/** Ziua planificată a emiterii: ziua din contract, în luna facturată. */
function plannedDay(month: string, day: number): string {
  return `${month}-${String(day).padStart(2, "0")}`;
}

/**
 * Ciornele lunii, din contractele active. Nu atinge Oblio. O ciornă existentă
 * (chiar și una la care s-a renunțat) nu se mai face o dată.
 */
export async function prepareMonth(month: string, actor: string): Promise<Result<PrepareOutcome>> {
  const admin = db();
  if (!admin) return { ok: false, message: NO_DB };
  const clients = await listClients();
  if (!clients.ok) return clients;
  const { data: existingRows, error } = await admin.from("firma_facturi").select("contract_id").eq("felul", "contract").eq("luna", monthStart(month));
  if (error) return failure(error, MIGRATION);
  const existing = new Set((existingRows ?? []).map((row) => String(row.contract_id)));

  const outcome: PrepareOutcome = { created: 0, existing: 0, skipped: [] };
  for (const client of clients.data) {
    for (const contract of client.contracte) {
      if (!contractInMonth(contract, month)) continue;
      if (existing.has(contract.id)) {
        outcome.existing += 1;
        continue;
      }
      const price = priceForMonth(contract.preturi, month);
      if (!price) {
        outcome.skipped.push({ client: client.nume, reason: `contractul n-are preț pe ${monthLabel(month)}` });
        continue;
      }
      const rows: RandFactura[] = [{ denumire: `${price.descriere} — ${monthLabel(month)}`, descriere: null, cantitate: 1, um: "lună", pretUnitar: price.suma }];
      const { error: insertError } = await admin.from("firma_facturi").insert({
        client_id: client.id,
        contract_id: contract.id,
        felul: "contract",
        luna: monthStart(month),
        starea: "ciorna",
        data_planificata: plannedDay(month, contract.ziEmitere),
        zile_scadenta: contract.zileScadenta,
        moneda: contract.moneda,
        randuri: rows,
        total: invoiceTotal(rows),
        cheie_idempotenta: `contract:${contract.id}:${month}`,
        created_by: actor,
      });
      if (insertError) {
        if (insertError.code === "23505") outcome.existing += 1;
        else return failure(insertError, MIGRATION);
      } else {
        outcome.created += 1;
      }
    }
  }
  await logEvent({
    actor,
    zona: "facturi",
    actiune: `ciornele pentru ${monthLabel(month)}`,
    rezultat: "ok",
    mesaj: `${outcome.created} noi, ${outcome.existing} existau${outcome.skipped.length ? `, ${outcome.skipped.length} sărite (${outcome.skipped.map((item) => `${item.client}: ${item.reason}`).join("; ")})` : ""}`,
  });
  return { ok: true, data: outcome };
}

export interface DraftInput {
  randuri: RandFactura[];
  zileScadenta: number;
  dataPlanificata: string;
  mentiuni: string | null;
}

export async function saveDraft(id: string, input: DraftInput): Promise<Result<null>> {
  const admin = db();
  if (!admin) return { ok: false, message: NO_DB };
  const { data, error } = await admin
    .from("firma_facturi")
    .update({ randuri: input.randuri, total: invoiceTotal(input.randuri), zile_scadenta: input.zileScadenta, data_planificata: input.dataPlanificata, mentiuni: input.mentiuni })
    .eq("id", id)
    // O ciornă, sau una a cărei emitere a fost refuzată de Oblio (și n-are număr): se repară, apoi se aprobă din nou.
    .in("starea", ["ciorna", "eroare"])
    .is("numar", null)
    .select("id");
  if (error) return failure(error, MIGRATION);
  if (!data || data.length === 0) return { ok: false, message: "Doar o ciornă se poate corecta. Factura emisă se corectează în Oblio." };
  return { ok: true, data: null };
}

export async function createManual(input: DraftInput & { clientId: string; moneda: "RON" | "EUR" }, actor: string): Promise<Result<{ id: string }>> {
  const admin = db();
  if (!admin) return { ok: false, message: NO_DB };
  const { data, error } = await admin
    .from("firma_facturi")
    .insert({
      client_id: input.clientId,
      felul: "manuala",
      starea: "ciorna",
      data_planificata: input.dataPlanificata,
      zile_scadenta: input.zileScadenta,
      moneda: input.moneda,
      randuri: input.randuri,
      total: invoiceTotal(input.randuri),
      mentiuni: input.mentiuni,
      cheie_idempotenta: `manuala:${randomUUID()}`,
      created_by: actor,
    })
    .select("id")
    .single();
  if (error || !data) return failure(error, MIGRATION);
  return { ok: true, data: { id: String(data.id) } };
}

export async function discardDraft(id: string): Promise<Result<null>> {
  const admin = db();
  if (!admin) return { ok: false, message: NO_DB };
  const { data, error } = await admin.from("firma_facturi").update({ starea: "renuntat" }).eq("id", id).eq("starea", "ciorna").select("id");
  if (error) return failure(error, MIGRATION);
  if (!data || data.length === 0) return { ok: false, message: "Doar la o ciornă se poate renunța. O factură emisă se anulează sau se stornează în Oblio, de tine." };
  return { ok: true, data: null };
}

// ------------------------------------------------------------ aprobarea

const step = (stare: Pas["stare"], mesaj: string | null = null): Pas => ({ stare, la: new Date().toISOString(), mesaj });

function invoiceEmail(invoice: Factura): { subject: string; text: string } {
  const name = `${invoice.serie ?? ""} ${invoice.numar ?? ""}`.trim();
  const amount = new Intl.NumberFormat("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(invoice.total);
  const currency = invoice.moneda === "EUR" ? "EUR" : "lei";
  const day = (iso: string | null) => (iso ? new Intl.DateTimeFormat("ro-RO", { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" }).format(new Date(`${iso}T00:00:00Z`)) : "");
  return {
    subject: `Factura ${name}${invoice.luna ? ` — ${monthLabel(invoice.luna.slice(0, 7))}` : ""}`,
    text: `Bună ziua,\n\nVă trimitem atașat factura ${name} din ${day(invoice.dataEmiterii)}, în valoare de ${amount} ${currency}, scadentă pe ${day(invoice.scadenta)}.\n\nFactura a fost transmisă și în sistemul e-Factura.\n\nMulțumim,\nMERIDIAN`,
  };
}

/** Ce lipsește ca factura să poată fi emisă și primită în e-Factura. */
function missingForInvoice(client: { cui: string | null; adresa: string | null; oras: string | null; judet: string | null }): string | null {
  if (!client.cui) return "Clientul n-are CUI, iar e-Factura îl cere. Completează-l în Clienți.";
  if (!client.adresa || !client.oras || !client.judet) return "Clientului îi lipsește adresa, orașul sau județul, iar e-Factura le cere. Completează-le în Clienți.";
  return null;
}

export interface ApproveOutcome {
  invoice: Factura;
  /** Un pas care n-a mers (factura poate fi emisă totuși). */
  warning: string | null;
}

/**
 * Aprobarea: emite → e-Factura → Drive → emailul pregătit. Se poate relua: o
 * factură emisă nu se mai emite (Oblio primește aceeași `idempotencyKey`), un
 * pas reușit nu se repetă.
 */
export async function approveInvoice(id: string, actor: string): Promise<Result<ApproveOutcome>> {
  const admin = db();
  if (!admin) return { ok: false, message: NO_DB };
  if (!isOblioConfigured()) return { ok: false, message: OBLIO_MISSING };
  const { data: row, error } = await admin.from("firma_facturi").select("*").eq("id", id).maybeSingle();
  if (error) return failure(error, MIGRATION);
  if (!row) return { ok: false, message: "Factura nu mai există." };
  const { data: clientRow, error: clientError } = await admin.from("firma_clienti").select("*").eq("id", row.client_id).maybeSingle();
  if (clientError || !clientRow) return { ok: false, message: "Clientul facturii nu mai există." };
  let invoice = toFactura(row as Row, String(clientRow.nume));
  if (invoice.starea === "renuntat") return { ok: false, message: "La ciorna asta s-a renunțat; fă alta dacă e nevoie." };
  if (invoice.randuri.length === 0 || invoice.total <= 0) return { ok: false, message: "Factura n-are niciun rând cu preț. Corectează ciorna." };

  const settings = await readSettings();
  const series = invoice.serie ?? (settings.ok ? settings.data.serieFactura : null);
  if (!series) return { ok: false, message: "Alege seria facturilor în Firmă → Setări (exact ca în Oblio)." };
  const missing = missingForInvoice({ cui: (clientRow.cui as string | null) ?? null, adresa: (clientRow.adresa as string | null) ?? null, oras: (clientRow.oras as string | null) ?? null, judet: (clientRow.judet as string | null) ?? null });
  if (missing && !invoice.numar) return { ok: false, message: missing };

  const pasi: Partial<Record<NumePas, Pas>> = { ...invoice.pasi };
  const save = async (patch: Record<string, unknown>) => {
    const { error: updateError } = await admin.from("firma_facturi").update({ ...patch, pasi }).eq("id", id);
    if (updateError) console.error("[firma] factura n-a putut fi actualizată:", updateError.message);
  };
  let warning: string | null = null;

  // 1. Emiterea. Un singur proces o pornește: starea trece din ciornă/eroare în „in_lucru” condiționat.
  if (!invoice.numar) {
    // „in_lucru” rămas de la o rulare întreruptă (peste 2 minute) se poate relua.
    const staleBefore = new Date(Date.now() - 2 * 60_000).toISOString();
    const claimable = invoice.starea === "ciorna" || invoice.starea === "eroare" || (invoice.starea === "in_lucru" && (!invoice.aprobataLa || invoice.aprobataLa < staleBefore));
    if (!claimable) return { ok: false, message: "Factura se emite chiar acum. Așteaptă câteva secunde și reîncarcă." };
    // Comparare-și-schimbare: doar cine vede încă starea veche o trece în „in_lucru”.
    let claim = admin
      .from("firma_facturi")
      .update({ starea: "in_lucru", aprobata_de: actor, aprobata_la: new Date().toISOString(), serie: series })
      .eq("id", id)
      .eq("starea", invoice.starea);
    claim = invoice.aprobataLa ? claim.eq("aprobata_la", invoice.aprobataLa) : claim.is("aprobata_la", null);
    const { data: claimed } = await claim.select("id");
    if (!claimed || claimed.length === 0) return { ok: false, message: "Factura se emite chiar acum. Așteaptă câteva secunde și reîncarcă." };

    const issueDate = todayIso();
    const dueDate = addDays(issueDate, invoice.zileScadenta);
    try {
      const created = await createInvoice({
        seriesName: series,
        issueDate,
        dueDate,
        currency: invoice.moneda,
        idempotencyKey: String(row.cheie_idempotenta),
        mentions: invoice.mentiuni ?? undefined,
        client: {
          name: String(clientRow.nume),
          cif: (clientRow.cui as string | null) ?? null,
          rc: (clientRow.reg_com as string | null) ?? null,
          address: (clientRow.adresa as string | null) ?? null,
          city: (clientRow.oras as string | null) ?? null,
          state: (clientRow.judet as string | null) ?? null,
          country: (clientRow.tara as string | null) ?? "România",
          email: (clientRow.email_facturare as string | null) ?? null,
        },
        products: invoice.randuri.map((item) => ({ name: item.denumire, description: item.descriere ?? undefined, price: item.pretUnitar, quantity: item.cantitate, measuringUnit: item.um })),
      });
      pasi.emitere = step("ok", `${created.seriesName} ${created.number}`);
      await save({ serie: created.seriesName, numar: created.number, link_oblio: created.link || null, data_emiterii: issueDate, scadenta: dueDate, starea: "in_lucru" });
      invoice = { ...invoice, serie: created.seriesName, numar: created.number, linkOblio: created.link || null, dataEmiterii: issueDate, scadenta: dueDate };
      await logEvent({ actor, zona: "facturi", actiune: "factură emisă în Oblio", tinta: id, rezultat: "ok", mesaj: `${created.seriesName} ${created.number} · ${invoice.clientNume}` });
    } catch (caught) {
      const message = caught instanceof OblioError ? caught.message : "Oblio n-a răspuns la emitere.";
      pasi.emitere = step("eroare", message);
      await save({ starea: "eroare" });
      await logEvent({ actor, zona: "facturi", actiune: "emiterea în Oblio n-a mers", tinta: id, rezultat: "eroare", mesaj: `${invoice.clientNume}: ${message}` });
      return { ok: false, message: `Factura nu s-a emis: ${message}` };
    }
  }

  // 2. e-Factura.
  if (invoice.efacturaCod !== 0 && invoice.efacturaCod !== 1 && invoice.numar && invoice.serie) {
    try {
      const status = await sendEinvoice(invoice.serie, invoice.numar);
      const good = status.code === 0 || status.code === 1;
      pasi.efactura = step(good ? "ok" : "eroare", status.text || null);
      await save({ efactura_cod: status.code, efactura_text: status.text || null, efactura_la: new Date().toISOString() });
      invoice = { ...invoice, efacturaCod: status.code, efacturaText: status.text || null };
      if (!good) warning = `e-Factura n-a primit factura: ${status.text || "fără motiv"}. Corectează în Oblio și apasă „Aprobă” din nou ca să reîncerci.`;
      await logEvent({ actor, zona: "facturi", actiune: "trimisă în e-Factura", tinta: id, rezultat: good ? "ok" : "eroare", mesaj: `${invoice.serie} ${invoice.numar}: ${status.text}` });
    } catch (caught) {
      const message = caught instanceof OblioError ? caught.message : "Oblio n-a răspuns la e-Factura.";
      pasi.efactura = step("eroare", message);
      await save({});
      warning = `Factura e emisă, dar n-a plecat în e-Factura: ${message} Apasă „Aprobă” din nou ca să reîncerci.`;
      await logEvent({ actor, zona: "facturi", actiune: "e-Factura n-a mers", tinta: id, rezultat: "eroare", mesaj: message });
    }
  }

  // 3. PDF-ul pe Drive.
  if (pasi.drive?.stare !== "ok") {
    const pdf = invoice.linkOblio ? await downloadPdf(invoice.linkOblio) : null;
    const drive = await saveInvoicePdfToDrive(invoice, pdf, actor);
    pasi.drive = drive.pas;
    await save(drive.fileId ? { drive_file_id: drive.fileId, drive_link: drive.link } : {});
    if (drive.pas.stare === "eroare") {
      warning = warning ?? `PDF-ul n-a ajuns pe Drive: ${drive.pas.mesaj}`;
      await logEvent({ actor, zona: "drive", actiune: "PDF-ul facturii n-a ajuns pe Drive", tinta: id, rezultat: "eroare", mesaj: drive.pas.mesaj });
    } else if (drive.pas.stare === "ok") {
      invoice = { ...invoice, driveLink: drive.link };
      await logEvent({ actor, zona: "drive", actiune: "PDF-ul facturii pe Drive", tinta: id, rezultat: "ok", mesaj: `${invoice.serie} ${invoice.numar}` });
    }
  }

  // 4. Emailul, doar pregătit.
  if (invoice.emailStare === "nepregatit") {
    const to = (clientRow.email_facturare as string | null) ?? null;
    const draft = invoiceEmail(invoice);
    pasi.email = to ? step("ok", `către ${to}`) : step("eroare", "Clientul n-are email de facturare. Scrie adresa în email înainte de „Trimite”.");
    await save({ email_stare: "pregatit", email_catre: to, email_subiect: draft.subject, email_text: draft.text });
  }

  await save({ starea: "emisa" });
  const fresh = await invoiceById(id);
  if (!fresh.ok || !fresh.data) return { ok: false, message: "Factura s-a emis, dar n-am putut-o reciti. Reîncarcă pagina." };
  return { ok: true, data: { invoice: fresh.data, warning } };
}

// ------------------------------------------------------------ emailul

async function downloadPdf(link: string): Promise<Buffer | null> {
  try {
    const response = await fetch(link, { signal: AbortSignal.timeout(20_000), cache: "no-store" });
    if (!response.ok) return null;
    const type = response.headers.get("content-type") ?? "";
    const bytes = Buffer.from(await response.arrayBuffer());
    // Unele linkuri răspund cu octet-stream; un PDF începe oricum cu „%PDF”.
    if (!type.includes("pdf") && bytes.subarray(0, 4).toString("latin1") !== "%PDF") return null;
    return bytes;
  } catch {
    return null;
  }
}

export async function invoicePdf(invoice: Pick<Factura, "linkOblio">): Promise<Buffer | null> {
  return invoice.linkOblio ? downloadPdf(invoice.linkOblio) : null;
}

/** Trimite emailul facturii (doar din „Trimite”), cu PDF-ul din Oblio atașat. */
export async function sendInvoiceEmail(id: string, edits: { to: string[]; subject: string; text: string }, actor: string): Promise<Result<null>> {
  const admin = db();
  if (!admin) return { ok: false, message: NO_DB };
  if (!isEmailReady()) return { ok: false, message: EMAIL_MISSING };
  const found = await invoiceById(id);
  if (!found.ok) return found;
  const invoice = found.data;
  if (!invoice || !invoice.numar) return { ok: false, message: "Emailul pleacă doar pentru o factură emisă." };
  if (invoice.emailStare === "trimis") return { ok: false, message: "Emailul acestei facturi a plecat deja." };
  const pdf = await invoicePdf(invoice);
  if (!pdf) return { ok: false, message: "N-am putut lua PDF-ul facturii din Oblio, așa că emailul n-a plecat. Reîncearcă peste un minut." };

  await admin.from("firma_facturi").update({ email_catre: edits.to.join(", "), email_subiect: edits.subject, email_text: edits.text }).eq("id", id);
  const sent = await sendFirmaEmail({
    to: edits.to,
    subject: edits.subject,
    text: edits.text,
    senderName: "MERIDIAN · facturi",
    replyTo: actor.includes("@") ? actor : null,
    attachments: [{ filename: `Factura-${invoice.serie ?? ""}-${invoice.numar}.pdf`.replace(/\s+/g, ""), content: pdf, contentType: "application/pdf" }],
  });
  await admin
    .from("firma_facturi")
    .update(sent.ok ? { email_stare: "trimis", email_trimis_la: new Date().toISOString() } : { email_stare: "esuat" })
    .eq("id", id);
  await logEvent({ actor, zona: "facturi", actiune: "emailul facturii", tinta: id, rezultat: sent.ok ? "ok" : "eroare", mesaj: sent.ok ? `${invoice.serie} ${invoice.numar} către ${edits.to.join(", ")}` : sent.message });
  if (!sent.ok) return { ok: false, message: sent.message };
  return { ok: true, data: null };
}

/**
 * PDF-urile facturilor emise care nu sunt încă pe Drive (emise înainte de
 * legarea Drive-ului, sau cu pasul căzut): le urcă acum, în folderul lunii emiterii.
 */
export async function uploadMissingToDrive(month: string, actor: string): Promise<Result<{ uploaded: number; failed: string[] }>> {
  const admin = db();
  if (!admin) return { ok: false, message: NO_DB };
  const list = await listInvoices({ month });
  if (!list.ok) return list;
  const missing = list.data.filter((invoice) => invoice.numar && invoice.pasi.drive?.stare !== "ok");
  let uploaded = 0;
  const failed: string[] = [];
  for (const invoice of missing) {
    const pdf = await invoicePdf(invoice);
    const drive = await saveInvoicePdfToDrive(invoice, pdf, actor);
    const pasi = { ...invoice.pasi, drive: drive.pas };
    await admin.from("firma_facturi").update({ pasi, ...(drive.fileId ? { drive_file_id: drive.fileId, drive_link: drive.link } : {}) }).eq("id", invoice.id);
    if (drive.pas.stare === "ok") uploaded += 1;
    else failed.push(`${invoice.serie ?? ""} ${invoice.numar}: ${drive.pas.mesaj}`);
  }
  await logEvent({ actor, zona: "drive", actiune: `facturile din ${monthLabel(month)} urcate pe Drive`, rezultat: failed.length ? "eroare" : "ok", mesaj: `${uploaded} urcate${failed.length ? `; ${failed.join("; ")}` : ""}` });
  return { ok: true, data: { uploaded, failed } };
}

// ------------------------------------------------------------ starea din Oblio

/**
 * Citește din Oblio starea e-Factura și încasările facturilor emise care nu
 * sunt încă încasate sau validate. Doar citire.
 */
export async function refreshFromOblio(actor: string): Promise<Result<{ checked: number; updated: number }>> {
  const admin = db();
  if (!admin) return { ok: false, message: NO_DB };
  if (!isOblioConfigured()) return { ok: false, message: OBLIO_MISSING };
  const { data, error } = await admin.from("firma_facturi").select("*").not("numar", "is", null).limit(5000);
  if (error) return failure(error, MIGRATION);
  const open = ((data ?? []) as Row[]).filter((row) => Number(row.incasat ?? 0) < Number(row.total ?? 0) - 0.005 || Number(row.efactura_cod ?? -1) !== 1);
  if (open.length === 0) return { ok: true, data: { checked: 0, updated: 0 } };
  const from = open.map((row) => String(row.data_emiterii ?? row.data_planificata)).sort()[0];
  const today = todayIso();

  try {
    const listed = [];
    for (let page = 0; page < 20; page++) {
      const batch = await oblioList({ issuedAfter: from, issuedBefore: today, offset: page * 100 });
      listed.push(...batch);
      if (batch.length < 100) break;
    }
    const byName = new Map(listed.map((item) => [`${item.seriesName}|${item.number}`, item]));
    let updated = 0;
    for (const row of open) {
      const found = byName.get(`${row.serie}|${row.numar}`);
      if (!found) continue;
      const lastCollect = found.collects.map((item) => item.issueDate).filter(Boolean).sort().at(-1) ?? null;
      const patch: Record<string, unknown> = {};
      if (Math.abs(found.collected - Number(row.incasat ?? 0)) > 0.005) {
        patch.incasat = found.collected;
        patch.incasata_la = lastCollect;
      }
      if (found.einvoice && found.einvoice.code !== Number(row.efactura_cod ?? -99)) {
        patch.efactura_cod = found.einvoice.code;
        patch.efactura_text = found.einvoice.text || null;
        patch.efactura_la = new Date().toISOString();
      }
      if (Object.keys(patch).length > 0) {
        await admin.from("firma_facturi").update(patch).eq("id", row.id);
        updated += 1;
      }
    }
    await logEvent({ actor, zona: "facturi", actiune: "starea citită din Oblio", rezultat: "ok", mesaj: `${open.length} verificate, ${updated} schimbate` });
    return { ok: true, data: { checked: open.length, updated } };
  } catch (caught) {
    const message = caught instanceof OblioError ? caught.message : "Oblio n-a răspuns.";
    await logEvent({ actor, zona: "facturi", actiune: "starea din Oblio n-a putut fi citită", rezultat: "eroare", mesaj: message });
    return { ok: false, message };
  }
}
