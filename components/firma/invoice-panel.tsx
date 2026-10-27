"use client";

import { useState, useTransition } from "react";
import { displayState, einvoiceLabel, invoiceName, invoiceTotal, lineTotal, PAS_LABEL, STARE_AFISATA, type Factura, type NumePas, type RandFactura } from "@/lib/firma/facturi-shared";
import { addDays, dateTimeLabel, dayLabel, money, parseAmount } from "@/lib/firma/format";
import type { PrepareOutcome } from "@/lib/firma/facturi";
import { cn } from "@/lib/utils";
import { SidePanel } from "./panel";
import { IconExternal, IconPlus } from "./icons";
import { Field, inputClass, Notice, Tag, textareaClass } from "./ui";

type Result = { ok: true; id?: string; message?: string; warning?: string | null } | { ok: false; field?: string; message: string };

export interface InvoiceActions {
  prepareMonth: (month: string) => Promise<{ ok: true; outcome: PrepareOutcome } | { ok: false; message: string }>;
  saveDraft: (id: string, raw: unknown) => Promise<Result>;
  createManual: (raw: unknown) => Promise<Result>;
  discardDraft: (id: string) => Promise<Result>;
  approve: (id: string) => Promise<Result>;
  sendEmail: (id: string, raw: unknown) => Promise<Result>;
  refresh: () => Promise<Result>;
  uploadMissingDrive: (month: string) => Promise<Result>;
}

export interface InvoiceClient {
  id: string;
  nume: string;
  /** Are CUI și adresă completă (cerute de e-Factura). */
  ready: boolean;
  email: string | null;
}

const sectionTitle = "text-[13px] font-semibold uppercase tracking-[0.08em] text-dim";

// ------------------------------------------------------------ rândurile facturii

interface RowDraft {
  key: number;
  denumire: string;
  descriere: string;
  cantitate: string;
  um: string;
  pretUnitar: string;
}

function toDrafts(rows: RandFactura[]): RowDraft[] {
  return rows.map((row, index) => ({ key: index, denumire: row.denumire, descriere: row.descriere ?? "", cantitate: String(row.cantitate), um: row.um, pretUnitar: String(row.pretUnitar) }));
}

function parseRows(rows: RowDraft[]): { rows: RandFactura[] } | { error: { field: string; message: string } } {
  const out: RandFactura[] = [];
  for (const [index, row] of rows.entries()) {
    const cantitate = parseAmount(row.cantitate);
    const pret = parseAmount(row.pretUnitar);
    if (cantitate === null || cantitate <= 0) return { error: { field: `randuri.${index}.cantitate`, message: "Scrie cantitatea (ex. 1)." } };
    if (pret === null || pret <= 0) return { error: { field: `randuri.${index}.pretUnitar`, message: "Scrie prețul (ex. 1500 sau 1.500,00)." } };
    out.push({ denumire: row.denumire, descriere: row.descriere.trim() || null, cantitate, um: row.um, pretUnitar: pret });
  }
  return { rows: out };
}

