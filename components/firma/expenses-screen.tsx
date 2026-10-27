"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { CATEGORIE_LABEL, dataState, type Cheltuiala } from "@/lib/firma/cheltuieli-shared";
import { dayLabel, money, monthLabel, parseAmount, todayIso } from "@/lib/firma/format";
import { cn } from "@/lib/utils";
import { SidePanel } from "./panel";
import { IconExternal, IconUpload } from "./icons";
import { Empty, Field, inputClass, Notice, Tag, tdClass, textareaClass, thClass } from "./ui";

type Result = { ok: true; message?: string; warning?: string | null } | { ok: false; field?: string; message: string };

export interface ExpenseActions {
  prepareUpload: (type: string, size: number) => Promise<{ ok: true; path: string; uploadUrl: string } | { ok: false; message: string }>;
  finishUpload: (input: { path: string; name: string; type: string }) => Promise<Result & { id?: string }>;
  save: (id: string, raw: unknown) => Promise<Result>;
  reread: (id: string) => Promise<Result>;
  hide: (id: string) => Promise<Result>;
  preview: (id: string) => Promise<{ ok: true; url: string; type: string } | { ok: false; message: string }>;
}

interface UploadItem {
  key: string;
  name: string;
  stage: "micsorez" | "urc" | "citesc" | "gata" | "eroare";
  progress: number;
  message: string | null;
  id: string | null;
}

const STAGE_LABEL: Record<UploadItem["stage"], string> = {
  micsorez: "Se pregătește…",
  urc: "Se urcă",
  citesc: "Se citește…",
  gata: "Gata",
  eroare: "N-a mers",
};

/** Poza se micșorează la 2400 px pe latura lungă (JPEG 0,88): urcă repede și rămâne lizibilă. PDF-ul rămâne cum e. */
async function shrink(file: File): Promise<File> {
  const type = file.type || (/\.heic$/i.test(file.name) ? "image/heic" : "");
  if (!type.startsWith("image/") || type === "image/gif") return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 2400 / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && type === "image/jpeg" && file.size < 3 * 1024 * 1024) return file;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.88));
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.[a-z0-9]+$/i, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    // Formatul nu se poate desena aici (ex. HEIC în Chrome): se urcă originalul.
    return type === file.type ? file : new File([file], file.name, { type });
  }
}

function put(url: string, file: File, onProgress: (share: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (anon) xhr.setRequestHeader("apikey", anon);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.setRequestHeader("content-type", file.type);
    xhr.upload.onprogress = (event) => event.lengthComputable && onProgress(event.loaded / event.total);
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`http_${xhr.status}`)));
    xhr.onerror = () => reject(new Error("network"));
    xhr.send(file);
  });
}

