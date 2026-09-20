"use client";

import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import {
  ENTRY_KINDS,
  ENTRY_SCHEMA_VERSION,
  KIND_LABEL,
  createClient,
  createEntry,
  normalizeTags,
  templateFields,
  updateEntry,
  type EntryField,
  type EntryKind,
  type EntryPayload,
  type FieldKind,
  type VaultClient,
  type VaultEntry,
} from "@/lib/vault/entries";
import { VaultDataError } from "@/lib/vault/members";
import { VaultCryptoError } from "@/lib/vault/crypto";
import { useVault } from "./vault-provider";
import { BTN_SM, BTN_SM_LIGHT, FIELD, Note } from "./ui";
import { PasswordGenerator } from "./password-generator";

/**
 * Editorul unei intrări (feat/vault, faza 4) — adăugare și editare în
 * aceeași ramă ca fișa: antet, corp derulabil, subsol cu acțiunile.
 *
 * Câmpurile sunt o listă liberă (decizia 2 din faza 3): tipul doar
 * PROPUNE un șablon când intrarea e nouă și omul n-a atins încă
 * câmpurile; după aceea, alegerea tipului nu mai rescrie nimic. Fiecare
 * câmp are etichetă, valoare, „secret" și felul lui (text / URL / text
 * lung); se pot muta și șterge. Un câmp gol de tot se ignoră la salvare.
 *
 * Clientul: unul existent sau unul nou, creat în același pas — abia la
 * salvare, ca anularea să nu lase clienți goi în urmă.
 *
 * Salvarea trece prin concurența optimistă din `entries.ts`: dacă
 * altcineva a salvat aceeași intrare între timp, omul află și nu
 * suprascrie orbește.
 */

const NEW_CLIENT = "__new__";

interface DraftField extends EntryField {
  /** Cheie stabilă pentru React — id-urile de câmp nu există în payload. */
  key: number;
  /** Valoarea unui secret se vede doar la cerere, și în editor. */
  shown: boolean;
}

interface Draft {
  title: string;
  kind: EntryKind;
  clientChoice: string;
  newClientName: string;
  fields: DraftField[];
  tagsText: string;
  notes: string;
}

let keySeed = 1;
const withKeys = (fields: EntryField[]): DraftField[] =>
  fields.map((field) => ({ ...field, key: keySeed++, shown: false }));

function fingerprint(draft: Draft): string {
  return JSON.stringify({
    ...draft,
    fields: draft.fields.map(({ label, value, secret, kind }) => ({ label, value, secret, kind })),
  });
}

function describe(error: unknown): string {
  if (error instanceof VaultDataError || error instanceof VaultCryptoError) return error.message;
  return "Salvarea a eșuat dintr-un motiv necunoscut. Încearcă din nou.";
}