function RowsEditor({ rows, setRows, currency, error }: { rows: RowDraft[]; setRows: (rows: RowDraft[]) => void; currency: string; error: { field?: string; message: string } | null }) {
  const set = (key: number, change: Partial<RowDraft>) => setRows(rows.map((row) => (row.key === key ? { ...row, ...change } : row)));
  const fieldError = (field: string) => (error?.field === field ? error.message : null);
  const parsed = parseRows(rows);
  return (
    <fieldset className="grid gap-2">
      <legend className="text-[13px] font-medium text-bone">Rândurile facturii</legend>
      {rows.map((row, index) => (
        <div key={row.key} className="grid gap-2 rounded-lg bg-[var(--ap-side)] p-2.5 sm:grid-cols-[1fr_5rem_5rem_7rem]">
          <Field id={`r-${row.key}-den`} label="Denumirea" error={fieldError(`randuri.${index}.denumire`)} className="sm:col-span-4">
            <input id={`r-${row.key}-den`} value={row.denumire} onChange={(e) => set(row.key, { denumire: e.currentTarget.value })} className={inputClass} maxLength={300} />
          </Field>
          <Field id={`r-${row.key}-cant`} label="Cant." error={fieldError(`randuri.${index}.cantitate`)}>
            <input id={`r-${row.key}-cant`} inputMode="decimal" value={row.cantitate} onChange={(e) => set(row.key, { cantitate: e.currentTarget.value })} className={inputClass} />
          </Field>
          <Field id={`r-${row.key}-um`} label="UM" error={fieldError(`randuri.${index}.um`)}>
            <input id={`r-${row.key}-um`} value={row.um} onChange={(e) => set(row.key, { um: e.currentTarget.value })} className={inputClass} maxLength={20} />
          </Field>
          <Field id={`r-${row.key}-pret`} label="Preț unitar" error={fieldError(`randuri.${index}.pretUnitar`)}>
            <input id={`r-${row.key}-pret`} inputMode="decimal" value={row.pretUnitar} onChange={(e) => set(row.key, { pretUnitar: e.currentTarget.value })} className={inputClass} />
          </Field>
          <div className="flex items-end justify-between gap-2 sm:col-span-1">
            <span className="pb-2 text-[13px] tabular-nums text-dim">{"rows" in parsed ? money(lineTotal(parsed.rows[index]), currency) : ""}</span>
            <button type="button" disabled={rows.length === 1} onClick={() => setRows(rows.filter((item) => item.key !== row.key))} className="h-10 text-[13px] text-dim underline underline-offset-4 hover:text-[var(--ap-error)] disabled:opacity-40">
              Scoate
            </button>
          </div>
        </div>
      ))}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setRows([...rows, { key: Math.max(...rows.map((row) => row.key)) + 1, denumire: "", descriere: "", cantitate: "1", um: "buc", pretUnitar: "" }])}
          className="inline-flex items-center gap-1.5 text-[13.5px] font-medium text-[var(--md-a1)]"
        >
          <IconPlus size={15} />
          Adaugă un rând
        </button>
        <p className="text-[14px] font-semibold tabular-nums text-bone">Total: {"rows" in parsed ? money(invoiceTotal(parsed.rows), currency) : "—"}</p>
      </div>
      <p className="text-[12.5px] text-dim">Firma nu e plătitoare de TVA: prețul e final.</p>
    </fieldset>
  );
}

// ------------------------------------------------------------ factura manuală

export function ManualInvoicePanel({
  clients,
  today,
  createManual,
  onCreated,
  onClose,
}: {
  clients: InvoiceClient[];
  today: string;
  createManual: InvoiceActions["createManual"];
  onCreated: (id: string) => void;
  onClose: () => void;
}) {
  const [clientId, setClientId] = useState("");
  const [rows, setRows] = useState<RowDraft[]>([{ key: 0, denumire: "", descriere: "", cantitate: "1", um: "buc", pretUnitar: "" }]);
  const [fields, setFields] = useState({ zileScadenta: "5", dataPlanificata: today, moneda: "RON", mentiuni: "" });
  const [error, setError] = useState<{ field?: string; message: string } | null>(null);
  const [pending, start] = useTransition();
  const client = clients.find((item) => item.id === clientId) ?? null;

  return (
    <SidePanel title="Factură manuală" subtitle="Pentru ceva care nu e în contract. Se face ca ciornă; o emiți apoi cu „Aprobă”." onClose={onClose}>
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          const parsed = parseRows(rows);
          if ("error" in parsed) {
            setError(parsed.error);
            return;
          }
          start(async () => {
            setError(null);
            const result = await createManual({ clientId, randuri: parsed.rows, zileScadenta: Number(fields.zileScadenta), dataPlanificata: fields.dataPlanificata, moneda: fields.moneda, mentiuni: fields.mentiuni });
            if (!result.ok) {
              setError({ field: result.field, message: result.message });
              return;
            }
            if (result.id) onCreated(result.id);
          });
        }}
        className="grid gap-4"
      >
        <Field id="m-client" label="Clientul" error={error?.field === "clientId" ? error.message : null} hint={client && !client.ready ? "Clientului îi lipsesc CUI-ul sau adresa: completează-le în Clienți înainte de aprobare." : undefined}>
          <select id="m-client" value={clientId} onChange={(e) => setClientId(e.currentTarget.value)} className={inputClass}>
            <option value="">Alege clientul</option>
            {clients.map((item) => (
              <option key={item.id} value={item.id}>
                {item.nume}
              </option>
            ))}
          </select>
        </Field>
        <RowsEditor rows={rows} setRows={setRows} currency={fields.moneda} error={error} />
        <div className="grid gap-3 sm:grid-cols-3">
          <Field id="m-data" label="Data planificată" error={error?.field === "dataPlanificata" ? error.message : null}>
            <input id="m-data" type="date" value={fields.dataPlanificata} onChange={(e) => setFields({ ...fields, dataPlanificata: e.currentTarget.value })} className={inputClass} />
          </Field>
          <Field id="m-scad" label="Scadentă în (zile)" error={error?.field === "zileScadenta" ? error.message : null}>
            <input id="m-scad" type="number" min={0} max={120} value={fields.zileScadenta} onChange={(e) => setFields({ ...fields, zileScadenta: e.currentTarget.value })} className={inputClass} />
          </Field>
          <Field id="m-moneda" label="Moneda">
            <select id="m-moneda" value={fields.moneda} onChange={(e) => setFields({ ...fields, moneda: e.currentTarget.value })} className={inputClass}>
              <option value="RON">RON</option>
              <option value="EUR">EUR</option>
            </select>
          </Field>
        </div>
        <Field id="m-ment" label="Mențiuni pe factură (opțional)" error={error?.field === "mentiuni" ? error.message : null}>
          <textarea id="m-ment" rows={2} value={fields.mentiuni} onChange={(e) => setFields({ ...fields, mentiuni: e.currentTarget.value })} className={textareaClass} maxLength={1000} />
        </Field>
        {error && !error.field ? <Notice tone="error">{error.message}</Notice> : null}
        {error?.field && error.field.startsWith("randuri") && !error.field.includes(".") ? <Notice tone="error">{error.message}</Notice> : null}
        <button type="submit" disabled={pending} className="btn btn-light !min-h-10 justify-self-start !px-4 !py-2 !text-[14px]">
          {pending ? "Se salvează…" : "Salvează ciorna"}
        </button>
      </form>
    </SidePanel>
  );
}

