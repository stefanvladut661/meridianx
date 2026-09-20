"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
} from "react";
import { renameClient, type EntryPayload, type VaultEntry, type VaultSnapshot } from "@/lib/vault/entries";
import type { VaultMember } from "@/lib/vault/members";
import { buildIndex, search } from "@/lib/vault/search";
import { useVault } from "./vault-provider";
import { EntryList } from "./entry-list";
import { EntryPanel } from "./entry-panel";
import { EntryEditor } from "./entry-editor";
import { ImportPanel } from "./import-panel";
import { clearClipboardNow } from "./clipboard";
import { BTN_SM, BTN_SM_LIGHT, FIELD, Note, countNoun } from "./ui";

/**
 * Spațiul de lucru al intrărilor (feat/vault, fazele 3–4): căutarea,
 * lista grupată pe client și panoul din dreapta — fișa intrării alese
 * SAU editorul (intrare nouă / editare), în aceeași ramă.
 *
 * Căutarea e instrumentul principal — se deschide cu `/` de oriunde,
 * ca în orice unealtă de zi cu zi — și rulează peste ce e deja
 * decriptat în memorie. Sub ea, fâșia de fapte: câte intrări, câți
 * clienți, în cât timp s-au deschis local. Nu e statistică decorativă;
 * e afirmația modelului zero-knowledge, cu cifre.
 *
 * Panoul: pe ecran lat stă alături de listă, lipit de sus; pe telefon
 * acoperă lista ca un dialog cu focus captiv, Escape îl închide și
 * focusul se întoarce pe rândul de unde a plecat. Un editor cu
 * modificări nesalvate nu se închide fără să întrebe.
 */

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

type Panel =
  | { kind: "view"; id: string }
  | { kind: "edit"; id: string }
  /** `template`: o copie (Duplică) — editorul pornește cu payload-ul ei. */
  | { kind: "create"; clientId?: string; template?: EntryPayload }
  | { kind: "import" }
  | null;

