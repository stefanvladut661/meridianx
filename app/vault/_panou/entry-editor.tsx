"use client";

import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { ArrowDown, ArrowUp, Eye, EyeOff, Plus, Save, Trash2, Wand2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ENTRY_KINDS,
  ENTRY_SCHEMA_VERSION,
  KIND_LABEL,
  normalizeTags,
  templateFields,
  type EntryField,
  type EntryKind,
  type EntryPayload,
  type FieldKind,
  type VaultClient,
  type VaultEntry,
} from "@/lib/vault/entries";
import { parseTotp } from "@/lib/vault/totp";
import { GENERATOR_DEFAULTS, GENERATOR_MAX, GENERATOR_MIN, entropyBits, generatePassword, type GeneratorOptions } from "@/lib/vault/generate";
import { Btn, Pill, SectionTitle } from "@/components/panou/ui/primitives";
import { InlineNote } from "@/components/panou/ui/actions";
import { SoftSelect, TextInput } from "@/components/panou/ui/select";
import { copyWithExpiry } from "../_components/clipboard";
import { describeError, isConflict } from "./errors";
import { LABEL_CLASS } from "./ui";

/**
 * Editorul intrării (EntryEditor din prototip): adaugă, editează, duplică.
 *
 * Câmpurile sunt o listă LIBERĂ; tipul doar PROPUNE un șablon și numai cât timp
 * câmpurile sunt neatinse. Un secret se vede în editor doar la cerere. La
 * modificări nesalvate, închiderea întreabă. La salvare, versiunea văzută de om
 * merge la server: dacă altcineva a salvat între timp, nu suprascriem nimic.
 */

type OkEntry = Extract<VaultEntry, { status: "ok" }>;

export const NEW_CLIENT = "__new__";

export interface SaveInput {
  mode: "create" | "edit";
  entry?: OkEntry;
  /** Id-ul unui client existent sau `NEW_CLIENT`. */
  clientChoice: string;
  newClientName: string;
  payload: EntryPayload;
}

interface DraftField extends EntryField {
  /** Cheie stabilă pentru React — câmpurile nu au id în payload. */
  key: number;
  /** Valoarea unui secret se vede în editor doar la cerere. */
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
const withKeys = (fields: EntryField[]): DraftField[] => fields.map((field) => ({ ...field, key: keySeed++, shown: false }));

function fingerprint(draft: Draft): string {
  return JSON.stringify({ ...draft, fields: draft.fields.map(({ label, value, secret, kind }) => ({ label, value, secret, kind })) });
}

const FIELD_KIND_OPTIONS: { value: FieldKind; label: string }[] = [
  { value: "text", label: "text" },
  { value: "multiline", label: "lung" },
  { value: "url", label: "link" },
  { value: "totp", label: "2FA" },
];

/** `<dialog>` propriu: ca și Modal din kit, dar poate refuza închiderea (Esc, clic pe fundal) cât timp există modificări nesalvate. */
function EditorDialog({ label, onRequestClose, children }: { label: string; onRequestClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const requestRef = useRef(onRequestClose);
  requestRef.current = onRequestClose;

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    return () => {
      // Închiderea explicită întoarce focusul pe butonul de unde s-a deschis editorul.
      if (dialog.open) dialog.close();
    };
  }, []);

  return (
    <dialog
      ref={ref}
      aria-label={label}
      onCancel={(event) => {
        event.preventDefault();
        requestRef.current();
      }}
      onClick={(event) => {
        if (event.target === ref.current) requestRef.current();
      }}
      className="m-auto max-h-[90vh] w-[min(42rem,calc(100vw-1rem))] max-w-none overflow-y-auto rounded-[22px] border border-white/[0.09] bg-[#0F0F13] p-0 text-foreground shadow-[0_30px_80px_-30px_rgba(0,0,0,0.95)] backdrop:bg-black/70"
    >
      {children}
    </dialog>
  );
}

