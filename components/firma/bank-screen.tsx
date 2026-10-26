"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import type { ColumnMap } from "@/lib/firma/csv";
import type { ImportOutcome, ImportRow, StatementPreview, Tranzactie } from "@/lib/firma/incasari";
import { dateTimeLabel, dayLabel, money, monthLabel } from "@/lib/firma/format";
import { cn } from "@/lib/utils";
import { IconExternal, IconUpload } from "./icons";
import { Empty, Field, inputClass, Notice, Tag, tdClass, thClass, type Tone } from "./ui";

type Simple = { ok: true; message?: string } | { ok: false; message: string };

export interface BankActions {
  prepare: (type: string, size: number) => Promise<{ ok: true; path: string; uploadUrl: string } | { ok: false; message: string }>;
  preview: (path: string) => Promise<{ ok: true; preview: StatementPreview } | { ok: false; message: string }>;
  importStatement: (raw: unknown) => Promise<{ ok: true; outcome: ImportOutcome } | { ok: false; message: string }>;
  confirm: (lineId: string, targetId: string) => Promise<Simple>;
  ignore: (lineId: string) => Promise<Simple>;
  rematch: () => Promise<Simple>;
}

interface BankData {
  lines: Tranzactie[];
  imports: ImportRow[];
  openInvoices: { id: string; nume: string }[];
  openExpenses: { id: string; nume: string }[];
}

const POTRIVIRE: Record<Tranzactie["potrivire"], { label: string; tone: Tone }> = {
  sigura: { label: "Potrivită sigur", tone: "ok" },
  confirmata: { label: "Confirmată", tone: "ok" },
  de_confirmat: { label: "De confirmat", tone: "warn" },
  nepotrivita: { label: "Nepotrivită", tone: "neutral" },
  ignorata: { label: "Ignorată", tone: "muted" },
};

const OBLIO: Record<Tranzactie["oblioIncasare"], string | null> = { nu: null, facuta: "încasată în Oblio", sarita: "era deja în Oblio", eroare: "nemarcată în Oblio" };

function put(url: string, file: File, type: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (anon) xhr.setRequestHeader("apikey", anon);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.setRequestHeader("content-type", type);
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`http_${xhr.status}`)));
    xhr.onerror = () => reject(new Error("network"));
    xhr.send(file);
  });
}