// ------------------------------------------------------------ panoul unei facturi

export function InvoicePanel({
  invoice,
  clients,
  today,
  oblio,
  email,
  actions,
  onChanged,
  onClose,
}: {
  invoice: Factura | null;
  clients: InvoiceClient[];
  today: string;
  oblio: boolean;
  email: boolean;
  actions: InvoiceActions;
  onChanged: () => void;
  onClose: () => void;
}) {
  // Rezultatul aprobării rămâne vizibil și după ce ciorna devine factură emisă (alt ecran în panou).
  const [flash, setFlash] = useState<{ tone: "ok" | "warn" | "error"; text: string } | null>(null);
  if (!invoice) {
    return (
      <SidePanel title="Factura" onClose={onClose}>
        <p className="text-[14px] text-dim">Se încarcă factura… Dacă nu apare, nu mai e în luna aleasă.</p>
      </SidePanel>
    );
  }
  const state = STARE_AFISATA[displayState(invoice, today)];
  const changed = (message?: { tone: "ok" | "warn" | "error"; text: string }) => {
    if (message) setFlash(message);
    onChanged();
  };
  const client = clients.find((item) => item.id === invoice.clientId) ?? null;
  return (
    <SidePanel
      title={invoice.clientNume}
      subtitle={
        <span className="inline-flex flex-wrap items-center gap-2">
          {invoiceName(invoice)} · {money(invoice.total, invoice.moneda)} <Tag tone={state.tone}>{state.label}</Tag>
        </span>
      }
      onClose={onClose}
    >
      {invoice.starea === "ciorna" || (invoice.starea === "eroare" && !invoice.numar) ? (
        <DraftEditor invoice={invoice} client={client} oblio={oblio} actions={actions} onChanged={changed} />
      ) : (
        <>
          {flash ? (
            <Notice tone={flash.tone} className="mb-4">
              <span role="status">{flash.text}</span>
            </Notice>
          ) : null}
          <IssuedView invoice={invoice} oblio={oblio} email={email} actions={actions} onChanged={onChanged} />
        </>
      )}
    </SidePanel>
  );
}

