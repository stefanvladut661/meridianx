"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type KeyboardEvent } from "react";
import { KeyRound, Plus, RotateCcw, Search, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ENTRY_KINDS,
  KIND_LABEL,
  unreadableClientName,
  type DeletedEntry,
  type EntryKind,
  type EntryPayload,
  type EntryVersion,
  type VaultEntry,
  type VaultSnapshot,
} from "@/lib/vault/entries";
import type { VaultMember } from "@/lib/vault/members";
import { buildIndex, search } from "@/lib/vault/search";
import { Btn, Card, SectionTitle, SegmentedControl } from "@/components/panou/ui/primitives";
import { InlineNote } from "@/components/panou/ui/actions";
import { EmptyState, ErrorState, LoadingRows, Spinner } from "@/components/panou/ui/states";
import { SoftSelect } from "@/components/panou/ui/select";
import { useToast } from "@/components/panou/ui/toast";
import { dateRo } from "@/components/panou/ui/format";
import { describeError } from "./errors";
import { countNoun, fold } from "./format";
import { EntryEditor, type SaveInput } from "./entry-editor";
import { EntryList } from "./entry-list";
import { EntryPanel } from "./entry-panel";
import { PageHead } from "./ui";

/**
 * Ecranul „Intrări” (VaultPage din prototip): căutare fără diacritice și
 * `#etichetă`, filtre după tip și client, lista pe clienți, fișa din dreapta,
 * editorul, coșul. Tot ce atinge serverul intră prin `api`; ecranul nu știe de
 * Supabase, de chei sau de criptare (le știe containerul din `entries-page.tsx`).
 */

type OkEntry = Extract<VaultEntry, { status: "ok" }>;

export interface EntriesApi {
  /** Creează sau actualizează; întoarce id-ul intrării. Aruncă `VaultDataError` (inclusiv `conflict`). */
  saveEntry: (input: SaveInput) => Promise<string>;
  deleteEntry: (entry: VaultEntry, lastOfClient: boolean) => Promise<void>;
  renameClient: (clientId: string, name: string) => Promise<void>;
  listVersions: (entryId: string) => Promise<EntryVersion[]>;
  restoreVersion: (entry: OkEntry, version: EntryVersion) => Promise<void>;
  loadDeleted: () => Promise<DeletedEntry[]>;
  restoreDeleted: (item: DeletedEntry) => Promise<void>;
}

export type EntriesTab = "intrari" | "cos";

type EditorRequest = { mode: "edit"; id: string } | { mode: "create"; clientId?: string; template?: EntryPayload };
/** `nonce` face din fiecare deschidere un editor nou (altfel „Intrare nouă” de două ori la rând ar păstra draftul). */
type EditorState = (EditorRequest & { nonce: number }) | null;

const DESKTOP = "(min-width: 1024px)";

