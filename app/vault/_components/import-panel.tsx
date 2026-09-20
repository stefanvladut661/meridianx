"use client";

import { useEffect, useId, useMemo, useState, type ChangeEvent } from "react";
import {
  createEntries,
  ensureClients,
  type VaultClient,
  type VaultEntry,
} from "@/lib/vault/entries";
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
import { decryptExport, isExportFile, type ExportFile } from "@/lib/vault/export";
import { KeyRing } from "./key-ring";
import { VaultDataError } from "@/lib/vault/members";
import { VaultCryptoError } from "@/lib/vault/crypto";
import { useVault } from "./vault-provider";
import { BTN_SM, BTN_SM_LIGHT, FIELD, Note, countNoun, formatDate, formatSeconds } from "./ui";

/**
 * Importul (feat/vault, fazele 5, 9 și 11), în aceeași ramă ca fișa:
 * CSV (orice manager), JSON Bitwarden (cu câmpuri personalizate) și
 * fișierul propriu de export (cu parola lui de export).
 *
 * Trei pași, unul sub altul, fără „wizard": (1) fișierul sau textul
 * lipit — citit în browser, nu urcat nicăieri; (2) revizuirea: ce
 * coloană e ce, în ce client ajunge fiecare rând, câte sunt duplicate
 * (sărite implicit); (3) importul, în loturi, cu contor real, și
 * bilanțul. Parolele nu apar în previzualizare nici mascate — la fel
 * ca în listă.
 */

const NEW_CLIENT = "__new__";
const NO_COLUMN = "";
const PREVIEW_ROWS = 8;
/** Rândurile fără folder, când clientul vine din coloană. Vizibil în
    previzualizare, ca omul să știe dinainte unde ajung. */
const FALLBACK_CLIENT = "Import fără folder";

type ClientMode = "column" | "single";

/** Sursa citită: un tabel CSV (cu coloane de mapat) sau intrări gata
    (JSON Bitwarden, exportul nostru). */
type Source =
  | { kind: "csv"; table: CsvTable }
  | { kind: "items"; label: string; items: RawItem[]; groupLabel: string };

interface Outcome {
  imported: number;
  planned: number;
  clientsCreated: number;
}

function describe(error: unknown): string {
  if (error instanceof VaultDataError || error instanceof VaultCryptoError) return error.message;
  return "Importul s-a oprit dintr-un motiv necunoscut.";
}

