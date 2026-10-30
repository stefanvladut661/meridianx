"use client";

import { useMemo, useState, type ChangeEvent, type DragEvent } from "react";
import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, FileJson, ShieldCheck, Table2, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { KDF, VaultCryptoError } from "@/lib/vault/crypto";
import { KIND_LABEL, type EntryPayload, type VaultClient, type VaultEntry } from "@/lib/vault/entries";
import { decryptExport, isExportFile, type ExportFile } from "@/lib/vault/export";
import {
  ROLES,
  ROLE_LABEL,
  classifyJson,
  detectColumns,
  finishPlan,
  itemsFromExport,
  parseCsv,
  planImport,
  type ColumnMapping,
  type ColumnRole,
  type CsvTable,
  type RawItem,
} from "@/lib/vault/import";
import { Btn, Card, Pill, SectionTitle } from "@/components/panou/ui/primitives";
import { InlineNote } from "@/components/panou/ui/actions";
import { ProgressBar } from "@/components/panou/ui/states";
import { SoftSelect, TextInput } from "@/components/panou/ui/select";
import { useToast } from "@/components/panou/ui/toast";
import { dateRo } from "@/components/panou/ui/format";
import { describeError } from "./errors";
import { countNoun } from "./format";
import { BusyBlock, LabeledInput, PageHead } from "./ui";

/**
 * Importul în trei pași (VaultImportPage din prototip): sursa, coloanele,
 * previzualizarea. Fișierul se citește în browser și nu se urcă nicăieri; ce
 * se importă pleacă doar criptat, în loturi.
 *
 * Peste prototip: sursa se recunoaște din conținut (CSV / Bitwarden JSON /
 * export MERIDIAN, care cere parola lui de export), clientul fiecărui rând se
 * alege din coloană sau unul singur, dublurile sunt marcate față de seif ȘI
 * față de rândurile de dinainte, iar importul raportează cifre reale.
 */

const SOURCES = [
  { id: "csv", title: "CSV", text: "Din Chrome, 1Password, LastPass, KeePass sau Excel. O linie, o intrare.", icon: Table2, accept: ".csv,text/csv,text/plain" },
  { id: "bitwarden", title: "Bitwarden JSON", text: "Exportul .json necriptat, cu foldere și câmpuri personalizate.", icon: FileJson, accept: ".json,application/json" },
  { id: "meridian", title: "Export MERIDIAN", text: "Fișierul criptat creat din Export, cu parola lui.", icon: ShieldCheck, accept: ".json,application/json" },
] as const;

type SourceId = (typeof SOURCES)[number]["id"];

const MAX_BYTES = 5 * 1024 * 1024;
const NEW_CLIENT = "__new__";
const NO_COLUMN = "";
const PREVIEW_ROWS = 40;
/** Rândurile fără folder, când clientul vine din sursă. Vizibil în previzualizare, ca omul să știe dinainte unde ajung. */
const FALLBACK_CLIENT = "Import fără folder";

type ClientMode = "column" | "single";

type Source =
  | { kind: "csv"; table: CsvTable }
  | { kind: "items"; label: string; items: RawItem[]; groupLabel: string };

interface Outcome {
  imported: number;
  planned: number;
  skippedDuplicates: number;
  clientsCreated: number;
}

export interface ImportApi {
  /** Criptează și scrie rândurile, în loturi. Aruncă după loturile deja salvate (rândurile salvate rămân). */
  run: (rows: Array<{ clientName: string; payload: EntryPayload }>, onProgress: (done: number) => void) => Promise<{ imported: number; clientsCreated: number }>;
}