function subscribeDesktop(onChange: () => void) {
  const query = window.matchMedia(DESKTOP);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function useIsDesktop(): boolean {
  return useSyncExternalStore(
    subscribeDesktop,
    () => window.matchMedia(DESKTOP).matches,
    () => true
  );
}

export function EntriesView({
  snapshot,
  members,
  error,
  reload,
  api,
  selectedId,
  tab,
  onSelect,
  onTab,
  onLock,
}: {
  snapshot: VaultSnapshot | null;
  members: VaultMember[] | null;
  error: string | null;
  reload: () => Promise<void>;
  api: EntriesApi;
  selectedId: string | null;
  tab: EntriesTab;
  onSelect: (id: string | null) => void;
  onTab: (tab: EntriesTab) => void;
  onLock: () => void;
}) {
  const { notify } = useToast();
  const isDesktop = useIsDesktop();
  const [query, setQuery] = useState("");
  const [kindFilter, setKindFilter] = useState<EntryKind | "toate">("toate");
  const [clientFilter, setClientFilter] = useState("toate");
  const [editor, setEditor] = useState<EditorState>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const nonce = useRef(0);

  const entries = useMemo(() => snapshot?.entries ?? [], [snapshot]);
  const index = useMemo(() => (snapshot ? buildIndex(snapshot.entries, snapshot.clients) : null), [snapshot]);
  const result = useMemo(() => (index ? search(index, query) : null), [index, query]);

  /** Filtrele de tip și client se aplică peste căutare. O intrare ilizibilă n-are tip: rămâne mereu în listă, ca integritatea să se vadă. */
  const groups = useMemo(() => {
    if (!result) return [];
    return result.groups
      .filter((group) => clientFilter === "toate" || group.clientId === clientFilter)
      .map((group) => ({
        ...group,
        entries: group.entries.filter((entry) => kindFilter === "toate" || entry.status !== "ok" || entry.payload.kind === kindFilter),
      }))
      .filter((group) => group.entries.length > 0);
  }, [result, kindFilter, clientFilter]);
  const shown = groups.reduce((sum, group) => sum + group.entries.length, 0);

  const topTags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const entry of entries) {
      if (entry.status !== "ok") continue;
      for (const tag of entry.payload.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ro"))
      .slice(0, 8)
      .map(([tag]) => tag);
  }, [entries]);

  const clientOptions = useMemo(
    () => [
      { value: "toate", label: "Toți clienții" },
      ...(snapshot?.clients ?? []).slice().sort((a, b) => a.name.localeCompare(b.name, "ro")).map((client) => ({ value: client.id, label: client.name })),
    ],
    [snapshot]
  );

  const emailOf = useCallback((id: string | null) => (id ? (members?.find((row) => row.id === id)?.email ?? "membru eliminat") : "—"), [members]);

  const selected = selectedId ? (entries.find((entry) => entry.id === selectedId) ?? null) : null;
  const clientNameOf = (clientId: string) => index?.clientsById.get(clientId)?.name ?? unreadableClientName(clientId);
  const siblings = selected ? entries.filter((entry) => entry.clientId === selected.clientId).length : 0;
  const unreadable = entries.filter((entry) => entry.status === "unreadable").length;
  const editing = editor?.mode === "edit" ? (entries.find((entry) => entry.id === editor.id) ?? null) : null;

  // `/` deschide căutarea de oriunde din pagină — nu și din alt câmp.
  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "/" || event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable)) return;
      if (document.querySelector("dialog[open]")) return;
      if (!searchRef.current) return;
      event.preventDefault();
      searchRef.current.focus();
      searchRef.current.select();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Esc închide fișa deschisă (nu și când e deschis un dialog sau se scrie într-un câmp).
  useEffect(() => {
    if (!selectedId) return;
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      if (document.querySelector("dialog[open]")) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT")) return;
      onSelect(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [selectedId, onSelect]);

  // La închiderea fișei, focusul se întoarce pe rândul ei (sau în căutare, dacă rândul nu mai există).
  const previousSelected = useRef<string | null>(null);
  useEffect(() => {
    const previous = previousSelected.current;
    previousSelected.current = selectedId;
    if (previous && !selectedId && tab === "intrari") {
      const row = Array.from(document.querySelectorAll<HTMLElement>("[data-entry-id]")).find((element) => element.dataset.entryId === previous);
      (row ?? searchRef.current)?.focus();
    }
  }, [selectedId, tab]);

  function openEditor(request: EditorRequest) {
    nonce.current += 1;
    setEditor({ ...request, nonce: nonce.current });
  }

  function onSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      const first = document.querySelector<HTMLButtonElement>("[data-entry-row]");
      if (first) {
        event.preventDefault();
        first.focus();
      }
    } else if (event.key === "Escape" && query) {
      event.preventDefault();
      setQuery("");
    }
  }

  async function onSaved(entryId: string) {
    const created = editor?.mode === "create";
    await reload();
    if (created) setQuery("");
    setEditor(null);
    onSelect(entryId);
    notify(created ? "Intrare adăugată. Câmpurile secrete au fost criptate local." : "Intrarea a fost salvată. Versiunea veche rămâne în istoric.");
  }

  async function onDelete(entry: VaultEntry, lastOfClient: boolean) {
    await api.deleteEntry(entry, lastOfClient);
    onSelect(null);
    await reload();
    notify("Intrarea a ajuns în coș. O poți restaura.");
  }

  async function onRename(clientId: string, name: string) {
    try {
      await api.renameClient(clientId, name);
      await reload();
      notify("Clientul a fost redenumit.");
    } catch (cause) {
      notify(describeError(cause, "Redenumirea a eșuat. Încearcă din nou."), "error");
      throw cause;
    }
  }

  const historyApi = useMemo(() => ({ listVersions: api.listVersions, restoreVersion: api.restoreVersion }), [api]);
  const trashed = snapshot?.deletedCount ?? 0;

  return (
    <>
      <PageHead
        title="Intrări"
        text="Secretele nu apar în listă, nici măcar mascate. Se deschid doar în fișă, cu „Arată” pe 30 de secunde."
        action={
          <div className="flex items-center gap-2">
            <SegmentedControl
              options={[
                { value: "intrari", label: "Intrări" },
                { value: "cos", label: `Coș (${trashed})` },
              ]}
              value={tab}
              onChange={(value) => onTab(value)}
              ariaLabel="Intrări sau coș"
              size="sm"
            />
            <Btn size="sm" variant="primary" icon={Plus} disabled={!snapshot} onClick={() => openEditor({ mode: "create" })}>
              Intrare nouă
            </Btn>
          </div>
        }
      />

      {error && snapshot ? <InlineNote tone="rose">{error}</InlineNote> : null}
      {unreadable > 0 && tab === "intrari" ? (
        <InlineNote tone="apricot">
          {countNoun(unreadable, "intrare nu s-a putut decripta", "intrări nu s-au putut decripta")}: rândurile par alterate pe server sau scrise cu o cheie pe care nu o ai. Sunt marcate în listă.
        </InlineNote>
      ) : null}

      {tab === "cos" ? (
        <TrashView api={api} snapshot={snapshot} emailOf={emailOf} onRestored={reload} />
      ) : !snapshot ? (
        error ? (
          <Card padded={false}>
            <ErrorState title="Intrările nu s-au încărcat" text={error} onRetry={() => void reload()} />
          </Card>
        ) : (
          <Card padded={false} className="overflow-hidden">
            <LoadingRows rows={5} cols={3} />
            <p className="sr-only" role="status">
              Se descarcă și se decriptează intrările
            </p>
          </Card>
        )
      ) : (
        <div className={cn("grid gap-4", selectedId && "lg:grid-cols-[minmax(0,1fr)_420px] lg:items-start")}>
          <div className={cn("space-y-3", selectedId && "hidden lg:block")}>
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={onSearchKeyDown}
                  placeholder="Caută fără diacritice: „meta fit”, „#server”"
                  aria-label="Caută în seif"
                  autoComplete="off"
                  spellCheck={false}
                  className="h-9 w-full rounded-lg border border-white/[0.1] bg-white/[0.03] pl-9 pr-9 text-[13px] outline-none placeholder:text-muted-foreground/60 focus:border-mint/40"
                />
                <kbd
                  aria-hidden="true"
                  className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded border border-white/[0.1] bg-white/[0.04] px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:block"
                >
                  /
                </kbd>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <SoftSelect
                  ariaLabel="Tip"
                  value={kindFilter}
                  onChange={(value) => setKindFilter(value as EntryKind | "toate")}
                  options={[{ value: "toate", label: "Toate tipurile" }, ...ENTRY_KINDS.map((kind) => ({ value: kind, label: KIND_LABEL[kind] }))]}
                  className="w-[150px]"
                />
                <SoftSelect ariaLabel="Client" value={clientFilter} onChange={setClientFilter} options={clientOptions} className="w-[168px]" />
                <span className="pu-num ml-auto text-[11px] text-muted-foreground" aria-live="polite">
                  {shown} din {entries.length}
                </span>
              </div>
              {topTags.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1">
                  {topTags.map((tag) => {
                    const active = fold(query.trim()) === fold(`#${tag}`);
                    return (
                      <button
                        key={tag}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setQuery(active ? "" : `#${tag}`)}
                        className={cn(
                          "rounded-full border px-2 py-0.5 text-[10.5px]",
                          active ? "border-lav/40 bg-lav/12 text-[#D8CCFF]" : "border-white/[0.09] text-muted-foreground hover:text-foreground"
                        )}
                      >
                        #{tag}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>

            {shown === 0 ? (
              <Card padded={false}>
                {entries.length === 0 ? (
                  <EmptyState
                    icon={KeyRound}
                    title="Seiful e gol"
                    text="Prima intrare: un client, un titlu, câmpurile pe care le are. Totul se criptează aici, înainte să plece."
                    action={
                      <Btn size="sm" variant="primary" icon={Plus} onClick={() => openEditor({ mode: "create" })}>
                        Adaugă prima intrare
                      </Btn>
                    }
                  />
                ) : (
                  <EmptyState
                    icon={KeyRound}
                    title="Nicio intrare pe căutarea asta"
                    text="Încearcă doar un cuvânt din titlu sau șterge filtrele. Secretele nu sunt niciodată căutabile."
                    action={
                      query || kindFilter !== "toate" || clientFilter !== "toate" ? (
                        <Btn
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setQuery("");
                            setKindFilter("toate");
                            setClientFilter("toate");
                          }}
                        >
                          Șterge filtrele
                        </Btn>
                      ) : undefined
                    }
                  />
                )}
              </Card>
            ) : (
              <EntryList
                groups={groups}
                selectedId={selectedId}
                onSelect={(entry) => onSelect(entry.id)}
                onAddForClient={(clientId) => openEditor({ mode: "create", clientId })}
                onRenameClient={onRename}
              />
            )}

            <p className="px-1 text-[11px] leading-relaxed text-muted-foreground/60">
              Niciun secret nu apare în listă sau în căutare. Lista arată doar metadate.{" "}
              <span className="hidden sm:inline">
                <kbd className="font-mono">/</kbd> caută · <kbd className="font-mono">↑ ↓</kbd> umblă prin listă · <kbd className="font-mono">Enter</kbd> deschide fișa · <kbd className="font-mono">Esc</kbd> închide
                fișa
              </span>
            </p>
          </div>

          {selectedId && selected ? (
            <div className="min-w-0 lg:sticky lg:top-[5.5rem]">
              <button type="button" onClick={() => onSelect(null)} className="mb-2 inline-flex items-center gap-1 text-[11.5px] text-muted-foreground hover:text-foreground lg:hidden">
                ← Toate intrările
              </button>
              <EntryPanel
                key={selected.id}
                entry={selected}
                clientName={clientNameOf(selected.clientId)}
                lastOfClient={siblings <= 1}
                emailOf={emailOf}
                historyApi={historyApi}
                focusOnMount={!isDesktop}
                onClose={() => onSelect(null)}
                onEdit={(entry) => openEditor({ mode: "edit", id: entry.id })}
                onDuplicate={(entry) =>
                  openEditor({ mode: "create", clientId: entry.clientId, template: { ...entry.payload, title: `${entry.payload.title} (copie)` } })
                }
                onDelete={onDelete}
                onChanged={reload}
                onLock={onLock}
              />
            </div>
          ) : null}

          {selectedId && !selected ? (
            <Card padded={false}>
              <EmptyState
                icon={KeyRound}
                title="Intrarea nu există"
                text="Poate a fost ștearsă. Caută în coș sau în listă."
                action={
                  <Btn size="sm" variant="outline" onClick={() => onSelect(null)}>
                    Vezi lista
                  </Btn>
                }
              />
            </Card>
          ) : null}
        </div>
      )}

      {editor && snapshot && (editor.mode === "create" || editing?.status === "ok") ? (
        <EntryEditor
          key={editor.mode === "edit" ? `edit:${editor.id}:${editing?.version}` : `create:${editor.nonce}`}
          mode={editor.mode}
          entry={editor.mode === "edit" && editing?.status === "ok" ? editing : undefined}
          template={editor.mode === "create" ? editor.template : undefined}
          initialClientId={editor.mode === "create" ? editor.clientId : undefined}
          clients={snapshot.clients}
          onClose={() => setEditor(null)}
          onSave={api.saveEntry}
          onSaved={onSaved}
          onReload={reload}
        />
      ) : null}
    </>
  );
}

/** Coșul (tab-ul „Coș” din prototip): intrările șterse, cu restaurare. Ștergerea definitivă nu există în interfață. */
function TrashView({
  api,
  snapshot,
  emailOf,
  onRestored,
}: {
  api: EntriesApi;
  snapshot: VaultSnapshot | null;
  emailOf: (id: string | null) => string;
  onRestored: () => Promise<void>;
}) {
  const { notify } = useToast();
  const [items, setItems] = useState<DeletedEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setItems(await api.loadDeleted());
      setError(null);
    } catch (cause) {
      setError(describeError(cause, "Coșul nu s-a putut încărca. Încearcă din nou."));
    }
  }, [api]);

  // Reîncarcă și când numărul din snapshot se schimbă (o ștergere de pe alt ecran).
  const deletedCount = snapshot?.deletedCount ?? 0;
  useEffect(() => {
    void load();
  }, [load, deletedCount]);

  async function restore(item: DeletedEntry) {
    setBusyId(item.entry.id);
    setError(null);
    try {
      await api.restoreDeleted(item);
      await Promise.all([load(), onRestored()]);
      notify("Intrare restaurată din coș.");
    } catch (cause) {
      setError(describeError(cause, "Restaurarea a eșuat. Încearcă din nou."));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Card padded={false} className="overflow-hidden">
      <div className="border-b border-white/[0.06] px-4 py-3">
        <SectionTitle title="Coș" hint="ștergerea e temporară; nimic nu se pierde definitiv" />
      </div>
      {error ? <p className="border-b border-rose/20 bg-rose/[0.07] px-4 py-2.5 text-[12px] text-[#FFC2CE]" role="alert">{error}</p> : null}
      {items === null ? (
        error ? null : (
          <div className="px-4 py-6">
            <Spinner label="Se decriptează coșul" />
          </div>
        )
      ) : items.length === 0 ? (
        <EmptyState icon={Trash2} title="Coșul e gol" text="Intrările șterse ajung aici și pot fi restaurate oricând." />
      ) : (
        <ul className="divide-y divide-white/[0.05]">
          {items.map((item) => {
            const ok = item.entry.status === "ok" ? item.entry : null;
            return (
              <li key={item.entry.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className={cn("truncate text-[12.5px]", !ok && "text-[#FFC79C]")}>{ok ? ok.payload.title : "Intrare ilizibilă"}</p>
                  <p className="truncate text-[10.5px] text-muted-foreground">
                    {item.clientName}
                    {item.clientDeleted ? " (client șters)" : ""} · {ok ? KIND_LABEL[ok.payload.kind] : "ilizibilă"} · ștearsă {dateRo(item.deletedAt)} de {emailOf(item.entry.updatedBy)}
                  </p>
                  {item.clientDeleted ? <p className="mt-0.5 text-[10.5px] text-muted-foreground/80">Restaurarea aduce înapoi și clientul „{item.clientName}”.</p> : null}
                </div>
                <Btn size="xs" variant="outline" icon={RotateCcw} disabled={busyId === item.entry.id} onClick={() => void restore(item)}>
                  {busyId === item.entry.id ? "Se restaurează…" : "Restaurează"}
                </Btn>
              </li>
            );
          })}
        </ul>
      )}
      <p className="border-t border-white/[0.06] px-4 py-2.5 text-[10.5px] leading-relaxed text-muted-foreground">
        Ștergerea definitivă nu se face din aplicație, doar din SQL, de un om.
      </p>
    </Card>
  );
}