export function EntryEditor({
  mode,
  entry,
  template,
  initialClientId,
  clients,
  onClose,
  onSave,
  onSaved,
  onReload,
}: {
  mode: "create" | "edit";
  entry?: OkEntry;
  /** Duplicare: intrarea nouă pornește cu acest payload. */
  template?: EntryPayload;
  initialClientId?: string;
  clients: VaultClient[];
  onClose: () => void;
  onSave: (input: SaveInput) => Promise<string>;
  onSaved: (entryId: string) => Promise<void> | void;
  /** „Altcineva a salvat între timp”: reîncarcă versiunea nouă. */
  onReload: () => Promise<void>;
}) {
  const ids = { title: useId(), tags: useId(), notes: useId(), newClient: useId() };

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
    return { title: "", kind: "login", clientChoice: firstClient, newClientName: "", fields: withKeys(templateFields("login")), tagsText: "", notes: "" };
    // Intenționat doar la montare: editorul se remontează per intrare și per versiune (key).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [draft, setDraft] = useState<Draft>(initial);
  const [fieldsTouched, setFieldsTouched] = useState(mode === "edit" || Boolean(template));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [reloading, setReloading] = useState(false);
  const [discardPrompt, setDiscardPrompt] = useState(false);
  const initialPrint = useMemo(() => fingerprint(initial), [initial]);
  const dirty = fingerprint(draft) !== initialPrint;
  const focusTitle = () => document.getElementById(ids.title)?.focus();

  useEffect(() => {
    document.getElementById(ids.title)?.focus();
  }, [ids.title]);

  // Fereastra închisă cu modificări nesalvate: întreabă browserul.
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const patch = (partial: Partial<Draft>) => setDraft((current) => ({ ...current, ...partial }));

  function requestClose() {
    if (saving) return;
    if (dirty) setDiscardPrompt(true);
    else onClose();
  }

  function setKind(kind: EntryKind) {
    // Șablonul se aplică doar cât câmpurile sunt neatinse.
    if (!fieldsTouched) patch({ kind, fields: withKeys(templateFields(kind)) });
    else patch({ kind });
  }

  function updateField(key: number, partial: Partial<DraftField>) {
    setFieldsTouched(true);
    setDraft((current) => ({ ...current, fields: current.fields.map((field) => (field.key === key ? { ...field, ...partial } : field)) }));
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
  }

  function addField(partial: Partial<EntryField> = {}) {
    setFieldsTouched(true);
    setDraft((current) => ({
      ...current,
      fields: [...current.fields, { key: keySeed++, label: "", value: "", secret: true, kind: "text", shown: false, ...partial }],
    }));
  }

  /** „Adaugă ca parolă”: umple primul câmp secret gol, altfel adaugă unul nou. */
  function applyGenerated(password: string) {
    setFieldsTouched(true);
    setDraft((current) => {
      const target = current.fields.find((field) => field.secret && field.kind === "text" && field.value === "");
      if (target) {
        return { ...current, fields: current.fields.map((field) => (field.key === target.key ? { ...field, value: password, shown: true } : field)) };
      }
      return { ...current, fields: [...current.fields, { key: keySeed++, label: "Parolă", value: password, secret: true, kind: "text", shown: true }] };
    });
  }

  async function submit(event?: FormEvent) {
    event?.preventDefault();
    if (saving) return;

    const title = draft.title.trim();
    if (!title) {
      setError("Dă-i un titlu intrării.");
      focusTitle();
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
      if (!label && !field.value.trim()) continue;
      if (!label) {
        setError(`Câmpul ${index + 1} are valoare, dar nu are etichetă.`);
        return;
      }
      if (field.kind === "totp" && field.value.trim() && !parseTotp(field.value)) {
        setError(`„${label}”: seed-ul 2FA nu e valid — aștept base32 (ca JBSW Y3DP…) sau un link otpauth://totp/….`);
        return;
      }
      fields.push({ label, value: field.value, secret: field.secret || field.kind === "totp", kind: field.kind });
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
    setConflict(false);
    try {
      const id = await onSave({ mode, entry, clientChoice: draft.clientChoice, newClientName: draft.newClientName, payload });
      await onSaved(id);
    } catch (cause) {
      if (isConflict(cause)) setConflict(true);
      else setError(describeError(cause, "Salvarea a eșuat dintr-un motiv necunoscut. Încearcă din nou."));
      setSaving(false);
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLFormElement>) {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      void submit();
    }
  }

  const heading = mode === "edit" ? "Editează intrarea" : template ? "Intrare nouă (copie)" : "Intrare nouă";

  return (
    <EditorDialog label={heading} onRequestClose={requestClose}>
      <form onSubmit={submit} onKeyDown={onKeyDown} noValidate>
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-white/[0.07] bg-[#0F0F13] px-5 py-3.5">
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold">{heading}</h2>
            <p className="text-[11px] text-muted-foreground">Câmpurile marcate secret se criptează înainte să plece din browser.</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {dirty ? <Pill tone="apricot">nesalvat</Pill> : null}
            <Btn type="submit" size="sm" variant="primary" icon={Save} disabled={saving}>
              {saving ? "Se salvează…" : "Salvează"}
            </Btn>
            <button type="button" onClick={requestClose} className="rounded-md p-1.5 text-muted-foreground hover:bg-white/[0.06] hover:text-foreground" aria-label="Închide editorul">
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="space-y-4 px-5 py-4">
          {discardPrompt ? (
            <InlineNote tone="apricot">
              Ai modificări nesalvate. Le lași?
              <span className="mt-2 flex flex-wrap gap-2">
                <Btn size="xs" variant="outline" onClick={onClose}>
                  Renunță la modificări
                </Btn>
                <Btn size="xs" variant="ghost" onClick={() => setDiscardPrompt(false)}>
                  Continuă editarea
                </Btn>
              </span>
            </InlineNote>
          ) : null}

          <div aria-live="polite" className="space-y-2">
            {error ? <InlineNote tone="rose">{error}</InlineNote> : null}
            {conflict ? (
              <InlineNote tone="rose">
                Altcineva a salvat această intrare între timp. Nu am suprascris nimic. Reîncarcă versiunea nouă, apoi aplică modificările tale.
                <button
                  type="button"
                  disabled={reloading}
                  className="ml-2 underline underline-offset-2"
                  onClick={async () => {
                    setReloading(true);
                    try {
                      await onReload();
                    } finally {
                      setReloading(false);
                    }
                  }}
                >
                  {reloading ? "Se reîncarcă…" : "Reîncarcă versiunea"}
                </button>
              </InlineNote>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor={ids.title} className={LABEL_CLASS}>
                Titlu
              </label>
              <TextInput
                id={ids.title}
                className="mt-1"
                value={draft.title}
                onChange={(event) => patch({ title: event.target.value })}
                placeholder="ex. Instagram · Meridian"
                autoComplete="off"
                spellCheck={false}
              />
            </div>
            <SoftSelect label="Tip" value={draft.kind} onChange={(value) => setKind(value as EntryKind)} options={ENTRY_KINDS.map((kind) => ({ value: kind, label: KIND_LABEL[kind] }))} />
            <SoftSelect
              label="Client"
              value={draft.clientChoice}
              onChange={(value) => patch({ clientChoice: value })}
              options={[...clients.map((client) => ({ value: client.id, label: client.name })), { value: NEW_CLIENT, label: "+ Client nou" }]}
            />
            {draft.clientChoice === NEW_CLIENT ? (
              <div className="sm:col-span-2">
                <label htmlFor={ids.newClient} className={LABEL_CLASS}>
                  Numele clientului nou
                </label>
                <TextInput
                  id={ids.newClient}
                  className="mt-1"
                  value={draft.newClientName}
                  onChange={(event) => patch({ newClientName: event.target.value })}
                  placeholder="ex. Băcănia Verde"
                  autoComplete="off"
                />
              </div>
            ) : null}
            <div className="sm:col-span-2">
              <label htmlFor={ids.tags} className={LABEL_CLASS}>
                Etichete (separate prin virgulă)
              </label>
              <TextInput
                id={ids.tags}
                className="mt-1"
                value={draft.tagsText}
                onChange={(event) => patch({ tagsText: event.target.value })}
                placeholder="social, prioritar"
                autoComplete="off"
                spellCheck={false}
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor={ids.notes} className={LABEL_CLASS}>
                Notițe
              </label>
              <textarea
                id={ids.notes}
                value={draft.notes}
                onChange={(event) => patch({ notes: event.target.value })}
                rows={2}
                placeholder="Context pentru echipă. Nu pune parole aici: notițele se caută."
                className="mt-1 w-full resize-y rounded-lg border border-white/[0.12] bg-white/[0.03] p-2.5 text-[12.5px] outline-none focus:border-lav/50"
              />
            </div>
          </div>

          <div>
            <SectionTitle
              title="Câmpuri"
              hint={`${draft.fields.length === 0 ? "niciun câmp" : `${draft.fields.length} câmpuri`} · poți pune orice etichetă`}
              action={
                <span className="flex gap-1.5">
                  <Btn size="xs" variant="outline" icon={Plus} onClick={() => addField()}>
                    Adaugă câmp
                  </Btn>
                  <Btn size="xs" variant="outline" icon={Plus} onClick={() => addField({ label: "Cod 2FA", kind: "totp" })}>
                    Cod 2FA
                  </Btn>
                </span>
              }
            />
            <div className="mt-2 space-y-2">
              {draft.fields.map((field, index) => (
                <FieldEditor
                  key={field.key}
                  field={field}
                  index={index}
                  count={draft.fields.length}
                  onChange={(partial) => updateField(field.key, partial)}
                  onMove={(delta) => moveField(field.key, delta)}
                  onRemove={() => removeField(field.key)}
                />
              ))}
            </div>
          </div>

          <Generator onUse={applyGenerated} />
        </div>
      </form>
    </EditorDialog>
  );
}

function FieldEditor({
  field,
  index,
  count,
  onChange,
  onMove,
  onRemove,
}: {
  field: DraftField;
  index: number;
  count: number;
  onChange: (partial: Partial<DraftField>) => void;
  onMove: (delta: -1 | 1) => void;
  onRemove: () => void;
}) {
  const position = `Câmpul ${index + 1}`;
  const isTotp = field.kind === "totp";
  const masked = field.secret && !field.shown && field.kind !== "multiline";
  return (
    <div className="grid items-center gap-1.5 border-b border-white/[0.05] pb-2 last:border-0 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto] sm:border-0 sm:pb-0">
      <TextInput value={field.label} onChange={(event) => onChange({ label: event.target.value })} aria-label={`Eticheta câmpului ${index + 1}`} placeholder="Etichetă" autoComplete="off" spellCheck={false} />
      {field.kind === "multiline" ? (
        <textarea
          value={field.value}
          onChange={(event) => onChange({ value: event.target.value })}
          aria-label={`Valoarea câmpului ${index + 1}`}
          rows={3}
          spellCheck={false}
          className="w-full resize-y rounded-lg border border-white/[0.12] bg-white/[0.03] p-2 font-mono text-[11.5px] outline-none focus:border-lav/50"
        />
      ) : (
        <div className="flex items-center gap-1">
          <TextInput
            type={masked ? "password" : "text"}
            value={field.value}
            onChange={(event) => onChange({ value: event.target.value })}
            aria-label={`Valoarea câmpului ${index + 1}`}
            placeholder={isTotp ? "Seed base32 sau otpauth://totp/…" : field.secret ? "Secret" : "Valoare"}
            autoComplete={field.secret ? "new-password" : "off"}
            spellCheck={false}
            className="font-mono text-[11.5px]"
          />
          {field.secret ? (
            <button
              type="button"
              onClick={() => onChange({ shown: !field.shown })}
              aria-pressed={field.shown}
              aria-label={`${field.shown ? "Ascunde" : "Arată"} valoarea câmpului ${index + 1}`}
              className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:text-foreground"
            >
              {field.shown ? <EyeOff className="h-3.5 w-3.5" aria-hidden="true" /> : <Eye className="h-3.5 w-3.5" aria-hidden="true" />}
            </button>
          ) : null}
        </div>
      )}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onChange({ secret: !field.secret, shown: false })}
          disabled={isTotp}
          aria-pressed={field.secret}
          className={cn("rounded-md border px-1.5 py-1 text-[10px] disabled:opacity-70", field.secret ? "border-mint/25 bg-mint/10 text-mint" : "border-white/[0.1] text-muted-foreground")}
          aria-label={`${position}: ${field.secret ? "secret" : "public"}${isTotp ? " (seed 2FA, mereu secret)" : ""}`}
        >
          {field.secret ? "secret" : "public"}
        </button>
        <SoftSelect
          ariaLabel={`Tipul câmpului ${index + 1}`}
          value={field.kind}
          onChange={(value) => {
            const kind = value as FieldKind;
            onChange(kind === "totp" ? { kind, secret: true, shown: false } : { kind });
          }}
          options={FIELD_KIND_OPTIONS}
          className="w-[74px]"
        />
        <button
          type="button"
          onClick={() => onMove(-1)}
          disabled={index === 0}
          className="rounded p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
          aria-label={`${position}: mută mai sus`}
        >
          <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => onMove(1)}
          disabled={index === count - 1}
          className="rounded p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
          aria-label={`${position}: mută mai jos`}
        >
          <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
        <button type="button" onClick={onRemove} className="rounded p-1 text-muted-foreground hover:text-rose" aria-label={`${position}: scoate câmpul`}>
          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

/** Generatorul de parole din prototip. Entropia e cifra reală (`lungime · log2(alfabet)`), iar alegerea e uniformă (WebCrypto, cu respingere). */
function Generator({ onUse }: { onUse: (password: string) => void }) {
  const [options, setOptions] = useState<GeneratorOptions>(GENERATOR_DEFAULTS);
  const [value, setValue] = useState("");
  const [copied, setCopied] = useState(false);
  const entropy = entropyBits(options);

  function update(partial: Partial<GeneratorOptions>) {
    const next = { ...options, ...partial };
    setOptions(next);
    // Cât există o parolă generată, ea urmărește opțiunile.
    if (value) setValue(generatePassword(next));
    setCopied(false);
  }

  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3">
      <SectionTitle
        title="Generator de parole"
        hint={`${entropy} biți de entropie`}
        action={
          <Btn
            size="xs"
            variant="outline"
            icon={Wand2}
            onClick={() => {
              setValue(generatePassword(options));
              setCopied(false);
            }}
          >
            {value ? "Alta" : "Generează"}
          </Btn>
        }
      />
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          lungime
          <input
            type="range"
            min={GENERATOR_MIN}
            max={GENERATOR_MAX}
            value={options.length}
            onChange={(event) => update({ length: Number(event.target.value) })}
            className="w-24 accent-[#C6B5FF]"
            aria-label="Lungimea parolei"
          />
          <span className="pu-num w-5 text-foreground/80">{options.length}</span>
        </label>
        {(
          [
            ["digits", "0-9"],
            ["symbols", "!@#"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => update({ [key]: !options[key] })}
            className={cn("rounded-md border px-1.5 py-0.5 text-[10.5px]", options[key] ? "border-lav/30 bg-lav/10 text-[#D8CCFF]" : "border-white/[0.1] text-muted-foreground")}
            aria-pressed={options[key]}
          >
            {label}
          </button>
        ))}
      </div>
      {value ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-lg border border-white/[0.09] bg-[#0A0A0E] px-2.5 py-1.5 font-mono text-[12px] text-mint select-all">{value}</code>
          <Btn
            size="xs"
            variant="outline"
            onClick={async () => {
              try {
                await copyWithExpiry(value);
                setCopied(true);
              } catch {
                setCopied(false);
              }
            }}
          >
            {copied ? "45s apoi șters" : "Copiază"}
          </Btn>
          <Btn size="xs" variant="outline" onClick={() => onUse(value)}>
            Adaugă ca parolă
          </Btn>
        </div>
      ) : null}
    </div>
  );
}