export function ImportView({
  clients,
  entries,
  api,
  reload,
}: {
  clients: VaultClient[];
  entries: VaultEntry[];
  api: ImportApi;
  reload: () => Promise<void>;
}) {
  const { notify } = useToast();
  const [step, setStep] = useState(0);
  const [sourceId, setSourceId] = useState<SourceId>("csv");
  const [fileName, setFileName] = useState<string | null>(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasted, setPasted] = useState("");
  const [source, setSource] = useState<Source | null>(null);
  const [pendingExport, setPendingExport] = useState<{ file: ExportFile; name: string | null } | null>(null);
  const [exportPass, setExportPass] = useState("");
  const [decrypting, setDecrypting] = useState<number | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [clientMode, setClientMode] = useState<ClientMode>("single");
  const [singleClient, setSingleClient] = useState<string>(clients[0]?.id ?? NEW_CLIENT);
  const [newClientName, setNewClientName] = useState("");
  const [includeDuplicates, setIncludeDuplicates] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const table = source?.kind === "csv" ? source.table : null;
  const selectedSource = SOURCES.find((item) => item.id === sourceId) ?? SOURCES[0];

  function reset() {
    setStep(0);
    setFileName(null);
    setSource(null);
    setPendingExport(null);
    setExportPass("");
    setMapping({});
    setIncludeDuplicates(false);
    setProgress(null);
    setOutcome(null);
    setError(null);
    setPasted("");
  }

  function adoptItems(next: Extract<Source, { kind: "items" }>, name: string | null) {
    setSource(next);
    setFileName(name);
    setClientMode(next.items.some((item) => item.group) ? "column" : "single");
  }

  /** Recunoaște ce fel de text e și îl pregătește pentru pasul următor. */
  function load(text: string, name: string | null) {
    setError(null);
    setOutcome(null);
    setPendingExport(null);
    setSource(null);

    if (/^\s*[{[]/.test(text)) {
      const json = classifyJson(text);
      if (json.kind === "meridian-export" && isExportFile(json.file)) {
        setSourceId("meridian");
        setPendingExport({ file: json.file, name });
        setFileName(name ?? "text lipit");
        return;
      }
      if (json.kind === "bitwarden-encrypted") {
        setFileName(null);
        setError("E un export Bitwarden CRIPTAT, nu se poate citi. Exportă din Bitwarden varianta „.json (necriptat)”, importă, apoi șterge fișierul.");
        return;
      }
      if (json.kind === "bitwarden") {
        setSourceId("bitwarden");
        adoptItems({ kind: "items", label: "Bitwarden (JSON)", items: json.items, groupLabel: "folderele din Bitwarden" }, name ?? "text lipit");
        return;
      }
      setFileName(null);
      setError("JSON-ul nu e nici export Bitwarden, nici fișier de export MERIDIAN. Pentru alte managere, folosește CSV.");
      return;
    }

    const parsed = parseCsv(text);
    if (parsed.headers.length < 2 || parsed.rows.length === 0) {
      setFileName(null);
      setError(
        parsed.headers.length < 2
          ? "Fișierul nu arată a CSV: am găsit o singură coloană. Exportul din managerul de parole trebuie să fie CSV sau JSON (Bitwarden)."
          : "Fișierul are doar antetul, niciun rând de date."
      );
      return;
    }
    const detected = detectColumns(parsed.headers);
    setSourceId("csv");
    setSource({ kind: "csv", table: parsed });
    setMapping(detected);
    setFileName(name ?? "text lipit");
    setClientMode(detected.group !== undefined ? "column" : "single");
  }

  async function readFile(file: File | undefined) {
    if (!file) return;
    if (file.size > MAX_BYTES) {
      setFileName(null);
      setError("Fișierul are peste 5 MB. Împarte-l în fișiere mai mici și importă-le pe rând.");
      return;
    }
    try {
      load(await file.text(), file.name);
    } catch {
      setError("Fișierul nu s-a putut citi. Încearcă din nou sau lipește textul.");
    }
  }

  async function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Același fișier, ales din nou după o corectură, trebuie să declanșeze iar `change`.
    event.target.value = "";
    await readFile(file);
  }

  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragging(false);
    void readFile(event.dataTransfer.files?.[0]);
  }

  async function unlockExport() {
    if (!pendingExport || !exportPass) return;
    setError(null);
    setDecrypting(Date.now());
    try {
      const plain = await decryptExport(pendingExport.file, exportPass);
      adoptItems({ kind: "items", label: "export MERIDIAN", items: itemsFromExport(plain), groupLabel: "clienții din export" }, pendingExport.name);
      setPendingExport(null);
      setExportPass("");
    } catch (cause) {
      setError(
        cause instanceof VaultCryptoError ? "Parola de export nu deschide fișierul: e greșită sau fișierul a fost modificat." : describeError(cause, "Fișierul nu s-a putut deschide.")
      );
    } finally {
      setDecrypting(null);
    }
  }

  const singleClientName = singleClient === NEW_CLIENT ? newClientName.trim() : (clients.find((client) => client.id === singleClient)?.name ?? "");

  const plan = useMemo(() => {
    if (!source) return null;
    const clientNameFor = (group: string | null) => (clientMode === "column" ? (group ?? FALLBACK_CLIENT) : singleClientName);
    if (source.kind === "csv") return planImport(source.table, mapping, { entries, clients }, clientNameFor);
    return finishPlan(source.items, { entries, clients }, clientNameFor);
  }, [source, mapping, entries, clients, clientMode, singleClientName]);

  const hasGroupColumn = source?.kind === "csv" ? mapping.group !== undefined : Boolean(source?.items.some((item) => item.group));
  const groupLabel = source?.kind === "csv" && table ? `coloana „${table.headers[mapping.group ?? 0] ?? ""}”` : source?.kind === "items" ? source.groupLabel : "";
  const toImport = useMemo(() => plan?.items.filter((item) => !item.empty && (includeDuplicates || !item.duplicate)) ?? [], [plan, includeDuplicates]);

  function setRole(role: ColumnRole, value: string) {
    setMapping((current) => {
      const next: ColumnMapping = { ...current };
      if (value === NO_COLUMN) delete next[role];
      else {
        const index = Number(value);
        // O coloană are un singur rol.
        for (const other of ROLES) if (other !== role && next[other] === index) delete next[other];
        next[role] = index;
      }
      return next;
    });
  }

  const clientReady = clientMode === "column" || singleClientName.length > 0;
  const canPreview = Boolean(source) && clientReady && !pendingExport;

  async function run() {
    if (!plan || toImport.length === 0) return;
    if (!clientReady) {
      setError(singleClient === NEW_CLIENT ? "Scrie numele clientului nou." : "Alege clientul.");
      return;
    }
    setError(null);
    setProgress({ done: 0, total: toImport.length });
    const rows = toImport.map((item) => ({
      clientName: clientMode === "column" ? (item.group ?? FALLBACK_CLIENT) : singleClientName,
      payload: item.payload,
    }));
    try {
      const { imported, clientsCreated } = await api.run(rows, (done) => setProgress({ done, total: rows.length }));
      setOutcome({ imported, planned: rows.length, skippedDuplicates: includeDuplicates ? 0 : plan.duplicates, clientsCreated });
      setProgress(null);
      await reload();
      notify(`Import terminat: ${countNoun(imported, "intrare nouă", "intrări noi")}${plan.duplicates && !includeDuplicates ? `, ${countNoun(plan.duplicates, "dublură sărită", "dubluri sărite")}` : ""}.`);
    } catch (cause) {
      setError(describeError(cause, "Importul s-a oprit dintr-un motiv necunoscut."));
      // Ce a intrat a intrat; lista se reîncarcă oricum, ca omul să vadă.
      setProgress(null);
      await reload();
    }
  }

  const steps = ["Sursa", "Potrivește coloanele", "Previzualizare și import"];

  return (
    <>
      <PageHead title="Import" text="Trei pași. Secretele se criptează în browser înainte să fie salvate." />

      <ol className="flex flex-wrap gap-1.5" aria-label="Pașii importului">
        {steps.map((label, i) => (
          <li key={label}>
            <span
              aria-current={i === step && !outcome ? "step" : undefined}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px]",
                i === step && !outcome
                  ? "border-mint/40 bg-mint/10 text-[#B4F2CD]"
                  : i < step || outcome
                    ? "border-white/[0.1] text-foreground/70"
                    : "border-white/[0.07] text-muted-foreground"
              )}
            >
              <span className={cn("pu-num flex h-4 w-4 items-center justify-center rounded-full text-[9px]", i === step && !outcome ? "bg-mint text-[#0B1A12]" : "bg-white/[0.08]")}>
                {i < step || outcome ? "✓" : i + 1}
              </span>
              {label}
            </span>
          </li>
        ))}
      </ol>

      <div aria-live="polite">{error ? <InlineNote tone="rose">{error}</InlineNote> : null}</div>

      {outcome ? (
        <Card className="text-center">
          <CheckCircle2 className="mx-auto h-6 w-6 text-mint" aria-hidden="true" />
          <p className="mt-2 text-[14px] font-medium">Import terminat</p>
          <p className="mt-1 text-[12px] text-muted-foreground">
            {countNoun(outcome.imported, "intrare adăugată", "intrări adăugate")}
            {outcome.imported !== outcome.planned ? ` din ${outcome.planned} planificate` : ""}
            {outcome.skippedDuplicates ? `, ${countNoun(outcome.skippedDuplicates, "dublură sărită", "dubluri sărite")}` : ""}
            {outcome.clientsCreated ? `, ${countNoun(outcome.clientsCreated, "client nou", "clienți noi")}` : ""}. Criptarea s-a făcut local.
          </p>
          <p className="mx-auto mt-2 max-w-md text-[11px] leading-relaxed text-muted-foreground/80">
            {source?.kind === "items" && source.label === "export MERIDIAN"
              ? "Fișierul de export rămâne criptat; îl poți păstra."
              : "Fișierul importat rămâne pe calculatorul tău, în clar. Șterge-l."}
          </p>
          <Btn size="sm" variant="outline" className="mt-4" onClick={reset}>
            Importă alt fișier
          </Btn>
        </Card>
      ) : (
        <Card>
          {step === 0 && (
            <>
              <SectionTitle title="De unde imporți" hint="alegi o singură sursă" />
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                {SOURCES.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSourceId(s.id)}
                    aria-pressed={sourceId === s.id}
                    className={cn("rounded-xl border p-3 text-left transition-colors", sourceId === s.id ? "border-mint/40 bg-mint/[0.07]" : "border-white/[0.09] hover:border-white/20")}
                  >
                    <s.icon className={cn("h-4 w-4", sourceId === s.id ? "text-mint" : "text-foreground/50")} aria-hidden="true" />
                    <p className="mt-2 text-[12.5px] font-medium">{s.title}</p>
                    <p className="mt-0.5 text-[10.5px] leading-snug text-muted-foreground">{s.text}</p>
                  </button>
                ))}
              </div>
              <label
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                className={cn(
                  "mt-4 flex cursor-pointer flex-col items-center rounded-xl border border-dashed px-4 py-6 text-center transition-colors focus-within:border-lav/50",
                  dragging ? "border-mint/50 bg-mint/[0.05]" : "border-white/[0.14] hover:border-white/25"
                )}
              >
                <Upload className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                <span className="mt-2 text-[12.5px]">{fileName ?? "Trage fișierul aici sau apasă"}</span>
                <span className="mt-0.5 text-[10.5px] text-muted-foreground">CSV, JSON, maximum 5 MB · se citește aici, în browser</span>
                <input type="file" className="sr-only" accept={selectedSource.accept} onChange={onFile} />
              </label>

              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => setPasteOpen((open) => !open)}
                  aria-expanded={pasteOpen}
                  className="text-[11.5px] text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                >
                  {pasteOpen ? "Ascunde câmpul de lipit" : "sau lipește textul (CSV / JSON)"}
                </button>
                {pasteOpen ? (
                  <div className="mt-2">
                    <label htmlFor="import-paste" className="sr-only">
                      Text CSV sau JSON
                    </label>
                    <textarea
                      id="import-paste"
                      value={pasted}
                      onChange={(event) => setPasted(event.target.value)}
                      rows={5}
                      spellCheck={false}
                      placeholder={"name,url,username,password,note\n…"}
                      className="w-full resize-y rounded-lg border border-white/[0.12] bg-white/[0.03] p-2.5 font-mono text-[11.5px] leading-relaxed outline-none focus:border-lav/50"
                    />
                    <Btn size="xs" variant="outline" className="mt-2" disabled={!pasted.trim()} onClick={() => load(pasted, null)}>
                      Citește textul
                    </Btn>
                  </div>
                ) : null}
              </div>

              <div className="mt-4 flex justify-end">
                <Btn size="sm" variant="primary" iconRight={ArrowRight} disabled={!source && !pendingExport} onClick={() => setStep(1)}>
                  Continuă
                </Btn>
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <SectionTitle
                title={pendingExport ? "Parola fișierului" : table ? "Potrivește coloanele" : "Potrivește intrările"}
                hint={pendingExport ? "fișierul e criptat cu parola lui de export" : table ? "capul de tabel din fișier" : "câmpurile sunt recunoscute automat"}
              />

              {pendingExport ? (
                <div className="mt-3">
                  <p className="text-[11.5px] text-muted-foreground">
                    {pendingExport.name ?? "text lipit"} · {countNoun(pendingExport.file.counts.entries, "intrare", "intrări")} · {countNoun(pendingExport.file.counts.clients, "client", "clienți")} · exportat{" "}
                    {dateRo(pendingExport.file.exportedAt)}
                  </p>
                  {decrypting !== null ? (
                    <div className="mt-3">
                      <BusyBlock label="Se derivă cheia de export" detail={`Argon2id · ${KDF.memlimit / (1024 * 1024)} MiB · ${KDF.opslimit} pași`} startedAt={decrypting} />
                    </div>
                  ) : (
                    <form
                      className="mt-3 max-w-sm space-y-3"
                      onSubmit={(event) => {
                        event.preventDefault();
                        void unlockExport();
                      }}
                    >
                      <LabeledInput label="Parola de export" type="password" value={exportPass} onChange={(event) => setExportPass(event.target.value)} autoComplete="off" />
                      <Btn type="submit" size="sm" variant="primary" disabled={!exportPass}>
                        Deschide fișierul
                      </Btn>
                    </form>
                  )}
                </div>
              ) : null}

              {table ? (
                <div className="mt-3 space-y-2">
                  {ROLES.map((role) => (
                    <div key={role} className="grid grid-cols-[110px_minmax(0,1fr)] items-center gap-2 sm:grid-cols-[140px_minmax(0,1fr)]">
                      <span className="text-[11.5px] text-muted-foreground">{role === "password" ? "Parolă (secret)" : role === "totp" ? "Cod 2FA (secret)" : ROLE_LABEL[role]}</span>
                      <SoftSelect
                        ariaLabel={ROLE_LABEL[role]}
                        value={mapping[role] === undefined ? NO_COLUMN : String(mapping[role])}
                        onChange={(value) => setRole(role, value)}
                        options={[{ value: NO_COLUMN, label: "— lipsește" }, ...table.headers.map((header, index) => ({ value: String(index), label: header || `coloana ${index + 1}` }))]}
                        className="max-w-[220px]"
                      />
                    </div>
                  ))}
                </div>
              ) : null}

              {source ? (
                <>
                  <InlineNote tone="neutral" className="mt-3">
                    {table
                      ? "Coloanele nerecunoscute devin câmpuri cu numele lor, nu se pierde nimic. Câmpurile „Parolă” și „Cod 2FA” devin secrete și se criptează."
                      : "Parolele și codurile 2FA rămân secrete și se criptează la import; restul câmpurilor se păstrează cum sunt în fișier."}
                  </InlineNote>

                  <p className={cn("mt-4", "text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground")}>În ce client ajung</p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {hasGroupColumn ? (
                      <button
                        type="button"
                        aria-pressed={clientMode === "column"}
                        onClick={() => setClientMode("column")}
                        className={cn("rounded-xl border p-3 text-left transition-colors", clientMode === "column" ? "border-mint/40 bg-mint/[0.07]" : "border-white/[0.09] hover:border-white/20")}
                      >
                        <p className="text-[12.5px] font-medium">Din {groupLabel}</p>
                        <p className="mt-0.5 text-[10.5px] leading-snug text-muted-foreground">
                          {plan ? `${countNoun(plan.groups.length, "client", "clienți")}${plan.groups.length ? `: ${plan.groups.slice(0, 4).join(", ")}${plan.groups.length > 4 ? "…" : ""}` : ""}` : ""}
                          {plan?.items.some((item) => !item.empty && !item.group) ? ` · rândurile fără folder ajung în „${FALLBACK_CLIENT}”` : ""}
                        </p>
                      </button>
                    ) : null}
                    <button
                      type="button"
                      aria-pressed={clientMode === "single"}
                      onClick={() => setClientMode("single")}
                      className={cn("rounded-xl border p-3 text-left transition-colors", clientMode === "single" ? "border-mint/40 bg-mint/[0.07]" : "border-white/[0.09] hover:border-white/20")}
                    >
                      <p className="text-[12.5px] font-medium">Toate într-un singur client</p>
                      <p className="mt-0.5 text-[10.5px] leading-snug text-muted-foreground">Alegi clientul sau creezi unul nou.</p>
                    </button>
                  </div>
                  {clientMode === "single" ? (
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <SoftSelect
                        label="Client"
                        value={singleClient}
                        onChange={setSingleClient}
                        options={[...clients.map((client) => ({ value: client.id, label: client.name })), { value: NEW_CLIENT, label: "+ Client nou" }]}
                      />
                      {singleClient === NEW_CLIENT ? (
                        <div>
                          <label htmlFor="import-new-client" className="mb-1 block text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
                            Numele clientului nou
                          </label>
                          <TextInput id="import-new-client" value={newClientName} onChange={(event) => setNewClientName(event.target.value)} placeholder="ex. Băcănia Verde" autoComplete="off" className="h-8" />
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </>
              ) : null}

              <div className="mt-4 flex justify-between">
                <Btn size="sm" variant="ghost" icon={ArrowLeft} onClick={() => setStep(0)}>
                  Înapoi
                </Btn>
                <Btn size="sm" variant="primary" iconRight={ArrowRight} disabled={!canPreview} onClick={() => setStep(2)}>
                  Previzualizează
                </Btn>
              </div>
            </>
          )}

          {step === 2 && plan && (
            <>
              <SectionTitle
                title="Previzualizare"
                hint="dublurile sunt marcate; secretele rămân ascunse"
                action={plan.duplicates > 0 ? <Pill tone="apricot">{countNoun(plan.duplicates, "dublură", "dubluri")}</Pill> : <Pill tone="mint">fără dubluri</Pill>}
              />
              <p className="mt-2 text-[11px] text-muted-foreground">
                {fileName ?? "text lipit"} · {countNoun(plan.importable, "intrare nouă", "intrări noi")}
                {plan.duplicates ? ` · ${countNoun(plan.duplicates, "dublură", "dubluri")} ${includeDuplicates ? "(se importă)" : "(sărite)"}` : ""}
                {plan.empty ? ` · ${countNoun(plan.empty, "rând gol", "rânduri goale")} (sărite)` : ""}
              </p>
              <ul className="mt-3 max-h-[22rem] divide-y divide-white/[0.05] overflow-y-auto rounded-xl border border-white/[0.07]" aria-label="Previzualizare">
                {plan.items.slice(0, PREVIEW_ROWS).map((item) => {
                  const skipped = item.empty || (item.duplicate && !includeDuplicates);
                  const client = clientMode === "column" ? (item.group ?? FALLBACK_CLIENT) : singleClientName || "—";
                  const username = item.payload.fields.find((field) => !field.secret && /utilizator/i.test(field.label))?.value;
                  const hasSecret = item.payload.fields.some((field) => field.secret);
                  return (
                    <li key={item.row} className={cn("flex items-center gap-3 px-3 py-2.5", skipped && "opacity-50")}>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12.5px]">{item.payload.title}</p>
                        <p className="truncate text-[10.5px] text-muted-foreground">
                          {client} · {KIND_LABEL[item.payload.kind]}
                          {username ? ` · ${username}` : ""}
                          {hasSecret ? " · ••••••••" : ""}
                        </p>
                      </div>
                      {item.empty ? (
                        <Pill tone="neutral">gol</Pill>
                      ) : item.duplicate ? (
                        <Pill tone="apricot">
                          <AlertTriangle className="h-3 w-3" aria-hidden="true" /> dublură
                        </Pill>
                      ) : (
                        <Pill tone="mint">nou</Pill>
                      )}
                    </li>
                  );
                })}
                {plan.items.length > PREVIEW_ROWS ? <li className="px-3 py-2 text-[10.5px] text-muted-foreground">… încă {plan.items.length - PREVIEW_ROWS}</li> : null}
              </ul>

              {plan.duplicates > 0 ? (
                <label className="mt-3 flex cursor-pointer items-center gap-2 text-[12px] text-muted-foreground">
                  <input type="checkbox" checked={includeDuplicates} onChange={(event) => setIncludeDuplicates(event.target.checked)} className="accent-[#C6B5FF]" />
                  Importă și dublurile (același client, titlu și utilizator)
                </label>
              ) : null}

              {progress ? (
                <div className="mt-4" role="status">
                  <ProgressBar value={(progress.done / (progress.total || 1)) * 100} tone="mint" />
                  <p className="pu-num mt-1.5 text-[10.5px] text-muted-foreground">
                    Se importă… {progress.done} din {progress.total} · criptate local, în loturi
                  </p>
                </div>
              ) : null}

              <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                <Btn size="sm" variant="ghost" icon={ArrowLeft} disabled={progress !== null} onClick={() => setStep(1)}>
                  Înapoi
                </Btn>
                <Btn size="sm" variant="primary" disabled={progress !== null || toImport.length === 0} onClick={() => void run()}>
                  {progress ? "Se importă…" : toImport.length === 0 ? "Nimic de importat" : `Importă ${countNoun(toImport.length, "intrare", "intrări")}`}
                </Btn>
              </div>
            </>
          )}
        </Card>
      )}
    </>
  );
}