export function BankScreen({ data, month, oblio, actions }: { data: BankData; month: string; oblio: boolean; actions: BankActions }) {
  const router = useRouter();
  const [notice, setNotice] = useState<{ tone: "ok" | "warn" | "error"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const pendingLines = data.lines.filter((line) => line.potrivire === "de_confirmat" || (line.potrivire === "nepotrivita" && line.directie === "in"));
  const incoming = data.lines.filter((line) => line.directie === "in").reduce((sum, line) => sum + line.suma, 0);
  const outgoing = data.lines.filter((line) => line.directie === "out").reduce((sum, line) => sum + line.suma, 0);

  return (
    <>
      {!oblio ? <Notice tone="warn" className="mt-5">Oblio nu e legat: potrivirile se fac, dar încasările nu se pot marca în Oblio până nu legi cheile.</Notice> : null}
      <ImportCard actions={actions} onImported={() => router.refresh()} />

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[14px] text-bone">
          <span className="font-semibold">{monthLabel(month)}:</span> încasat {money(incoming, "RON")} · plătit {money(Math.abs(outgoing), "RON")}
        </p>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const done = await actions.rematch();
              setNotice(done.ok ? { tone: "ok", text: done.message ?? "Gata." } : { tone: "error", text: done.message });
              router.refresh();
            })
          }
          className="btn btn-ghost !min-h-9 !px-3.5 !py-1.5 !text-[13.5px]"
        >
          Potrivește din nou
        </button>
      </div>
      {notice ? (
        <Notice tone={notice.tone} className="mt-3">
          <span role="status">{notice.text}</span>
        </Notice>
      ) : null}

      {pendingLines.length > 0 ? (
        <section aria-labelledby="de-confirmat" className="mt-5">
          <h2 id="de-confirmat" className="text-[15px] font-semibold text-bone">
            De confirmat ({pendingLines.length})
          </h2>
          <p className="mt-0.5 text-[13px] text-dim">Încasări pe care adminul nu le-a putut lega sigur. Alege factura (încasarea se marchează în Oblio) sau ignoră rândul.</p>
          <ul className="mt-3 grid gap-2">
            {pendingLines.map((line) => (
              <ConfirmRow
                key={line.id}
                line={line}
                options={line.directie === "in" ? data.openInvoices : data.openExpenses}
                actions={actions}
                // Rândul confirmat pleacă din listă: rezultatul rămâne sus, pe pagină.
                onDone={(text) => {
                  if (text) setNotice(text);
                  router.refresh();
                }}
              />
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="randuri" className="mt-7">
        <h2 id="randuri" className="text-[15px] font-semibold text-bone">
          Rândurile din {monthLabel(month)}
        </h2>
        {data.lines.length === 0 ? (
          <Empty className="mt-3">Niciun rând din {monthLabel(month)}. Urcă exportul CSV din BT Go mai sus.</Empty>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-xl border border-hair bg-white">
            <table className="ads-table min-w-full border-collapse">
              <thead>
                <tr className="border-b border-hair">
                  <th className={thClass}>Data</th>
                  <th className={cn(thClass, "text-right")}>Suma</th>
                  <th className={thClass}>De la / către</th>
                  <th className={thClass}>Potrivire</th>
                  <th className={thClass}>Legat de</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hair">
                {data.lines.map((line) => (
                  <tr key={line.id}>
                    <td className={cn(tdClass, "whitespace-nowrap text-[13px]")}>{dayLabel(line.data)}</td>
                    <td className={cn(tdClass, "whitespace-nowrap text-right tabular-nums", line.suma > 0 ? "text-[var(--ap-ok)]" : "text-bone")}>
                      {line.suma > 0 ? "+" : "−"}
                      {money(Math.abs(line.suma), line.moneda)}
                    </td>
                    <td className={cn(tdClass, "min-w-[14rem]")}>
                      <p className="font-medium">{line.contrapartida ?? "—"}</p>
                      <p className="max-w-[22rem] truncate text-[12.5px] text-dim" title={line.detalii ?? undefined}>
                        {line.detalii ?? ""}
                      </p>
                    </td>
                    <td className={tdClass}>
                      <Tag tone={POTRIVIRE[line.potrivire].tone}>{POTRIVIRE[line.potrivire].label}</Tag>
                      {OBLIO[line.oblioIncasare] ? <p className={cn("mt-1 text-[12px]", line.oblioIncasare === "eroare" ? "text-[var(--ap-error)]" : "text-dim")} title={line.oblioMesaj ?? undefined}>{OBLIO[line.oblioIncasare]}</p> : null}
                    </td>
                    <td className={cn(tdClass, "text-[13px]")}>{line.facturaNume ?? line.cheltuialaNume ?? <span className="text-dim">{line.motiv ?? "—"}</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {data.imports.length > 0 ? (
        <section aria-labelledby="importuri" className="mt-7">
          <h2 id="importuri" className="text-[15px] font-semibold text-bone">
            Importurile
          </h2>
          <ul className="mt-2 divide-y divide-hair rounded-xl border border-hair bg-white">
            {data.imports.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-[13.5px]">
                <span>
                  <span className="font-medium text-bone">{item.fisierNume}</span>
                  <span className="text-dim">
                    {" "}
                    · {dayLabel(item.deLa)} – {dayLabel(item.panaLa)} · {item.noi} noi{item.duplicate ? `, ${item.duplicate} deja importate` : ""} · {dateTimeLabel(item.createdAt)}
                  </span>
                </span>
                {item.driveLink ? (
                  <a href={item.driveLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[13px] text-[var(--md-a1)] underline underline-offset-4">
                    Pe Drive <IconExternal size={13} />
                  </a>
                ) : item.driveMesaj ? (
                  <span className="text-[12.5px] text-dim" title={item.driveMesaj}>
                    nu e pe Drive
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}

function ConfirmRow({
  line,
  options,
  actions,
  onDone,
}: {
  line: Tranzactie;
  options: { id: string; nume: string }[];
  actions: BankActions;
  onDone: (notice?: { tone: "ok" | "warn" | "error"; text: string }) => void;
}) {
  const [choice, setChoice] = useState(line.candidati[0]?.id ?? "");
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const others = options.filter((option) => !line.candidati.some((candidate) => candidate.id === option.id));
  return (
    <li className="rounded-xl border border-hair bg-white p-3 text-[13.5px]">
      <p>
        <span className="font-semibold tabular-nums text-[var(--ap-ok)]">+{money(line.suma, line.moneda)}</span> · {dayLabel(line.data)} · <span className="font-medium">{line.contrapartida ?? "fără nume"}</span>
      </p>
      <p className="mt-0.5 text-dim">{line.detalii ?? ""}</p>
      <p className="mt-1 text-[12.5px] text-dim">De ce: {line.motiv}</p>
      <fieldset className="mt-2 grid gap-1">
        <legend className="sr-only">Factura plătită</legend>
        {line.candidati.map((candidate) => (
          <label key={candidate.id} className="flex items-start gap-2">
            <input type="radio" name={`c-${line.id}`} value={candidate.id} checked={choice === candidate.id} onChange={() => setChoice(candidate.id)} className="mt-1" />
            <span>
              {candidate.nume} <span className="text-[12px] text-dim">({candidate.motiv})</span>
            </span>
          </label>
        ))}
        <label className="mt-1 flex flex-wrap items-center gap-2">
          <span className="text-dim">Altă factură:</span>
          <select
            value={line.candidati.some((candidate) => candidate.id === choice) ? "" : choice}
            onChange={(event) => setChoice(event.currentTarget.value)}
            className={cn(inputClass, "!h-9 max-w-full sm:max-w-md")}
          >
            <option value="">—</option>
            {others.map((option) => (
              <option key={option.id} value={option.id}>
                {option.nume}
              </option>
            ))}
          </select>
        </label>
      </fieldset>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={pending || !choice}
          onClick={() =>
            start(async () => {
              const done = await actions.confirm(line.id, choice);
              if (!done.ok) {
                setMessage({ tone: "error", text: done.message });
                return;
              }
              const warn = /n-a putut/.test(done.message ?? "");
              onDone({ tone: warn ? "warn" : "ok", text: `${money(line.suma, line.moneda)} de la ${line.contrapartida ?? "plătitor"}: ${done.message ?? "legat."}` });
            })
          }
          className="btn btn-light !min-h-9 !px-3.5 !py-1.5 !text-[13.5px]"
        >
          Confirmă
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const done = await actions.ignore(line.id);
              if (!done.ok) setMessage({ tone: "error", text: done.message });
              onDone();
            })
          }
          className="btn btn-ghost !min-h-9 !px-3.5 !py-1.5 !text-[13.5px]"
        >
          Ignoră (nu e o factură)
        </button>
        {message ? (
          <span role="status" className={cn("text-[13px]", message.tone === "ok" ? "text-[var(--ap-ok)]" : "text-[var(--ap-error)]")}>
            {message.text}
          </span>
        ) : null}
      </div>
    </li>
  );
}

const COLUMN_LABEL: { key: keyof ColumnMap; label: string; required?: boolean }[] = [
  { key: "data", label: "Data tranzacției", required: true },
  { key: "suma", label: "Suma (o coloană, cu semn)" },
  { key: "debit", label: "sau Debit (plăți)" },
  { key: "credit", label: "și Credit (încasări)" },
  { key: "detalii", label: "Detaliile plății", required: true },
  { key: "contrapartida", label: "Plătitor / beneficiar" },
  { key: "referinta", label: "Referința" },
  { key: "moneda", label: "Moneda" },
];

function ImportCard({ actions, onImported }: { actions: BankActions; onImported: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<{ name: string; path: string } | null>(null);
  const [preview, setPreview] = useState<StatementPreview | null>(null);
  const [columns, setColumns] = useState<ColumnMap | null>(null);
  const [headerRow, setHeaderRow] = useState(0);
  const [formatName, setFormatName] = useState("Export BT Go");
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "warn" | "error"; text: string } | null>(null);
  const [pending, start] = useTransition();

  const pick = (list: FileList | null) => {
    const chosen = list?.[0];
    if (!chosen) return;
    start(async () => {
      setMessage(null);
      setPreview(null);
      const type = chosen.type || "text/csv";
      const prepared = await actions.prepare(type, chosen.size);
      if (!prepared.ok) {
        setMessage({ tone: "error", text: prepared.message });
        return;
      }
      try {
        await put(prepared.uploadUrl, chosen, type);
      } catch {
        setMessage({ tone: "error", text: "Urcarea s-a întrerupt. Încearcă din nou." });
        return;
      }
      const found = await actions.preview(prepared.path);
      if (!found.ok) {
        setMessage({ tone: "error", text: found.message });
        return;
      }
      setFile({ name: chosen.name, path: prepared.path });
      setPreview(found.preview);
      setColumns(found.preview.suggestion);
      setHeaderRow(found.preview.headerRow);
      setFormatName(found.preview.known?.nume ?? "Export BT Go");
      setEditing(!found.preview.known);
      if (input.current) input.current.value = "";
    });
  };

  const run = () => {
    if (!file || !preview || !columns) return;
    start(async () => {
      setMessage(null);
      const done = await actions.importStatement({ path: file.path, name: file.name, headerRow, delimiter: preview.delimiter, encoding: preview.encoding, formatName, columns });
      if (!done.ok) {
        setMessage({ tone: "error", text: done.message });
        return;
      }
      const o = done.outcome;
      setMessage({
        tone: o.collectErrors || o.skipped.length ? "warn" : "ok",
        text: `${o.added} rânduri noi${o.duplicates ? `, ${o.duplicates} deja importate (sărite)` : ""}. ${o.sure} potrivite sigur${o.collected ? ` (${o.collected} încasări în Oblio)` : ""}, ${o.toConfirm} de confirmat.${o.collectErrors ? ` ${o.collectErrors} încasări n-au putut fi marcate în Oblio — vezi rândurile.` : ""}${o.skipped.length ? ` ${o.skipped.length} rânduri sărite (ex. rândul ${o.skipped[0].row}: ${o.skipped[0].reason}).` : ""}${o.driveMessage ? ` Drive: ${o.driveMessage}` : " Extrasul e pe Drive."}`,
      });
      setPreview(null);
      setFile(null);
      onImported();
    });
  };

  const header = preview?.rows[headerRow] ?? [];
  return (
    <section aria-labelledby="import" className="mt-5 rounded-xl border border-dashed border-hair-strong bg-[var(--ap-side)] p-4">
      <h2 id="import" className="text-[15px] font-semibold text-bone">
        Importă exportul din BT Go
      </h2>
      <p className="mt-0.5 text-[13px] text-dim">În BT Go: Conturi → Tranzacții → Export, format CSV. Aceleași rânduri importate de două ori nu se dublează.</p>
      <input ref={input} id="urca-extras" type="file" accept=".csv,text/csv,text/plain" className="sr-only" onChange={(event) => pick(event.currentTarget.files)} />
      <label htmlFor="urca-extras" className="btn btn-light mt-3 cursor-pointer !min-h-10 !px-4 !py-2 !text-[14px]">
        <IconUpload size={16} />
        {pending && !preview ? "Se citește…" : "Alege fișierul CSV"}
      </label>

      {preview && columns ? (
        <div className="mt-4 grid gap-3">
          {preview.known && !editing ? (
            <Notice tone="ok">
              Format recunoscut: „{preview.known.nume}”. Coloanele alese data trecută se aplică singure.{" "}
              <button type="button" onClick={() => setEditing(true)} className="underline underline-offset-4">
                Schimbă coloanele
              </button>
            </Notice>
          ) : (
            <>
              <p className="text-[13.5px] text-bone">
                Prima dată alegi tu ce e în fiecare coloană (am propus după numele din antet — verifică). Alegerea se ține minte pentru exporturile cu același antet.
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field id="imp-antet" label="Rândul antetului (de la 1)">
                  <input id="imp-antet" type="number" min={1} max={30} value={headerRow + 1} onChange={(e) => setHeaderRow(Math.max(0, Number(e.currentTarget.value) - 1))} className={inputClass} />
                </Field>
                <Field id="imp-nume" label="Numele formatului">
                  <input id="imp-nume" value={formatName} onChange={(e) => setFormatName(e.currentTarget.value)} className={inputClass} maxLength={120} />
                </Field>
                <p className="self-end pb-2 text-[12.5px] text-dim">
                  Separator „{preview.delimiter === "tab" ? "tab" : preview.delimiter}”, codare {preview.encoding}, {preview.totalRows} rânduri.
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {COLUMN_LABEL.map(({ key, label, required }) => (
                  <Field key={key} id={`col-${key}`} label={label + (required ? "" : " (opțional)")}>
                    <select
                      id={`col-${key}`}
                      value={columns[key] === null ? "" : String(columns[key])}
                      onChange={(e) => setColumns({ ...columns, [key]: e.currentTarget.value === "" ? null : Number(e.currentTarget.value) })}
                      className={inputClass}
                    >
                      {required ? null : <option value="">—</option>}
                      {header.map((cell, index) => (
                        <option key={index} value={index}>
                          {index + 1}. {cell || "(fără nume)"}
                        </option>
                      ))}
                    </select>
                  </Field>
                ))}
              </div>
            </>
          )}
          <div className="overflow-x-auto rounded-lg border border-hair bg-white">
            <table className="min-w-full border-collapse text-[12.5px]">
              <tbody>
                {preview.rows.slice(0, Math.min(preview.rows.length, headerRow + 6)).map((row, index) => (
                  <tr key={index} className={cn("border-b border-hair", index === headerRow && "bg-[var(--ap-accent-soft)] font-semibold")}>
                    <td className="px-2 py-1 text-dim">{index + 1}</td>
                    {row.map((cell, cellIndex) => (
                      <td key={cellIndex} className="max-w-[12rem] truncate px-2 py-1">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={pending} onClick={run} className="btn btn-light !min-h-10 !px-4 !py-2 !text-[14px]">
              {pending ? "Se importă…" : `Importă ${file?.name ?? ""}`}
            </button>
            <button type="button" disabled={pending} onClick={() => setPreview(null)} className="btn btn-ghost !min-h-10 !px-4 !py-2 !text-[14px]">
              Renunță
            </button>
          </div>
        </div>
      ) : null}
      {message ? (
        <Notice tone={message.tone} className="mt-3">
          <span role="status">{message.text}</span>
        </Notice>
      ) : null}
    </section>
  );
}