export function EntryEditor({
  mode,
  entry,
  clients,
  initialClientId,
  template,
  headingId,
  discardPrompt,
  onDirtyChange,
  onRequestClose,
  onDiscard,
  onKeepEditing,
  onSaved,
}: {
  mode: "create" | "edit";
  entry?: Extract<VaultEntry, { status: "ok" }>;
  clients: VaultClient[];
  initialClientId?: string;
  /** Duplicare (faza 5): intrarea nouă pornește cu acest payload. */
  template?: EntryPayload;
  headingId: string;
  /** Spațiul de lucru a cerut închiderea peste modificări nesalvate. */
  discardPrompt: boolean;
  onDirtyChange: (dirty: boolean) => void;
  onRequestClose: () => void;
  onDiscard: () => void;
  onKeepEditing: () => void;
  onSaved: (entryId: string) => Promise<void>;
}) {
  const { supabase, keys } = useVault();
  const ids = { title: useId(), kind: useId(), client: useId(), newClient: useId(), tags: useId(), notes: useId() };

  const initial = useMemo<Draft>(() => {
    if (mode === "edit" && entry) {
      return {
        title: entry.payload.title,
        kind: entry.payload.kind,
        clientChoice: entry.clientId,
        newClientName: "",
        fields: withKeys(entry.payload.fields),
        tagsText: entry.payload.tags.join(", "),
        notes: entry.payload.notes,
      };
    }
    const firstClient = initialClientId ?? clients[0]?.id ?? NEW_CLIENT;
    if (template) {
      return {
        title: template.title,
        kind: template.kind,
        clientChoice: firstClient,
        newClientName: "",
        fields: withKeys(template.fields),
        tagsText: template.tags.join(", "),
        notes: template.notes,
      };
    }
    return {
      title: "",
      kind: "login",
      clientChoice: firstClient,
      newClientName: "",
      fields: withKeys(templateFields("login")),
      tagsText: "",
      notes: "",
    };
    // Intenționat doar la montare: editorul se remontează per intrare (key).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [draft, setDraft] = useState<Draft>(initial);
  const [fieldsTouched, setFieldsTouched] = useState(mode === "edit" || Boolean(template));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatorFor, setGeneratorFor] = useState<number | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const initialPrint = useMemo(() => fingerprint(initial), [initial]);

  const dirty = fingerprint(draft) !== initialPrint;
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  const patch = (partial: Partial<Draft>) => setDraft((current) => ({ ...current, ...partial }));

  function setKind(kind: EntryKind) {
    // Șablonul se aplică doar cât câmpurile sunt neatinse.
    if (!fieldsTouched) patch({ kind, fields: withKeys(templateFields(kind)) });
    else patch({ kind });
  }

  function updateField(key: number, partial: Partial<DraftField>) {
    setFieldsTouched(true);
    setDraft((current) => ({
      ...current,
      fields: current.fields.map((field) => (field.key === key ? { ...field, ...partial } : field)),
    }));
  }

  function moveField(key: number, delta: -1 | 1) {
    setFieldsTouched(true);
    setDraft((current) => {
      const index = current.fields.findIndex((field) => field.key === key);
      const next = index + delta;
      if (index < 0 || next < 0 || next >= current.fields.length) return current;
      const fields = current.fields.slice();
      [fields[index], fields[next]] = [fields[next], fields[index]];
      return { ...current, fields };
    });
  }

  function removeField(key: number) {
    setFieldsTouched(true);
    setDraft((current) => ({ ...current, fields: current.fields.filter((field) => field.key !== key) }));
    if (generatorFor === key) setGeneratorFor(null);
  }

  function addField(secret = false) {
    setFieldsTouched(true);
    setDraft((current) => ({
      ...current,
      fields: [...current.fields, { key: keySeed++, label: "", value: "", secret, kind: "text", shown: false }],
    }));
  }

  async function submit(event?: FormEvent) {
    event?.preventDefault();
    if (!supabase || !keys || saving) return;

    const title = draft.title.trim();
    if (!title) {
      setError("Dă-i un titlu intrării.");
      titleRef.current?.focus();
      return;
    }
    const isNewClient = draft.clientChoice === NEW_CLIENT;
    if (isNewClient && !draft.newClientName.trim()) {
      setError("Scrie numele clientului nou.");
      return;
    }
    const fields: EntryField[] = [];
    for (const [index, field] of draft.fields.entries()) {
      const label = field.label.trim();
      const value = field.value;
      if (!label && !value.trim()) continue;
      if (!label) {
        setError(`Câmpul ${index + 1} are valoare, dar nu are etichetă.`);
        return;
      }
      fields.push({ label, value, secret: field.secret, kind: field.kind });
    }

    const payload: EntryPayload = {
      v: ENTRY_SCHEMA_VERSION,
      kind: draft.kind,
      title,
      fields,
      tags: normalizeTags(draft.tagsText),
      notes: draft.notes.trim(),
    };

    setSaving(true);
    setError(null);
    try {
      const clientId = isNewClient
        ? await createClient(supabase, keys.dek, draft.newClientName)
        : draft.clientChoice;
      let id: string;
      if (mode === "edit" && entry) {
        await updateEntry(supabase, keys.dek, { id: entry.id, version: entry.version }, clientId, payload);
        id = entry.id;
      } else {
        id = await createEntry(supabase, keys.dek, clientId, payload);
      }
      onDirtyChange(false);
      await onSaved(id);
    } catch (cause) {
      setError(describe(cause));
      setSaving(false);
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLFormElement>) {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      void submit();
    }
  }

  const clientName =
    draft.clientChoice === NEW_CLIENT
      ? draft.newClientName.trim() || "client nou"
      : (clients.find((client) => client.id === draft.clientChoice)?.name ?? "—");

  return (
    <form onSubmit={submit} onKeyDown={onKeyDown} noValidate className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-4 border-b border-hair px-5 py-5 sm:px-6">
        <div className="min-w-0">
          <p className="font-md-mono text-[10.5px] uppercase tracking-[0.18em] text-dim">
            {mode === "edit" ? "Editezi" : template ? "Copie" : "Intrare nouă"} · {clientName}
          </p>
          <h2 id={headingId} className="display mt-2 break-words text-[1.5rem] text-bone sm:text-[1.625rem]">
            {draft.title.trim() || (mode === "edit" ? entry?.payload.title : "Fără titlu încă")}
          </h2>
        </div>
        <button type="button" onClick={onRequestClose} className={`${BTN_SM} shrink-0`}>
          Anulează
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
        {discardPrompt ? (
          <div className="mb-5 rounded-panel-sm border-l-[3px] border-[#f0b429] bg-[#f0b429]/10 px-3.5 py-3 text-[14px] leading-relaxed text-bone">
            Ai modificări nesalvate. Le lași?
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={onDiscard} className={BTN_SM_LIGHT}>
                Renunță la modificări
              </button>
              <button type="button" onClick={onKeepEditing} className={BTN_SM}>
                Continuă editarea
              </button>
            </div>
          </div>
        ) : null}

        <div aria-live="polite">{error ? <Note tone="error">{error}</Note> : null}</div>

        <Label htmlFor={ids.title}>Titlu</Label>
        <input
          ref={titleRef}
          id={ids.title}
          type="text"
          value={draft.title}
          onChange={(event) => patch({ title: event.target.value })}
          placeholder="ex. WordPress admin"
          autoComplete="off"
          spellCheck={false}
          className={`${FIELD} mt-1.5 h-11`}
        />

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor={ids.kind}>Tip</Label>
            <SelectWrap className="mt-1.5">
              <select
                id={ids.kind}
                value={draft.kind}
                onChange={(event) => setKind(event.target.value as EntryKind)}
                className={`${FIELD} h-11 appearance-none !pr-9`}
              >
                {ENTRY_KINDS.map((kind) => (
                  <option key={kind} value={kind}>
                    {KIND_LABEL[kind]}
                  </option>
                ))}
              </select>
            </SelectWrap>
          </div>
          <div>
            <Label htmlFor={ids.client}>Client</Label>
            <SelectWrap className="mt-1.5">
              <select
                id={ids.client}
                value={draft.clientChoice}
                onChange={(event) => patch({ clientChoice: event.target.value })}
                className={`${FIELD} h-11 appearance-none !pr-9`}
              >
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
                <option value={NEW_CLIENT}>+ Client nou</option>
              </select>
            </SelectWrap>
          </div>
        </div>

        {draft.clientChoice === NEW_CLIENT ? (
          <div className="mt-3">
            <Label htmlFor={ids.newClient}>Numele clientului nou</Label>
            <input
              id={ids.newClient}
              type="text"
              value={draft.newClientName}
              onChange={(event) => patch({ newClientName: event.target.value })}
              placeholder="ex. Băcănia Verde"
              autoComplete="off"
              className={`${FIELD} mt-1.5 h-11`}
            />
          </div>
        ) : null}

        <div className="mt-6 flex items-baseline justify-between">
          <p className="eyebrow !text-[11px]">Câmpuri</p>
          <span className="font-md-mono text-[11px] text-dim">
            {draft.fields.length === 0 ? "niciunul" : draft.fields.length}
          </span>
        </div>

        <div className="mt-2 space-y-2.5">
          {draft.fields.map((field, index) => (
            <FieldEditor
              key={field.key}
              field={field}
              index={index}
              count={draft.fields.length}
              generatorOpen={generatorFor === field.key}
              onChange={(partial) => updateField(field.key, partial)}
              onMove={(delta) => moveField(field.key, delta)}
              onRemove={() => removeField(field.key)}
              onToggleGenerator={() => setGeneratorFor(generatorFor === field.key ? null : field.key)}
            />
          ))}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={() => addField(false)} className={BTN_SM}>
            + Câmp
          </button>
          <button type="button" onClick={() => addField(true)} className={BTN_SM}>
            + Câmp secret
          </button>
        </div>

        <div className="mt-6">
          <Label htmlFor={ids.tags}>Etichete</Label>
          <input
            id={ids.tags}
            type="text"
            value={draft.tagsText}
            onChange={(event) => patch({ tagsText: event.target.value })}
            placeholder="ads, hosting — despărțite prin virgulă"
            autoComplete="off"
            spellCheck={false}
            className={`${FIELD} mt-1.5 h-11`}
          />
        </div>

        <div className="mt-4">
          <Label htmlFor={ids.notes}>Notițe</Label>
          <textarea
            id={ids.notes}
            value={draft.notes}
            onChange={(event) => patch({ notes: event.target.value })}
            rows={3}
            placeholder="Context pentru echipă. Nu pune parole aici — notițele se caută."
            className={`${FIELD} mt-1.5 resize-y py-2.5 leading-relaxed`}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-hair px-5 py-3.5 sm:px-6">
        <button
          type="submit"
          disabled={saving || !supabase}
          className="btn btn-light !min-h-10 !px-5 !py-2.5 !text-[13.5px] disabled:pointer-events-none disabled:opacity-60"
        >
          {saving ? "Se salvează…" : mode === "edit" ? "Salvează modificările" : "Salvează intrarea"}
        </button>
        <span className="font-md-mono text-[11px] tracking-[0.06em] text-dim">Ctrl + Enter</span>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------

/** Un select nativ fără săgeata browserului arată ca un input; îi punem
    noi indicatorul, în mono, ca restul gramaticii. */
function SelectWrap({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={`relative ${className}`}>
      {children}
      <svg
        aria-hidden
        viewBox="0 0 10 6"
        className="pointer-events-none absolute right-3.5 top-1/2 h-1.5 w-2.5 -translate-y-1/2 text-dim"
      >
        <path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    </div>
  );
}

function Label({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="eyebrow block !text-[11px]">
      {children}
    </label>
  );
}

const FIELD_KINDS: Array<[FieldKind, string]> = [
  ["text", "text"],
  ["url", "URL"],
  ["multiline", "text lung"],
];

function FieldEditor({
  field,
  index,
  count,
  generatorOpen,
  onChange,
  onMove,
  onRemove,
  onToggleGenerator,
}: {
  field: DraftField;
  index: number;
  count: number;
  generatorOpen: boolean;
  onChange: (partial: Partial<DraftField>) => void;
  onMove: (delta: -1 | 1) => void;
  onRemove: () => void;
  onToggleGenerator: () => void;
}) {
  const ids = { label: useId(), value: useId(), secret: useId(), kind: useId() };
  const position = `Câmpul ${index + 1}`;
  const valueClass = `${FIELD} h-10 !text-[14px] ${field.secret ? "font-md-mono" : ""}`;

  return (
    <fieldset className="rounded-panel-sm border border-hair bg-ink/40 p-3">
      <legend className="sr-only">{position}</legend>
      <div className="flex gap-2">
        <div className="min-w-0 flex-1">
          <label htmlFor={ids.label} className="sr-only">
            {position}: etichetă
          </label>
          <input
            id={ids.label}
            type="text"
            value={field.label}
            onChange={(event) => onChange({ label: event.target.value })}
            placeholder="Etichetă"
            autoComplete="off"
            spellCheck={false}
            className={`${FIELD} h-10 !text-[14px]`}
          />
        </div>
        <div className="w-[7.5rem] shrink-0">
          <label htmlFor={ids.kind} className="sr-only">
            {position}: fel
          </label>
          <SelectWrap>
            <select
              id={ids.kind}
              value={field.kind}
              onChange={(event) => onChange({ kind: event.target.value as FieldKind })}
              className={`${FIELD} h-10 appearance-none !px-3 !pr-8 !text-[13px]`}
            >
              {FIELD_KINDS.map(([kind, label]) => (
                <option key={kind} value={kind}>
                  {label}
                </option>
              ))}
            </select>
          </SelectWrap>
        </div>
      </div>

      <div className="mt-2 flex gap-2">
        <div className="min-w-0 flex-1">
          <label htmlFor={ids.value} className="sr-only">
            {position}: valoare
          </label>
          {field.kind === "multiline" ? (
            <textarea
              id={ids.value}
              value={field.value}
              onChange={(event) => onChange({ value: event.target.value })}
              rows={3}
              placeholder="Valoare"
              spellCheck={false}
              className={`${FIELD} resize-y py-2 !text-[14px] leading-relaxed`}
            />
          ) : (
            <input
              id={ids.value}
              type={field.secret && !field.shown ? "password" : "text"}
              value={field.value}
              onChange={(event) => onChange({ value: event.target.value })}
              placeholder={field.secret ? "Secret" : "Valoare"}
              autoComplete={field.secret ? "new-password" : "off"}
              spellCheck={false}
              className={valueClass}
            />
          )}
        </div>
        {field.secret && field.kind !== "multiline" ? (
          <button
            type="button"
            onClick={() => onChange({ shown: !field.shown })}
            aria-pressed={field.shown}
            className={`${BTN_SM} shrink-0`}
          >
            {field.shown ? "Ascunde" : "Arată"}
          </button>
        ) : null}
      </div>

      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <label htmlFor={ids.secret} className="flex cursor-pointer items-center gap-2 text-[13px] text-bone">
          <input
            id={ids.secret}
            type="checkbox"
            checked={field.secret}
            onChange={(event) => onChange({ secret: event.target.checked, shown: false })}
            className="h-4 w-4 accent-[#edeef2]"
          />
          secret
        </label>
        <div className="flex items-center gap-1 font-md-mono text-[12px]">
          {field.secret ? (
            <button
              type="button"
              onClick={onToggleGenerator}
              aria-expanded={generatorOpen}
              className="rounded-full px-2 py-1 text-bone underline decoration-hair-strong underline-offset-4 hover:decoration-bone"
            >
              Generează
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => onMove(-1)}
            disabled={index === 0}
            aria-label={`${position}: mută mai sus`}
            className="rounded-full px-2 py-1 text-dim hover:text-bone disabled:opacity-30"
          >
            ↑
          </button>
          <button
            type="button"
            onClick={() => onMove(1)}
            disabled={index === count - 1}
            aria-label={`${position}: mută mai jos`}
            className="rounded-full px-2 py-1 text-dim hover:text-bone disabled:opacity-30"
          >
            ↓
          </button>
          <button
            type="button"
            onClick={onRemove}
            aria-label={`${position}: elimină`}
            className="rounded-full px-2 py-1 text-dim hover:text-[#ff8a8a]"
          >
            Elimină
          </button>
        </div>
      </div>

      {generatorOpen ? (
        <PasswordGenerator
          onUse={(password) => {
            onChange({ value: password, shown: true });
            onToggleGenerator();
          }}
          onClose={onToggleGenerator}
        />
      ) : null}
    </fieldset>
  );
}