export function EntriesWorkspace({
  snapshot,
  members,
  loading,
  error,
  reload,
}: {
  snapshot: VaultSnapshot | null;
  members: VaultMember[] | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}) {
  const { supabase, keys } = useVault();
  const [query, setQuery] = useState("");
  const [panel, setPanel] = useState<Panel>(null);
  const [discardPrompt, setDiscardPrompt] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const dirtyRef = useRef(false);
  /** Ce voia omul să facă atunci când l-am oprit cu „modificări nesalvate". */
  const pendingRef = useRef<Panel | "close">("close");
  const isDesktop = useIsDesktop();
  const searchId = useId();
  const headingId = useId();

  const index = useMemo(
    () => (snapshot ? buildIndex(snapshot.entries, snapshot.clients) : null),
    [snapshot]
  );
  const result = useMemo(() => (index ? search(index, query) : null), [index, query]);

  const panelId = panel && (panel.kind === "view" || panel.kind === "edit") ? panel.id : null;
  const selected = useMemo(
    () => (panelId ? (snapshot?.entries.find((entry) => entry.id === panelId) ?? null) : null),
    [snapshot, panelId]
  );
  const selectedClient = selected ? (index?.clientsById.get(selected.clientId) ?? null) : null;
  const siblings = selected
    ? (snapshot?.entries.filter((entry) => entry.clientId === selected.clientId).length ?? 1)
    : 0;

  // `/` deschide căutarea de oriunde din pagină — nu și din alt câmp.
  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "/" || event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }
      event.preventDefault();
      searchRef.current?.focus();
      searchRef.current?.select();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // La blocare (shell-ul se demontează), clipboard-ul nu rămâne cu o parolă.
  useEffect(() => () => clearClipboardNow(), []);

  const editing = panel?.kind === "edit" || panel?.kind === "create";

  /** Schimbă panoul, dar nu peste un editor cu modificări nesalvate:
      atunci întreabă întâi, și ține minte unde voia să ajungă omul. */
  const go = useCallback(
    (next: Panel | "close") => {
      if (dirtyRef.current && editing) {
        pendingRef.current = next;
        setDiscardPrompt(true);
        return;
      }
      setDiscardPrompt(false);
      setPanel(next === "close" ? null : next);
    },
    [editing]
  );

  const select = useCallback(
    (entry: VaultEntry) => {
      returnFocusRef.current = document.activeElement as HTMLElement | null;
      go({ kind: "view", id: entry.id });
    },
    [go]
  );

  /** La închidere, focusul se întoarce pe rândul intrării — de acolo a
      plecat, acolo continuă navigarea. Dacă rândul nu mai e (căutarea
      l-a filtrat între timp), pe elementul activ dinainte; altfel, în
      căutare. */
  const restoreFocus = useCallback(() => {
    const row = document.querySelector<HTMLElement>('[data-entry-row][aria-current="true"]');
    const back = returnFocusRef.current;
    returnFocusRef.current = null;
    if (row) row.focus();
    else if (back && back !== document.body && document.contains(back)) back.focus();
    else searchRef.current?.focus();
  }, []);

  const close = useCallback(() => {
    if (dirtyRef.current && editing) {
      pendingRef.current = "close";
      setDiscardPrompt(true);
      return;
    }
    setDiscardPrompt(false);
    setPanel(null);
    restoreFocus();
  }, [editing, restoreFocus]);

  const discard = useCallback(() => {
    dirtyRef.current = false;
    setDiscardPrompt(false);
    const next = pendingRef.current;
    pendingRef.current = "close";
    if (next === "close") {
      setPanel(null);
      restoreFocus();
    } else {
      setPanel(next);
    }
  }, [restoreFocus]);

  const onDirtyChange = useCallback((dirty: boolean) => {
    dirtyRef.current = dirty;
  }, []);

  const onSaved = useCallback(
    async (entryId: string) => {
      dirtyRef.current = false;
      setDiscardPrompt(false);
      await reload();
      // O intrare nouă trebuie văzută: căutarea activă ar putea-o ascunde.
      if (panel?.kind === "create") setQuery("");
      setPanel({ kind: "view", id: entryId });
      // Rândul salvat intră în ecran — un client nou ajunge la coada listei.
      requestAnimationFrame(() => {
        document
          .querySelector('[data-entry-row][aria-current="true"]')
          ?.scrollIntoView({ block: "nearest" });
      });
    },
    [reload, panel]
  );

  const onDeleted = useCallback(async () => {
    setPanel(null);
    await reload();
    searchRef.current?.focus();
  }, [reload]);

  const onRenameClient = useCallback(
    async (clientId: string, name: string) => {
      if (!supabase || !keys) return;
      setActionError(null);
      try {
        await renameClient(supabase, keys.dek, clientId, name);
        await reload();
      } catch (cause) {
        setActionError(cause instanceof Error ? cause.message : "Redenumirea a eșuat.");
        throw cause;
      }
    },
    [supabase, keys, reload]
  );

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

  const entriesCount = snapshot?.entries.length ?? 0;
  const clientsCount = snapshot?.clients.length ?? 0;
  const unreadable = snapshot?.entries.filter((entry) => entry.status === "unreadable").length ?? 0;
  const trimmedQuery = query.trim();

  const empty =
    entriesCount === 0
      ? {
          title: "Vault-ul e gol",
          body: "Prima intrare: un client, un titlu, câmpurile pe care le are. Totul se criptează aici, înainte să plece.",
          action: { label: "Adaugă prima intrare", onClick: () => go({ kind: "create" }) },
        }
      : {
          title: `Nimic pentru „${trimmedQuery}”`,
          body: "Caută după titlu, client, #etichetă, utilizator sau notițe. Secretele nu se caută niciodată.",
        };

  const panelContent =
    panel?.kind === "create" || (panel?.kind === "edit" && selected?.status === "ok") ? (
      <EntryEditor
        key={panel.kind === "edit" ? `edit:${panel.id}:${selected?.version}` : `create:${panel.clientId ?? ""}:${panel.template?.title ?? ""}`}
        mode={panel.kind}
        entry={panel.kind === "edit" && selected?.status === "ok" ? selected : undefined}
        clients={snapshot?.clients ?? []}
        initialClientId={panel.kind === "create" ? panel.clientId : undefined}
        template={panel.kind === "create" ? panel.template : undefined}
        headingId={headingId}
        discardPrompt={discardPrompt}
        onDirtyChange={onDirtyChange}
        onRequestClose={close}
        onDiscard={discard}
        onKeepEditing={() => setDiscardPrompt(false)}
        onSaved={onSaved}
      />
    ) : panel?.kind === "import" ? (
      <ImportPanel
        clients={snapshot?.clients ?? []}
        entries={snapshot?.entries ?? []}
        headingId={headingId}
        onClose={close}
        onImported={reload}
      />
    ) : selected ? (
      <EntryPanel
        entry={selected}
        client={selectedClient}
        members={members}
        siblings={siblings}
        headingId={headingId}
        onClose={close}
        onEdit={() => go({ kind: "edit", id: selected.id })}
        onDuplicate={
          selected.status === "ok"
            ? () =>
                go({
                  kind: "create",
                  clientId: selected.clientId,
                  template: { ...selected.payload, title: `${selected.payload.title} (copie)` },
                })
            : undefined
        }
        onDeleted={onDeleted}
      />
    ) : null;

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:items-start lg:gap-6">
      <section aria-labelledby={`${searchId}-titlu`} className="min-w-0">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow !text-[11.5px]">Deblocat · decriptat în fila asta</p>
            <h1 id={`${searchId}-titlu`} className="display mt-2 text-[2.25rem] text-bone sm:text-[2.75rem]">
              Parolele echipei
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => void reload()} disabled={loading} className={BTN_SM}>
              {loading ? "Se reîncarcă…" : "Reîncarcă"}
            </button>
            <button type="button" onClick={() => go({ kind: "import" })} disabled={!snapshot} className={BTN_SM}>
              Importă CSV
            </button>
            <button
              type="button"
              onClick={() => go({ kind: "create" })}
              disabled={!snapshot}
              className={BTN_SM_LIGHT}
            >
              Adaugă intrare
            </button>
          </div>
        </div>

        <p className="mt-3 font-md-mono text-[11.5px] tracking-[0.08em] text-dim" aria-live="polite">
          {snapshot ? (
            <>
              {countNoun(entriesCount, "intrare", "intrări")} · {countNoun(clientsCount, "client", "clienți")} ·
              decriptate local în <span className="text-bone tabular-nums">{Math.max(1, Math.round(snapshot.decryptMs))} ms</span>
            </>
          ) : loading ? (
            "se descarcă și se decriptează…"
          ) : (
            " "
          )}
        </p>

        <div aria-live="polite">
          {error ? <Note tone="error">{error}</Note> : null}
          {actionError ? <Note tone="error">{actionError}</Note> : null}
          {unreadable > 0 ? (
            <Note tone="error">
              {countNoun(unreadable, "intrare nu s-a putut decripta", "intrări nu s-au putut decripta")} — rândurile
              par alterate pe server. Sunt marcate în listă, cu roșu.
            </Note>
          ) : null}
        </div>

        <div className="relative mt-6">
          <label htmlFor={searchId} className="sr-only">
            Caută în vault
          </label>
          <input
            ref={searchRef}
            id={searchId}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onSearchKeyDown}
            placeholder="Caută după titlu, client, #etichetă, utilizator…"
            autoComplete="off"
            spellCheck={false}
            disabled={!snapshot}
            className={`${FIELD} h-12 pr-4 disabled:opacity-60 sm:pr-14`}
          />
          <kbd
            aria-hidden
            className="pointer-events-none absolute right-3.5 top-1/2 hidden -translate-y-1/2 rounded-[6px] border border-hair px-2 py-0.5 font-md-mono text-[11px] text-dim sm:block"
          >
            /
          </kbd>
        </div>

        {result && trimmedQuery && result.total > 0 ? (
          <p className="mt-2 px-1 font-md-mono text-[11px] tracking-[0.06em] text-dim" aria-live="polite">
            {countNoun(result.total, "rezultat", "rezultate")} din {entriesCount}
          </p>
        ) : null}

        {result ? (
          <EntryList
            groups={result.groups}
            total={result.total}
            selectedId={panelId}
            onSelect={select}
            onAddForClient={(clientId) => go({ kind: "create", clientId })}
            onRenameClient={onRenameClient}
            empty={empty}
          />
        ) : !error ? (
          <p className="mt-6 text-[14.5px] text-dim" aria-busy="true">
            Se încarcă intrările…
          </p>
        ) : null}
      </section>

      {!panelContent ? (
        <aside aria-label="Fișa intrării" className="hidden lg:sticky lg:top-[5.5rem] lg:block">
          <PanelPlaceholder hasEntries={entriesCount > 0} />
        </aside>
      ) : isDesktop ? (
        <aside
          aria-labelledby={headingId}
          onKeyDown={(event) => {
            // Escape închide și coloana de pe desktop, nu doar dialogul.
            if (event.key === "Escape") {
              event.preventDefault();
              close();
            }
          }}
          className="sticky top-[5.5rem] max-h-[calc(100dvh-6.5rem)] overflow-hidden rounded-panel-lg border border-hair bg-char"
        >
          {panelContent}
        </aside>
      ) : (
        <EntryDialog headingId={headingId} onClose={close}>
          {panelContent}
        </EntryDialog>
      )}
    </div>
  );
}