export function ExpensesScreen({
  expenses,
  month,
  ocr,
  drive,
  initialOpen,
  actions,
}: {
  expenses: Cheltuiala[];
  month: string;
  ocr: boolean;
  drive: boolean;
  initialOpen: string | null;
  actions: ExpenseActions;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [open, setOpen] = useState<string | null>(initialOpen);
  const openExpense = expenses.find((expense) => expense.id === open) ?? null;
  const update = (key: string, change: Partial<UploadItem>) => setUploads((items) => items.map((item) => (item.key === key ? { ...item, ...change } : item)));

  const upload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const list = Array.from(files);
    const items = list.map((file, index) => ({ key: `${Date.now()}-${index}`, name: file.name, stage: "micsorez" as const, progress: 0, message: null, id: null }));
    setUploads((current) => [...items, ...current]);
    for (const [index, original] of list.entries()) {
      const key = items[index].key;
      try {
        const file = await shrink(original);
        const prepared = await actions.prepareUpload(file.type, file.size);
        if (!prepared.ok) {
          update(key, { stage: "eroare", message: prepared.message });
          continue;
        }
        update(key, { stage: "urc" });
        await put(prepared.uploadUrl, file, (share) => update(key, { progress: share }));
        update(key, { stage: "citesc", progress: 1 });
        const finished = await actions.finishUpload({ path: prepared.path, name: original.name, type: file.type });
        if (!finished.ok) update(key, { stage: "eroare", message: finished.message });
        else update(key, { stage: "gata", message: [finished.message, finished.warning].filter(Boolean).join(" "), id: finished.id ?? null });
      } catch {
        update(key, { stage: "eroare", message: "Urcarea s-a întrerupt. Verifică internetul și încearcă din nou." });
      }
    }
    if (input.current) input.current.value = "";
    router.refresh();
  };

  const totals = new Map<string, number>();
  for (const expense of expenses) if (expense.suma !== null) totals.set(expense.moneda, (totals.get(expense.moneda) ?? 0) + expense.suma);
  const byCategory = Object.keys(CATEGORIE_LABEL).map((key) => ({
    key,
    sum: expenses.filter((expense) => expense.categoria === key && expense.moneda === "RON" && expense.suma !== null).reduce((sum, expense) => sum + (expense.suma ?? 0), 0),
  }));
  const toCheck = expenses.filter((expense) => !expense.confirmata).length;

  return (
    <>
      {!ocr ? <Notice className="mt-5">Citirea automată nu e legată (ANTHROPIC_API_KEY lipsește în Vercel): fișierele se urcă, iar datele le completezi tu.</Notice> : null}
      {!drive ? <Notice className="mt-3">Drive-ul nu e legat: fișierele stau în admin până îl legi (Setări → Drive).</Notice> : null}

      <div className="mt-5 rounded-xl border border-dashed border-hair-strong bg-[var(--ap-side)] p-4 sm:p-5">
        <input ref={input} id="urca-cheltuiala" type="file" accept="image/*,application/pdf" multiple className="sr-only" onChange={(event) => upload(event.currentTarget.files)} />
        <label htmlFor="urca-cheltuiala" className="btn btn-light w-full cursor-pointer justify-center !min-h-12 !text-[15px] sm:w-auto sm:!px-5">
          <IconUpload size={18} />
          Urcă un bon sau o factură
        </label>
        <p className="mt-2 text-[13px] text-dim">Pe telefon poți face poza direct. Merg și mai multe odată. Poză (JPEG, PNG) sau PDF, până la 20 MB.</p>
        {uploads.length > 0 ? (
          <ul className="mt-3 grid gap-1.5" aria-live="polite">
            {uploads.map((item) => (
              <li key={item.key} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-white px-3 py-2 text-[13.5px]">
                <span className="min-w-0 flex-1 truncate font-medium text-bone">{item.name}</span>
                <Tag tone={item.stage === "gata" ? "ok" : item.stage === "eroare" ? "error" : "accent"}>
                  {STAGE_LABEL[item.stage]}
                  {item.stage === "urc" ? ` ${Math.round(item.progress * 100)}%` : ""}
                </Tag>
                {item.message ? <span className={cn("w-full text-[12.5px]", item.stage === "eroare" ? "text-[var(--ap-error)]" : "text-dim")}>{item.message}</span> : null}
                {item.id ? (
                  <button type="button" onClick={() => setOpen(item.id)} className="text-[12.5px] font-medium text-[var(--md-a1)] underline underline-offset-4">
                    Verifică
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="mt-5 flex flex-wrap items-baseline gap-x-6 gap-y-1">
        <p className="text-[14px] text-bone">
          <span className="font-semibold">Total în {monthLabel(month)}:</span> {[...totals.entries()].map(([currency, sum]) => money(sum, currency)).join(" + ") || "—"}
        </p>
        {toCheck > 0 ? <p className="text-[13.5px] text-[var(--ap-warn)]">{toCheck === 1 ? "O cheltuială" : `${toCheck} cheltuieli`} de verificat</p> : null}
      </div>
      {expenses.length > 0 ? (
        <ul className="mt-2 flex flex-wrap gap-2">
          {byCategory
            .filter((item) => item.sum > 0)
            .map((item) => (
              <li key={item.key} className="rounded-lg border border-hair bg-white px-3 py-1.5 text-[13px]">
                {CATEGORIE_LABEL[item.key as keyof typeof CATEGORIE_LABEL]}: <span className="font-semibold tabular-nums">{money(item.sum, "RON")}</span>
              </li>
            ))}
        </ul>
      ) : null}

      {expenses.length === 0 ? (
        <Empty className="mt-4">Nicio cheltuială în {monthLabel(month)}. Fă o poză primului bon cu „Urcă un bon sau o factură”.</Empty>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl border border-hair bg-white">
          <table className="ads-table min-w-full border-collapse">
            <thead>
              <tr className="border-b border-hair">
                <th className={cn(thClass, "ads-sticky-col")}>Furnizor</th>
                <th className={thClass}>Data</th>
                <th className={thClass}>Categoria</th>
                <th className={cn(thClass, "text-right")}>Suma</th>
                <th className={thClass}>Date</th>
                <th className={thClass}>Drive</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hair">
              {expenses.map((expense) => {
                const state = dataState(expense);
                return (
                  <tr key={expense.id} onClick={() => setOpen(expense.id)} className={cn("cursor-pointer bg-white hover:bg-[var(--ap-hover)]", open === expense.id && "bg-[var(--ap-accent-soft)]")}>
                    <td className={cn(tdClass, "ads-sticky-col min-w-[12rem]")}>
                      <button type="button" onClick={() => setOpen(expense.id)} className="text-left font-semibold text-bone hover:text-[var(--md-a1)] hover:underline">
                        {expense.furnizor ?? <span className="text-dim">necitit — {expense.fisierNume}</span>}
                      </button>
                      <p className="mt-0.5 max-w-[16rem] truncate text-[12.5px] text-dim">{[expense.nrDocument, expense.descriere].filter(Boolean).join(" · ") || "—"}</p>
                    </td>
                    <td className={cn(tdClass, "whitespace-nowrap text-[13px]")}>{dayLabel(expense.dataDoc)}</td>
                    <td className={cn(tdClass, "text-[13px]")}>{CATEGORIE_LABEL[expense.categoria]}</td>
                    <td className={cn(tdClass, "whitespace-nowrap text-right tabular-nums")}>{money(expense.suma, expense.moneda === "altele" ? "" : expense.moneda)}</td>
                    <td className={tdClass}>
                      <Tag tone={state.tone}>{state.label}</Tag>
                    </td>
                    <td className={cn(tdClass, "text-[13px]")}>
                      {expense.driveLink ? <Tag tone="ok">Pe Drive</Tag> : expense.driveMesaj ? <span className="text-[var(--ap-warn)]" title={expense.driveMesaj}>nu încă</span> : <span className="text-dim">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {open ? (
        <ExpensePanel
          key={open}
          expense={openExpense}
          month={month}
          actions={actions}
          onChanged={() => router.refresh()}
          // Data schimbată în altă lună: cheltuiala trece acolo, iar panoul o urmează.
          onMoved={(toMonth, id) => router.push(`?luna=${toMonth}&rand=${id}`, { scroll: false })}
          onClose={() => setOpen(null)}
        />
      ) : null}
    </>
  );
}

function ExpensePanel({
  expense,
  month,
  actions,
  onChanged,
  onMoved,
  onClose,
}: {
  expense: Cheltuiala | null;
  month: string;
  actions: ExpenseActions;
  onChanged: () => void;
  onMoved: (toMonth: string, id: string) => void;
  onClose: () => void;
}) {
  const [preview, setPreview] = useState<{ url: string; type: string } | null>(null);
  const [fields, setFields] = useState({
    furnizor: expense?.furnizor ?? "",
    furnizorCui: expense?.furnizorCui ?? "",
    nrDocument: expense?.nrDocument ?? "",
    dataDoc: expense?.dataDoc ?? todayIso(),
    suma: expense?.suma !== null && expense?.suma !== undefined ? String(expense.suma) : "",
    moneda: expense?.moneda ?? "RON",
    categoria: expense?.categoria ?? "altele",
    descriere: expense?.descriere ?? "",
  });
  const [error, setError] = useState<{ field?: string; message: string } | null>(null);
  const [result, setResult] = useState<{ tone: "ok" | "warn" | "error"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const previewAction = useRef(actions.preview);

  useEffect(() => {
    if (!expense) return;
    let live = true;
    previewAction.current(expense.id).then((found) => live && found.ok && setPreview({ url: found.url, type: found.type }));
    return () => {
      live = false;
    };
  }, [expense]);

  if (!expense) {
    return (
      <SidePanel title="Cheltuiala" onClose={onClose}>
        <p className="text-[14px] text-dim">Se încarcă… Dacă nu apare, cheltuiala e în altă lună.</p>
      </SidePanel>
    );
  }
  const fieldError = (field: string) => (error?.field === field ? error.message : null);
  const state = dataState(expense);

  return (
    <SidePanel title={expense.furnizor ?? expense.fisierNume} subtitle={<Tag tone={state.tone}>{state.label}</Tag>} onClose={onClose}>
      <div className="grid gap-4">
        {preview ? (
          preview.type === "application/pdf" ? (
            <a href={preview.url} target="_blank" rel="noreferrer" className="btn btn-ghost justify-self-start !min-h-9 !px-3.5 !py-1.5 !text-[13.5px]">
              <IconExternal size={15} />
              Deschide PDF-ul
            </a>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element -- link semnat, temporar, din stocarea privată
            <img src={preview.url} alt={`Documentul încărcat: ${expense.fisierNume}`} className="max-h-72 w-full rounded-lg border border-hair bg-[var(--ap-side)] object-contain" />
          )
        ) : (
          <p className="text-[13px] text-dim">Se încarcă documentul…</p>
        )}
        {expense.citireMesaj ? <Notice tone={expense.citireStare === "eroare" ? "warn" : "neutral"}>{expense.citireMesaj}</Notice> : null}
        {expense.citireStare === "ok" && !expense.confirmata ? <p className="text-[13px] text-dim">Datele de mai jos sunt citite automat. Verifică-le și apasă „Salvează”.</p> : null}

        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            const suma = parseAmount(fields.suma);
            if (suma === null) {
              setError({ field: "suma", message: "Scrie suma (ex. 49,99 sau 1.200)." });
              return;
            }
            start(async () => {
              setError(null);
              setResult(null);
              const saved = await actions.save(expense.id, { ...fields, suma });
              if (!saved.ok) {
                setError({ field: saved.field, message: saved.message });
                return;
              }
              setResult({ tone: saved.warning ? "warn" : "ok", text: [saved.message, saved.warning].filter(Boolean).join(" ") });
              if (fields.dataDoc.slice(0, 7) !== month) onMoved(fields.dataDoc.slice(0, 7), expense.id);
              else onChanged();
            });
          }}
          className="grid gap-3"
        >
          <Field id="ch-furnizor" label="Furnizorul" error={fieldError("furnizor")}>
            <input id="ch-furnizor" value={fields.furnizor} onChange={(e) => setFields({ ...fields, furnizor: e.currentTarget.value })} className={inputClass} maxLength={200} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field id="ch-cui" label="CUI furnizor (opțional)" error={fieldError("furnizorCui")}>
              <input id="ch-cui" value={fields.furnizorCui} onChange={(e) => setFields({ ...fields, furnizorCui: e.currentTarget.value })} className={inputClass} maxLength={20} />
            </Field>
            <Field id="ch-nr" label="Nr. document (opțional)" error={fieldError("nrDocument")}>
              <input id="ch-nr" value={fields.nrDocument} onChange={(e) => setFields({ ...fields, nrDocument: e.currentTarget.value })} className={inputClass} maxLength={60} />
            </Field>
            <Field id="ch-data" label="Data documentului" error={fieldError("dataDoc")}>
              <input id="ch-data" type="date" value={fields.dataDoc} onChange={(e) => setFields({ ...fields, dataDoc: e.currentTarget.value })} className={inputClass} />
            </Field>
            <div className="grid grid-cols-[1fr_6rem] gap-2">
              <Field id="ch-suma" label="Suma" error={fieldError("suma")}>
                <input id="ch-suma" inputMode="decimal" value={fields.suma} onChange={(e) => setFields({ ...fields, suma: e.currentTarget.value })} className={inputClass} />
              </Field>
              <Field id="ch-moneda" label="Moneda">
                <select id="ch-moneda" value={fields.moneda} onChange={(e) => setFields({ ...fields, moneda: e.currentTarget.value as typeof fields.moneda })} className={inputClass}>
                  <option value="RON">RON</option>
                  <option value="EUR">EUR</option>
                  <option value="USD">USD</option>
                  <option value="altele">altele</option>
                </select>
              </Field>
            </div>
          </div>
          <Field id="ch-cat" label="Categoria">
            <select id="ch-cat" value={fields.categoria} onChange={(e) => setFields({ ...fields, categoria: e.currentTarget.value as typeof fields.categoria })} className={inputClass}>
              {Object.entries(CATEGORIE_LABEL).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <Field id="ch-desc" label="Ce s-a cumpărat (opțional)" error={fieldError("descriere")}>
            <textarea id="ch-desc" rows={2} value={fields.descriere} onChange={(e) => setFields({ ...fields, descriere: e.currentTarget.value })} className={textareaClass} maxLength={500} />
          </Field>
          {error && !error.field ? <Notice tone="error">{error.message}</Notice> : null}
          {result ? (
            <Notice tone={result.tone}>
              <span role="status">{result.text}</span>
            </Notice>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <button type="submit" disabled={pending} className="btn btn-light !min-h-10 !px-4 !py-2 !text-[14px]">
              {pending ? "Se lucrează…" : "Salvează"}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  setResult(null);
                  const read = await actions.reread(expense.id);
                  setResult(read.ok ? { tone: "ok", text: read.message ?? "Citit." } : { tone: "error", text: read.message });
                  onChanged();
                })
              }
              className="btn btn-ghost !min-h-10 !px-4 !py-2 !text-[14px]"
            >
              Citește din nou
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const done = await actions.hide(expense.id);
                  if (!done.ok) setResult({ tone: "error", text: done.message });
                  else {
                    onChanged();
                    onClose();
                  }
                })
              }
              className="ml-auto text-[13px] text-dim underline underline-offset-4 hover:text-[var(--ap-error)]"
            >
              Scoate din listă
            </button>
          </div>
        </form>
        <p className="text-[12.5px] text-dim">
          {expense.driveLink ? (
            <a href={expense.driveLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline underline-offset-4">
              Fișierul pe Drive <IconExternal size={13} />
            </a>
          ) : expense.driveMesaj ? (
            `Pe Drive nu e încă: ${expense.driveMesaj}`
          ) : null}
          {expense.driveLink ? " · dacă schimbi luna, fișierul se mută singur în folderul ei." : ""}
        </p>
      </div>
    </SidePanel>
  );
}
