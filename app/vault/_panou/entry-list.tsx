"use client";

import { useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { KeyRound, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { KIND_LABEL, entrySummary, unreadableClientName, type VaultEntry } from "@/lib/vault/entries";
import type { SearchGroup } from "@/lib/vault/search";
import { Btn, Card, Pill } from "@/components/panou/ui/primitives";
import { TextInput } from "@/components/panou/ui/select";
import { relativeRo } from "@/components/panou/ui/format";
import { countNoun } from "./format";

/**
 * Lista intrărilor, grupată pe client, cu markup-ul din prototip: un Card per
 * client, rânduri cu pictogramă, titlu, tip · număr de câmpuri · etichete și
 * „acum 3 h”. Niciun secret nu ajunge aici, nici mascat: lista se citește de la
 * distanță, fișa de aproape.
 *
 * Peste prototip: rândurile sunt butoane cu săgeți / Home / End (ca într-o listă
 * nativă), iar capul de grup poartă „+ adaugă” și „redenumește”.
 */

export function EntryList({
  groups,
  selectedId,
  onSelect,
  onAddForClient,
  onRenameClient,
}: {
  groups: SearchGroup[];
  selectedId: string | null;
  onSelect: (entry: VaultEntry) => void;
  onAddForClient: (clientId: string) => void;
  onRenameClient: (clientId: string, name: string) => Promise<void>;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key) || !listRef.current) return;
    const rows = Array.from(listRef.current.querySelectorAll<HTMLButtonElement>("[data-entry-row]"));
    if (rows.length === 0) return;
    const index = rows.findIndex((row) => row === document.activeElement);
    let next: number;
    if (event.key === "Home") next = 0;
    else if (event.key === "End") next = rows.length - 1;
    else if (event.key === "ArrowDown") next = index < 0 ? 0 : Math.min(rows.length - 1, index + 1);
    else next = index < 0 ? rows.length - 1 : Math.max(0, index - 1);
    event.preventDefault();
    rows[next].focus();
  }

  return (
    <div ref={listRef} onKeyDown={onKeyDown} className="space-y-3">
      {groups.map((group) => {
        const name = group.client?.name ?? unreadableClientName(group.clientId);
        return (
          <Card key={group.clientId} className="overflow-hidden p-0" as="section" aria-label={`Intrările clientului ${name}`}>
            {renamingId === group.clientId && group.client ? (
              <RenameForm name={group.client.name} onRename={(next) => onRenameClient(group.clientId, next)} onDone={() => setRenamingId(null)} />
            ) : (
              <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-2.5">
                <h3 className="min-w-0 truncate text-[12px] font-medium">{name}</h3>
                <span className="flex shrink-0 items-center gap-3 text-[10.5px] text-muted-foreground">
                  <span>{countNoun(group.entries.length, "intrare", "intrări")}</span>
                  {group.client ? (
                    <>
                      <button
                        type="button"
                        onClick={() => onAddForClient(group.clientId)}
                        className="underline-offset-4 hover:text-foreground hover:underline"
                        aria-label={`Adaugă o intrare pentru ${name}`}
                      >
                        + adaugă
                      </button>
                      <button
                        type="button"
                        onClick={() => setRenamingId(group.clientId)}
                        className="underline-offset-4 hover:text-foreground hover:underline"
                        aria-label={`Redenumește clientul ${name}`}
                      >
                        redenumește
                      </button>
                    </>
                  ) : null}
                </span>
              </div>
            )}
            <ul className="divide-y divide-white/[0.04]">
              {group.entries.map((entry) => (
                <li key={entry.id}>
                  <EntryRow entry={entry} selected={entry.id === selectedId} onSelect={onSelect} />
                </li>
              ))}
            </ul>
          </Card>
        );
      })}
    </div>
  );
}

function EntryRow({ entry, selected, onSelect }: { entry: VaultEntry; selected: boolean; onSelect: (entry: VaultEntry) => void }) {
  const ok = entry.status === "ok" ? entry : null;
  const summary = ok ? entrySummary(ok.payload) : null;
  const tags = ok ? ok.payload.tags : [];
  return (
    <button
      type="button"
      data-entry-row
      data-entry-id={entry.id}
      aria-current={selected ? "true" : undefined}
      onClick={() => onSelect(entry)}
      className={cn(
        "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.03] focus-visible:bg-white/[0.05]",
        selected && "bg-white/[0.05]"
      )}
    >
      <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border", ok ? "border-white/[0.09] bg-white/[0.04]" : "border-apricot/25 bg-apricot/10")}>
        {ok ? <KeyRound className="h-3.5 w-3.5 text-foreground/50" aria-hidden="true" /> : <ShieldAlert className="h-3.5 w-3.5 text-apricot" aria-hidden="true" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className={cn("truncate text-[12.5px]", !ok && "text-[#FFC79C]")}>{ok ? ok.payload.title : "Intrare ilizibilă"}</span>
          {!ok ? <Pill tone="apricot">ilizibil</Pill> : null}
        </span>
        <span className="block truncate text-[10.5px] text-muted-foreground">
          {ok ? (
            <>
              {KIND_LABEL[ok.payload.kind]} · {countNoun(ok.payload.fields.length, "câmp", "câmpuri")}
              {summary ? <> · {summary}</> : null}
              {tags.length > 0 ? <> · {tags.map((tag) => `#${tag}`).join(" ")}</> : null}
            </>
          ) : (
            "nu s-a putut decripta"
          )}
        </span>
      </span>
      <span className="shrink-0 text-[10px] text-muted-foreground">{relativeRo(entry.updatedAt)}</span>
    </button>
  );
}

/** Redenumirea clientului, în locul capului de grup. Numele e criptat ca orice altceva. */
function RenameForm({ name, onRename, onDone }: { name: string; onRename: (name: string) => Promise<void>; onDone: () => void }) {
  const id = useId();
  const [value, setValue] = useState(name);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const next = value.trim();
    if (!next) {
      setError("Numele nu poate fi gol.");
      return;
    }
    if (next === name) {
      onDone();
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onRename(next);
      onDone();
    } catch {
      // Mesajul îl arată pagina; aici doar deblocăm formularul.
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-center gap-2 border-b border-white/[0.06] px-4 py-2" noValidate>
      <label htmlFor={id} className="sr-only">
        Numele clientului
      </label>
      <TextInput
        id={id}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            onDone();
          }
        }}
        autoFocus
        autoComplete="off"
        aria-invalid={error ? true : undefined}
        className="h-8 min-w-0 flex-1 basis-[12rem]"
      />
      <Btn type="submit" size="xs" variant="primary" disabled={saving}>
        {saving ? "Se salvează…" : "Salvează numele"}
      </Btn>
      <Btn size="xs" variant="ghost" disabled={saving} onClick={onDone}>
        Anulează
      </Btn>
      {error ? <p className="basis-full text-[11px] text-rose">{error}</p> : null}
    </form>
  );
}