/** Coloana fișei, când nu e nimic ales: nu rămâne goală — spune cum se
    umblă prin vault de la tastatură. Scurtăturile sunt informație
    reală despre instrument, nu decor. */
function PanelPlaceholder({ hasEntries }: { hasEntries: boolean }) {
  const shortcuts: Array<[string, string]> = [
    ["/", "caută"],
    ["↑ ↓", "umblă prin listă"],
    ["Enter", "deschide fișa"],
    ["Esc", "închide fișa · golește căutarea"],
    ["Ctrl ⏎", "salvează în editor"],
  ];
  return (
    <div className="rounded-panel-lg border border-dashed border-hair-strong px-6 py-8">
      <p className="eyebrow !text-[11px]">Fișa intrării</p>
      <p className="mt-2 text-[14.5px] leading-relaxed text-dim">
        {hasEntries
          ? "Alege o intrare din listă. Secretele stau mascate până apeși „Arată”; ce copiezi dispare din clipboard după 45 s."
          : "Când vor exista intrări, fișa lor se deschide aici."}
      </p>
      <dl className="mt-6 space-y-2.5">
        {shortcuts.map(([keys, action]) => (
          <div key={keys} className="flex items-baseline gap-3">
            <dt className="w-[4.5rem] shrink-0">
              <kbd className="rounded-[6px] border border-hair px-2 py-0.5 font-md-mono text-[11px] text-bone">
                {keys}
              </kbd>
            </dt>
            <dd className="text-[13.5px] text-dim">{action}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

// ---------------------------------------------------------------------------

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Fișa pe telefon: dialog peste listă, focus captiv, Escape închide.
    Aceeași mecanică precum panoul din admin, dar cu stare, nu cu URL —
    vault-ul nu are adrese de intrări. */
function EntryDialog({
  headingId,
  onClose,
  children,
}: {
  headingId: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const panel = panelRef.current;
    // Editorul își pune singur focusul pe titlu; altfel, primul element.
    if (panel && !panel.contains(document.activeElement)) {
      panel.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    }

    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !panel) return;
      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        tabIndex={-1}
        aria-hidden
        onClick={() => onCloseRef.current()}
        className="absolute inset-0 bg-ink/70"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        className="absolute inset-y-0 right-0 flex w-full max-w-xl flex-col border-l border-hair bg-char shadow-[0_24px_80px_-20px_rgb(0_0_0/0.8)] sm:inset-y-3 sm:right-3 sm:rounded-panel-lg sm:border"
      >
        {children}
      </div>
    </div>
  );
}