export function ImportPanel({
  clients,
  entries,
  headingId,
  onClose,
  onImported,
}: {
  clients: VaultClient[];
  entries: VaultEntry[];
  headingId: string;
  onClose: () => void;
  onImported: () => Promise<void>;
}) {
  const { supabase, keys } = useVault();
  const ids = { file: useId(), paste: useId(), client: useId(), newClient: useId(), dupes: useId() };

  const [fileName, setFileName] = useState<string | null>(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasted, setPasted] = useState("");
  const [source, setSource] = useState<Source | null>(null);
  const [pendingExport, setPendingExport] = useState<{ file: ExportFile; name: string | null } | null>(null);
  const [decrypting, setDecrypting] = useState<number | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const table = source?.kind === "csv" ? source.table : null;
  const [clientMode, setClientMode] = useState<ClientMode>("single");
  const [singleClient, setSingleClient] = useState<string>(clients[0]?.id ?? NEW_CLIENT);
  const [newClientName, setNewClientName] = useState("");
  const [includeDuplicates, setIncludeDuplicates] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load(text: string, name: string | null) {
    setError(null);
    setOutcome(null);
    setPendingExport(null);

    if (/^\s*[{[]/.test(text)) {
      const json = classifyJson(text);
      if (json.kind === "meridian-export" && isExportFile(json.file)) {
        setPendingExport({ file: json.file, name });
        setFileName(name);
        return;
      }
      if (json.kind === "bitwarden-encrypted") {
        setError("E un export Bitwarden CRIPTAT — nu se poate citi. Exportă din Bitwarden varianta „.json (necriptat)”, importă, apoi șterge fișierul.");
        return;
      }
      if (json.kind === "bitwarden") {
        adoptItems({ kind: "items", label: "Bitwarden (JSON)", items: json.items, groupLabel: "folderele din Bitwarden" }, name);
        return;
      }
      setError("JSON-ul nu e nici export Bitwarden, nici fișier de export MERIDIAN. Pentru alte managere, folosește CSV.");
      return;
    }

    const parsed = parseCsv(text);
    if (parsed.headers.length < 2 || parsed.rows.length === 0) {
      setSource(null);
      setError(
        parsed.headers.length < 2
          ? "Fișierul nu arată a CSV: am găsit o singură coloană. Exportul din managerul de parole trebuie să fie CSV sau JSON (Bitwarden)."
          : "Fișierul are doar antetul — niciun rând de date."
      );
      return;
    }
    const detected = detectColumns(parsed.headers);
    setSource({ kind: "csv", table: parsed });
    setMapping(detected);
    setFileName(name);
    setClientMode(detected.group !== undefined ? "column" : "single");
  }

  function adoptItems(next: Extract<Source, { kind: "items" }>, name: string | null) {
    setSource(next);
    setFileName(name);
    setClientMode(next.items.some((item) => item.group) ? "column" : "single");
  }

  async function unlockExport(passphrase: string) {
    if (!pendingExport) return;
    setError(null);
    setDecrypting(Date.now());
    try {
      const plain = await decryptExport(pendingExport.file, passphrase);
      adoptItems(
        { kind: "items", label: "export MERIDIAN", items: itemsFromExport(plain), groupLabel: "clienții din export" },
        pendingExport.name
      );
      setPendingExport(null);
    } catch (cause) {
      setError(
        cause instanceof VaultCryptoError
          ? "Parola de export nu deschide fișierul — e greșită sau fișierul a fost modificat."
          : describe(cause)
      );
    } finally {
      setDecrypting(null);
    }
  }

  async function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Același fișier, ales din nou după o corectură, trebuie să declanșeze
    // iar `change`.
    event.target.value = "";
    if (!file) return;
    try {
      load(await file.text(), file.name);
    } catch {
      setError("Fișierul nu s-a putut citi.");
    }
  }

  const singleClientName =
    singleClient === NEW_CLIENT
      ? newClientName.trim()
      : (clients.find((client) => client.id === singleClient)?.name ?? "");

  const plan = useMemo(() => {
    if (!source) return null;
    const clientNameFor = (group: string | null) =>
      clientMode === "column" ? (group ?? FALLBACK_CLIENT) : singleClientName;
    if (source.kind === "csv") return planImport(source.table, mapping, { entries, clients }, clientNameFor);
    return finishPlan(source.items, { entries, clients }, clientNameFor);
  }, [source, mapping, entries, clients, clientMode, singleClientName]);

  const hasGroupColumn = source?.kind === "csv" ? mapping.group !== undefined : Boolean(source?.items.some((item) => item.group));
  const groupLabel = source?.kind === "csv" && table ? `coloana „${table.headers[mapping.group ?? 0]}”` : (source?.kind === "items" ? source.groupLabel : "");

  const toImport = useMemo(
    () => plan?.items.filter((item) => !item.empty && (includeDuplicates || !item.duplicate)) ?? [],
    [plan, includeDuplicates]
  );

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

  async function run() {
    if (!supabase || !keys || !plan || toImport.length === 0) return;
    if (clientMode === "single" && !singleClientName) {
      setError(singleClient === NEW_CLIENT ? "Scrie numele clientului nou." : "Alege clientul.");
      return;
    }
    setError(null);
    setProgress({ done: 0, total: toImport.length });
    try {
      const names =
        clientMode === "column"
          ? Array.from(new Set(toImport.map((item) => item.group ?? FALLBACK_CLIENT)))
          : [singleClientName];
      const idByName = await ensureClients(supabase, keys, names, clients);
      const items = toImport.map((item) => ({
        clientId: idByName.get(clientMode === "column" ? (item.group ?? FALLBACK_CLIENT) : singleClientName)!,
        payload: item.payload,
      }));
      const imported = await createEntries(supabase, keys, items, (done) =>
        setProgress({ done, total: items.length })
      );
      const clientsCreated = names.filter(
        (name) => !clients.some((client) => client.id === idByName.get(name))
      ).length;
      setOutcome({ imported, planned: items.length, clientsCreated });
      setProgress(null);
      await onImported();
    } catch (cause) {
      setError(describe(cause));
      // Ce a intrat a intrat; lista se reîncarcă oricum, ca omul să vadă.
      await onImported();
      setProgress(null);
    }
  }

  const step = outcome ? 3 : source ? 2 : 1;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-4 border-b border-hair px-5 py-5 sm:px-6">
        <div className="min-w-0">
          <p className="font-md-mono text-[10.5px] uppercase tracking-[0.18em] text-dim">
            Import · pasul {step} din 3
          </p>
          <h2 id={headingId} className="display mt-2 text-[1.5rem] text-bone sm:text-[1.625rem]">
            {outcome
              ? "Import terminat"
              : source
                ? "Verifică înainte de import"
                : pendingExport
                  ? "Fișier de export MERIDIAN"
                  : "Adu parolele din altă parte"}
          </h2>
        </div>
        <button type="button" onClick={onClose} disabled={progress !== null} className={`${BTN_SM} shrink-0`}>
          Închide
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
        <div aria-live="polite">{error ? <Note tone="error">{error}</Note> : null}</div>

        {outcome ? (
          <div>
            <p className="text-[15px] leading-relaxed text-bone">
              {countNoun(outcome.imported, "intrare importată", "intrări importate")}
              {outcome.imported !== outcome.planned ? ` din ${outcome.planned} planificate` : ""}
              {outcome.clientsCreated > 0
                ? ` · ${countNoun(outcome.clientsCreated, "client nou", "clienți noi")}`
                : ""}
              .
            </p>
            <p className="mt-3 text-[14px] leading-relaxed text-dim">
              Fiecare intrare a fost criptată aici, cu cheia vault-ului, înainte să plece.
              {source?.kind === "items" && source.label === "export MERIDIAN"
                ? " Fișierul de export rămâne criptat — poți să-l păstrezi."
                : " Fișierul importat rămâne pe calculatorul tău, în clar — șterge-l."}
            </p>
            <button type="button" onClick={onClose} className={`${BTN_SM_LIGHT} mt-5`}>
              Înapoi la listă
            </button>
          </div>
        ) : pendingExport ? (
          <ExportUnlock
            fileName={pendingExport.name}
            counts={pendingExport.file.counts}
            exportedAt={pendingExport.file.exportedAt}
            busySince={decrypting}
            onSubmit={(passphrase) => void unlockExport(passphrase)}
            onCancel={() => {
              setPendingExport(null);
              setFileName(null);
            }}
          />
        ) : !source ? (
          <div>
            <p className="text-[14.5px] leading-relaxed text-dim">
              Exportă din Chrome, 1Password, LastPass sau KeePass ca <strong className="font-semibold text-bone">CSV</strong>,
              din Bitwarden ca <strong className="font-semibold text-bone">JSON (necriptat)</strong> — sau adu un fișier de
              export MERIDIAN. Se citește aici, în browser — nu se urcă nicăieri; ce importezi pleacă doar criptat.
            </p>

            <input id={ids.file} type="file" accept=".csv,.json,text/csv,application/json,text/plain" onChange={onFile} className="sr-only" />
            <label htmlFor={ids.file} className={`${BTN_SM_LIGHT} mt-5 cursor-pointer`}>
              Alege fișierul
            </label>

            <button
              type="button"
              onClick={() => setPasteOpen((open) => !open)}
              aria-expanded={pasteOpen}
              className="ml-2 mt-5 text-[13.5px] text-dim underline-offset-4 transition-colors hover:text-bone hover:underline"
            >
              {pasteOpen ? "Ascunde câmpul de lipit" : "sau lipește textul (CSV / JSON)"}
            </button>

            {pasteOpen ? (
              <div className="mt-4">
                <label htmlFor={ids.paste} className="sr-only">
                  Text CSV
                </label>
                <textarea
                  id={ids.paste}
                  value={pasted}
                  onChange={(event) => setPasted(event.target.value)}
                  rows={6}
                  spellCheck={false}
                  placeholder={"name,url,username,password,note\n…"}
                  className={`${FIELD} resize-y py-2.5 font-md-mono !text-[12.5px] leading-relaxed`}
                />
                <button
                  type="button"
                  disabled={!pasted.trim()}
                  onClick={() => load(pasted, null)}
                  className={`${BTN_SM} mt-2`}
                >
                  Citește textul
                </button>
              </div>
            ) : null}
          </div>
        ) : (
          <div>
            <p className="font-md-mono text-[11.5px] tracking-[0.06em] text-dim">
              {fileName ?? "text lipit"} ·{" "}
              {table
                ? `${countNoun(table.rows.length, "rând", "rânduri")} · ${countNoun(table.headers.length, "coloană", "coloane")}`
                : source.kind === "items"
                  ? `${source.label} · ${countNoun(source.items.length, "intrare", "intrări")}`
                  : ""}
              <button
                type="button"
                onClick={() => {
                  setSource(null);
                  setFileName(null);
                }}
                className="ml-3 text-bone underline-offset-4 hover:underline"
              >
                alt fișier
              </button>
            </p>

            {/* Coloane (doar CSV) ------------------------------------- */}
            {table ? (
              <>
                <p className="eyebrow mt-6 !text-[11px]">Ce coloană e ce</p>
                <div className="mt-2 grid grid-cols-2 gap-2.5">
                  {ROLES.map((role) => (
                    <RoleSelect
                      key={role}
                      role={role}
                      headers={table.headers}
                      value={mapping[role]}
                      onChange={(value) => setRole(role, value)}
                    />
                  ))}
                </div>
                <p className="mt-2 text-[12.5px] leading-relaxed text-dim">
                  Coloanele nerecunoscute devin câmpuri cu numele lor — nu se pierde nimic.
                </p>
              </>
            ) : null}

            {/* Client ------------------------------------------------ */}
            <p className="eyebrow mt-6 !text-[11px]">În ce client ajung</p>
            <div className="mt-2 space-y-2">
              {hasGroupColumn ? (
                <label className="flex cursor-pointer items-start gap-2.5 text-[14px] text-bone">
                  <input
                    type="radio"
                    name="client-mode"
                    checked={clientMode === "column"}
                    onChange={() => setClientMode("column")}
                    className="mt-1 h-4 w-4 accent-[#edeef2]"
                  />
                  <span>
                    Din {groupLabel}
                    {plan ? (
                      <span className="block text-[12.5px] text-dim">
                        {countNoun(plan.groups.length, "client", "clienți")}
                        {plan.groups.length ? `: ${plan.groups.slice(0, 5).join(", ")}${plan.groups.length > 5 ? "…" : ""}` : ""}
                        {plan.items.some((item) => !item.empty && !item.group)
                          ? ` · rândurile fără folder ajung în „${FALLBACK_CLIENT}”`
                          : ""}
                      </span>
                    ) : null}
                  </span>
                </label>
              ) : null}
              <label className="flex cursor-pointer items-start gap-2.5 text-[14px] text-bone">
                <input
                  type="radio"
                  name="client-mode"
                  checked={clientMode === "single"}
                  onChange={() => setClientMode("single")}
                  className="mt-1 h-4 w-4 accent-[#edeef2]"
                />
                <span className="min-w-0 flex-1">
                  Toate într-un singur client
                  {clientMode === "single" ? (
                    <span className="mt-2 block">
                      <label htmlFor={ids.client} className="sr-only">
                        Client
                      </label>
                      <select
                        id={ids.client}
                        value={singleClient}
                        onChange={(event) => setSingleClient(event.target.value)}
                        className={`${FIELD} h-10 appearance-none !text-[14px]`}
                      >
                        {clients.map((client) => (
                          <option key={client.id} value={client.id}>
                            {client.name}
                          </option>
                        ))}
                        <option value={NEW_CLIENT}>+ Client nou</option>
                      </select>
                      {singleClient === NEW_CLIENT ? (
                        <>
                          <label htmlFor={ids.newClient} className="sr-only">
                            Numele clientului nou
                          </label>
                          <input
                            id={ids.newClient}
                            type="text"
                            value={newClientName}
                            onChange={(event) => setNewClientName(event.target.value)}
                            placeholder="Numele clientului nou"
                            autoComplete="off"
                            className={`${FIELD} mt-2 h-10 !text-[14px]`}
                          />
                        </>
                      ) : null}
                    </span>
                  ) : null}
                </span>
              </label>
            </div>

            {/* Bilanț + previzualizare ------------------------------ */}
            {plan ? (
              <>
                <p className="eyebrow mt-6 !text-[11px]">Ce urmează</p>
                <p className="mt-2 font-md-mono text-[12px] leading-relaxed tracking-[0.04em] text-bone tabular-nums">
                  {countNoun(plan.importable, "intrare nouă", "intrări noi")}
                  {plan.duplicates ? ` · ${countNoun(plan.duplicates, "duplicat", "duplicate")} ${includeDuplicates ? "(se importă)" : "(sărite)"}` : ""}
                  {plan.empty ? ` · ${countNoun(plan.empty, "rând gol", "rânduri goale")} (sărite)` : ""}
                </p>
                {plan.duplicates ? (
                  <label htmlFor={ids.dupes} className="mt-2 flex cursor-pointer items-center gap-2 text-[13.5px] text-bone">
                    <input
                      id={ids.dupes}
                      type="checkbox"
                      checked={includeDuplicates}
                      onChange={(event) => setIncludeDuplicates(event.target.checked)}
                      className="h-4 w-4 accent-[#edeef2]"
                    />
                    Importă și duplicatele (același client, titlu și utilizator)
                  </label>
                ) : null}

                <ul className="mt-4 divide-y divide-hair rounded-panel-sm border border-hair" aria-label="Previzualizare">
                  {plan.items.slice(0, PREVIEW_ROWS).map((item) => {
                    const skipped = item.empty || (item.duplicate && !includeDuplicates);
                    const client = clientMode === "column" ? (item.group ?? FALLBACK_CLIENT) : singleClientName || "—";
                    const username = item.payload.fields.find((f) => f.label === "Utilizator")?.value;
                    return (
                      <li key={item.row} className={`px-3 py-2 ${skipped ? "opacity-50" : ""}`}>
                        <span className="flex items-baseline justify-between gap-3">
                          <span className="min-w-0 truncate text-[13.5px] text-bone">{item.payload.title}</span>
                          <span className="shrink-0 font-md-mono text-[10.5px] uppercase tracking-[0.12em] text-dim">
                            {item.empty ? "gol" : item.duplicate ? "duplicat" : "nou"}
                          </span>
                        </span>
                        <span className="block truncate font-md-mono text-[11.5px] text-dim">
                          {client}
                          {username ? ` · ${username}` : ""}
                        </span>
                      </li>
                    );
                  })}
                  {plan.items.length > PREVIEW_ROWS ? (
                    <li className="px-3 py-2 font-md-mono text-[11px] text-dim">
                      … încă {plan.items.length - PREVIEW_ROWS}
                    </li>
                  ) : null}
                </ul>
              </>
            ) : null}
          </div>
        )}
      </div>

      {source && !outcome ? (
        <div className="flex flex-wrap items-center gap-3 border-t border-hair px-5 py-3.5 sm:px-6">
          <button
            type="button"
            onClick={() => void run()}
            disabled={progress !== null || toImport.length === 0 || !supabase}
            className="btn btn-light !min-h-10 !px-5 !py-2.5 !text-[13.5px] disabled:pointer-events-none disabled:opacity-60"
          >
            {progress
              ? `Se importă… ${progress.done} din ${progress.total}`
              : `Importă ${countNoun(toImport.length, "intrare", "intrări")}`}
          </button>
          {progress ? (
            <span className="font-md-mono text-[11px] tracking-[0.06em] text-dim tabular-nums" role="status">
              criptate local, în loturi
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function RoleSelect({
  role,
  headers,
  value,
  onChange,
}: {
  role: ColumnRole;
  headers: string[];
  value: number | undefined;
  onChange: (value: string) => void;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="eyebrow block !text-[10.5px]">
        {ROLE_LABEL[role]}
      </label>
      <div className="relative mt-1">
        <select
          id={id}
          value={value === undefined ? NO_COLUMN : String(value)}
          onChange={(event) => onChange(event.target.value)}
          className={`${FIELD} h-9 appearance-none !px-3 !pr-8 !text-[13px] ${value === undefined ? "text-dim" : ""}`}
        >
          <option value={NO_COLUMN}>— lipsește</option>
          {headers.map((header, index) => (
            <option key={index} value={String(index)}>
              {header || `coloana ${index + 1}`}
            </option>
          ))}
        </select>
        <svg
          aria-hidden
          viewBox="0 0 10 6"
          className="pointer-events-none absolute right-3 top-1/2 h-1.5 w-2.5 -translate-y-1/2 text-dim"
        >
          <path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </div>
    </div>
  );
}

/** Pasul de dinaintea revizuirii, pentru fișierul nostru: parola de export
    → Argon2id (inelul la vedere) → intrările în clar, în memorie. */
function ExportUnlock({
  fileName,
  counts,
  exportedAt,
  busySince,
  onSubmit,
  onCancel,
}: {
  fileName: string | null;
  counts: { clients: number; entries: number };
  exportedAt: string;
  busySince: number | null;
  onSubmit: (passphrase: string) => void;
  onCancel: () => void;
}) {
  const id = useId();
  const [value, setValue] = useState("");
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (busySince === null) return;
    const interval = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(interval);
  }, [busySince]);

  return (
    <div>
      <p className="font-md-mono text-[11.5px] tracking-[0.06em] text-dim">
        {fileName ?? "text lipit"} · {countNoun(counts.entries, "intrare", "intrări")} ·{" "}
        {countNoun(counts.clients, "client", "clienți")} · exportat {formatDate(exportedAt)}
      </p>
      <p className="mt-3 text-[14.5px] leading-relaxed text-dim">
        Fișierul e criptat cu parola lui de export. Se deschide aici, în browser; ce alegi să imporți
        se re-criptează cu cheia vault-ului ăstuia.
      </p>
      {busySince !== null ? (
        <div className="mt-5 flex items-center gap-4" role="status" aria-live="polite">
          <KeyRing spinning className="h-16 w-16 shrink-0 text-bone" />
          <div>
            <p className="text-[15px] text-bone">Se derivă cheia de export</p>
            <p className="mt-1 font-md-mono text-[12px] tracking-[0.08em] text-dim">
              Argon2id · <span className="text-bone tabular-nums">{formatSeconds(Math.max(0, now - busySince))}</span>
            </p>
          </div>
        </div>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (value) onSubmit(value);
          }}
          className="mt-5"
          noValidate
        >
          <label htmlFor={id} className="eyebrow !text-[11px]">
            Parola de export
          </label>
          <input
            id={id}
            type="password"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            autoComplete="off"
            className={`${FIELD} mt-1.5 h-11`}
          />
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="submit" disabled={!value} className={BTN_SM_LIGHT}>
              Deschide fișierul
            </button>
            <button type="button" onClick={onCancel} className={BTN_SM}>
              Alt fișier
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