function DraftEditor({
  invoice,
  client,
  oblio,
  actions,
  onChanged,
}: {
  invoice: Factura;
  client: InvoiceClient | null;
  oblio: boolean;
  actions: InvoiceActions;
  onChanged: (message?: { tone: "ok" | "warn" | "error"; text: string }) => void;
}) {
  const [rows, setRows] = useState<RowDraft[]>(toDrafts(invoice.randuri));
  const [fields, setFields] = useState({ zileScadenta: String(invoice.zileScadenta), dataPlanificata: invoice.dataPlanificata, mentiuni: invoice.mentiuni ?? "" });
  const [error, setError] = useState<{ field?: string; message: string } | null>(null);
  const [result, setResult] = useState<{ tone: "ok" | "warn" | "error"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const [dirty, setDirty] = useState(false);

  const draftPayload = () => {
    const parsed = parseRows(rows);
    if ("error" in parsed) {
      setError(parsed.error);
      return null;
    }
    return { randuri: parsed.rows, zileScadenta: Number(fields.zileScadenta), dataPlanificata: fields.dataPlanificata, mentiuni: fields.mentiuni };
  };

  const save = () => {
    const payload = draftPayload();
    if (!payload) return;
    start(async () => {
      setError(null);
      setResult(null);
      const saved = await actions.saveDraft(invoice.id, payload);
      if (!saved.ok) {
        setError({ field: saved.field, message: saved.message });
        return;
      }
      setDirty(false);
      setResult({ tone: "ok", text: "Ciorna e salvată." });
      onChanged();
    });
  };

  const approve = () => {
    const payload = draftPayload();
    if (!payload) return;
    start(async () => {
      setError(null);
      setResult(null);
      // Ce scrie în formular e ce se emite: întâi se salvează ciorna, apoi se aprobă.
      if (dirty) {
        const saved = await actions.saveDraft(invoice.id, payload);
        if (!saved.ok) {
          setError({ field: saved.field, message: saved.message });
          return;
        }
      }
      const approved = await actions.approve(invoice.id);
      if (!approved.ok) {
        setResult({ tone: "error", text: approved.message });
        onChanged();
        return;
      }
      onChanged({ tone: approved.warning ? "warn" : "ok", text: approved.warning ? `${approved.message} ${approved.warning}` : `${approved.message} A plecat în e-Factura; emailul e pregătit mai jos.` });
    });
  };

  const discard = () =>
    start(async () => {
      const done = await actions.discardDraft(invoice.id);
      if (!done.ok) setResult({ tone: "error", text: done.message });
      onChanged();
    });

  const due = addDays(fields.dataPlanificata || invoice.dataPlanificata, Number(fields.zileScadenta) || 0);
  return (
    <div className="grid gap-4" onInput={() => setDirty(true)}>
      {invoice.starea === "eroare" && invoice.pasi.emitere?.mesaj ? (
        <Notice tone="error">
          Oblio a refuzat emiterea: {invoice.pasi.emitere.mesaj} Repară ce spune (aici sau la client) și aprobă din nou — nu se emite de două ori.
        </Notice>
      ) : null}
      <p className="text-[13.5px] text-dim">
        Ciornă {invoice.felul === "contract" ? "din contract" : "manuală"}. Nu există încă în Oblio. La aprobare se emite cu data de azi și scadența în {fields.zileScadenta || "0"} zile (planificat: {dayLabel(fields.dataPlanificata)}, scadentă {dayLabel(due)}).
      </p>
      {client && !client.ready ? (
        <Notice tone="warn">Clientului îi lipsesc CUI-ul sau adresa completă, cerute de e-Factura. Completează-le în Clienți, altfel aprobarea e refuzată.</Notice>
      ) : null}
      <RowsEditor
        rows={rows}
        setRows={(next) => {
          setRows(next);
          setDirty(true);
        }}
        currency={invoice.moneda}
        error={error}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field id="d-data" label="Data planificată" error={error?.field === "dataPlanificata" ? error.message : null}>
          <input id="d-data" type="date" value={fields.dataPlanificata} onChange={(e) => setFields({ ...fields, dataPlanificata: e.currentTarget.value })} className={inputClass} />
        </Field>
        <Field id="d-scad" label="Scadentă în (zile)" error={error?.field === "zileScadenta" ? error.message : null}>
          <input id="d-scad" type="number" min={0} max={120} value={fields.zileScadenta} onChange={(e) => setFields({ ...fields, zileScadenta: e.currentTarget.value })} className={inputClass} />
        </Field>
      </div>
      <Field id="d-ment" label="Mențiuni pe factură (opțional)" error={error?.field === "mentiuni" ? error.message : null}>
        <textarea id="d-ment" rows={2} value={fields.mentiuni} onChange={(e) => setFields({ ...fields, mentiuni: e.currentTarget.value })} className={textareaClass} maxLength={1000} />
      </Field>
      {error && !error.field ? <Notice tone="error">{error.message}</Notice> : null}
      {result ? (
        <Notice tone={result.tone}>
          <span role="status">{result.text}</span>
        </Notice>
      ) : null}
      <div className="flex flex-wrap items-center gap-2 border-t border-hair pt-4">
        <button type="button" disabled={pending || !oblio} onClick={approve} className="btn btn-light !min-h-10 !px-4 !py-2 !text-[14px]">
          {pending ? "Se lucrează…" : "Aprobă și emite"}
        </button>
        <button type="button" disabled={pending} onClick={save} className="btn btn-ghost !min-h-10 !px-4 !py-2 !text-[14px]">
          Salvează ciorna
        </button>
        <button type="button" disabled={pending} onClick={discard} className="ml-auto text-[13px] text-dim underline underline-offset-4 hover:text-[var(--ap-error)]">
          Renunță la ciornă
        </button>
      </div>
      <p className="text-[12.5px] text-dim">„Aprobă și emite” emite factura în Oblio, o trimite în e-Factura, îi pune PDF-ul pe Drive și pregătește emailul. Emailul pleacă abia la „Trimite”.</p>
    </div>
  );
}

const PAS_ORDER: NumePas[] = ["emitere", "efactura", "drive", "email"];

function IssuedView({ invoice, oblio, email, actions, onChanged }: { invoice: Factura; oblio: boolean; email: boolean; actions: InvoiceActions; onChanged: () => void }) {
  const [result, setResult] = useState<{ tone: "ok" | "warn" | "error"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const failedStep = PAS_ORDER.some((name) => invoice.pasi[name]?.stare === "eroare") || invoice.starea === "eroare" || invoice.starea === "in_lucru";

  const retry = () =>
    start(async () => {
      setResult(null);
      const approved = await actions.approve(invoice.id);
      setResult(approved.ok ? { tone: approved.warning ? "warn" : "ok", text: approved.warning ?? approved.message ?? "Gata." } : { tone: "error", text: approved.message });
      onChanged();
    });

  return (
    <div className="grid gap-5">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[13.5px]">
        <dt className="text-dim">Emisă</dt>
        <dd className="text-bone">{invoice.dataEmiterii ? dayLabel(invoice.dataEmiterii) : "—"}</dd>
        <dt className="text-dim">Scadentă</dt>
        <dd className="text-bone">{dayLabel(invoice.scadenta)}</dd>
        <dt className="text-dim">Încasat</dt>
        <dd className="text-bone tabular-nums">
          {money(invoice.incasat, invoice.moneda)} din {money(invoice.total, invoice.moneda)}
          {invoice.incasataLa ? ` (ultima încasare ${dayLabel(invoice.incasataLa)})` : ""}
        </dd>
        <dt className="text-dim">e-Factura</dt>
        <dd className="text-bone">
          {einvoiceLabel(invoice.efacturaCod)}
          {invoice.efacturaText ? <span className="block text-[12.5px] text-dim">{invoice.efacturaText}</span> : null}
        </dd>
        <dt className="text-dim">Aprobată</dt>
        <dd className="text-bone">{invoice.aprobataLa ? `${dateTimeLabel(invoice.aprobataLa)}${invoice.aprobataDe ? `, ${invoice.aprobataDe}` : ""}` : "—"}</dd>
      </dl>

      <div className="flex flex-wrap gap-2">
        {invoice.linkOblio ? (
          <a href={invoice.linkOblio} target="_blank" rel="noreferrer" className="btn btn-ghost !min-h-9 !px-3.5 !py-1.5 !text-[13.5px]">
            <IconExternal size={15} />
            PDF-ul din Oblio
          </a>
        ) : null}
        {invoice.driveLink ? (
          <a href={invoice.driveLink} target="_blank" rel="noreferrer" className="btn btn-ghost !min-h-9 !px-3.5 !py-1.5 !text-[13.5px]">
            <IconExternal size={15} />
            Pe Drive
          </a>
        ) : null}
      </div>

      <section aria-labelledby="pasi">
        <h3 id="pasi" className={sectionTitle}>
          Pașii aprobării
        </h3>
        <ol className="mt-2 grid gap-1.5">
          {PAS_ORDER.map((name) => {
            const pas = invoice.pasi[name];
            return (
              <li key={name} className="flex items-start gap-2 text-[13.5px]">
                <Tag tone={!pas ? "muted" : pas.stare === "ok" ? "ok" : pas.stare === "eroare" ? "error" : "muted"} className="mt-0.5 shrink-0">
                  {!pas ? "în așteptare" : pas.stare === "ok" ? "făcut" : pas.stare === "eroare" ? "n-a mers" : "sărit"}
                </Tag>
                <span>
                  <span className="font-medium text-bone">{PAS_LABEL[name]}</span>
                  {pas?.mesaj ? <span className="block text-[12.5px] text-dim">{pas.mesaj}</span> : null}
                </span>
              </li>
            );
          })}
        </ol>
        {failedStep ? (
          <button type="button" disabled={pending || !oblio} onClick={retry} className="btn btn-ghost mt-3 !min-h-9 !px-3.5 !py-1.5 !text-[13.5px]">
            {pending ? "Se lucrează…" : "Reia pașii rămași"}
          </button>
        ) : null}
      </section>

      {result ? (
        <Notice tone={result.tone}>
          <span role="status">{result.text}</span>
        </Notice>
      ) : null}

      {invoice.emailStare !== "nepregatit" ? <EmailSection invoice={invoice} email={email} sendEmail={actions.sendEmail} onChanged={onChanged} /> : null}

      <p className="text-[12.5px] text-dim">Factura emisă nu se mai corectează aici. Anularea sau stornarea se fac în Oblio, de tine.</p>
    </div>
  );
}

function EmailSection({ invoice, email, sendEmail, onChanged }: { invoice: Factura; email: boolean; sendEmail: InvoiceActions["sendEmail"]; onChanged: () => void }) {
  const [fields, setFields] = useState({ to: invoice.emailCatre ?? "", subject: invoice.emailSubiect ?? "", text: invoice.emailText ?? "" });
  const [error, setError] = useState<{ field?: string; message: string } | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (invoice.emailStare === "trimis") {
    return (
      <section aria-labelledby="email-factura">
        <h3 id="email-factura" className={sectionTitle}>
          Emailul către client
        </h3>
        <p className="mt-2 text-[13.5px] text-bone">
          Trimis {dateTimeLabel(invoice.emailTrimisLa)} către {invoice.emailCatre}, cu PDF-ul atașat.
        </p>
      </section>
    );
  }

  return (
    <section aria-labelledby="email-factura" className="rounded-xl border border-hair p-3">
      <h3 id="email-factura" className={sectionTitle}>
        Emailul către client — pleacă doar la „Trimite”
      </h3>
      {invoice.emailStare === "esuat" ? <p className="mt-2 text-[13px] text-[var(--ap-error)]">Încercarea de dinainte n-a plecat. Verifică adresa și trimite din nou.</p> : null}
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          start(async () => {
            setError(null);
            const result = await sendEmail(invoice.id, fields);
            if (!result.ok) {
              setError({ field: result.field, message: result.message });
              return;
            }
            setSent(result.message ?? "Trimis.");
            onChanged();
          });
        }}
        className="mt-3 grid gap-3"
      >
        <Field id="e-to" label="Către" error={error?.field === "to" ? error.message : null} hint="Mai multe adrese, despărțite prin virgulă.">
          <input id="e-to" value={fields.to} onChange={(e) => setFields({ ...fields, to: e.currentTarget.value })} className={inputClass} />
        </Field>
        <Field id="e-subj" label="Subiectul" error={error?.field === "subject" ? error.message : null}>
          <input id="e-subj" value={fields.subject} onChange={(e) => setFields({ ...fields, subject: e.currentTarget.value })} className={inputClass} maxLength={300} />
        </Field>
        <Field id="e-text" label="Textul" error={error?.field === "text" ? error.message : null} hint={`Atașat: PDF-ul facturii ${invoiceName(invoice)}, luat din Oblio la trimitere.`}>
          <textarea id="e-text" rows={7} value={fields.text} onChange={(e) => setFields({ ...fields, text: e.currentTarget.value })} className={textareaClass} maxLength={5000} />
        </Field>
        {error && !error.field ? <Notice tone="error">{error.message}</Notice> : null}
        {sent ? (
          <Notice tone="ok">
            <span role="status">{sent}</span>
          </Notice>
        ) : null}
        <button type="submit" disabled={pending || !email} className={cn("btn btn-light justify-self-start !min-h-10 !px-4 !py-2 !text-[14px]")}>
          {pending ? "Se trimite…" : "Trimite emailul"}
        </button>
        {!email ? <p className="text-[12.5px] text-dim">Emailul nu e configurat (RESEND_API_KEY lipsește în Vercel).</p> : null}
      </form>
    </section>
  );
}
