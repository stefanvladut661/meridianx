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
import type { VaultEntry, VaultSnapshot } from "@/lib/vault/entries";
import type { VaultMember } from "@/lib/vault/members";
import { buildIndex, search } from "@/lib/vault/search";
import { EntryList } from "./entry-list";
import { EntryPanel } from "./entry-panel";
import { clearClipboardNow } from "./clipboard";
import { BTN_SM, FIELD, Note, countNoun } from "./ui";

/**
 * Spațiul de lucru al intrărilor (feat/vault, faza 3): căutarea, lista
 * grupată pe client și fișa intrării alese.
 *
 * Căutarea e instrumentul principal — se deschide cu `/` de oriunde,
 * ca în orice unealtă de zi cu zi — și rulează peste ce e deja
 * decriptat în memorie. Sub ea, fâșia de fapte: câte intrări, câți
 * clienți, în cât timp s-au deschis local. Nu e statistică decorativă;
 * e afirmația modelului zero-knowledge, cu cifre.
 *
 * Fișa: pe ecran lat stă alături de listă, lipită de sus; pe telefon
 * acoperă lista ca un dialog cu focus captiv, Escape o închide și
 * focusul se întoarce pe rândul de unde a plecat.
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

export function EntriesWorkspace({
  snapshot,
  members,
  loading,
  error,
  onReload,
}: {
  snapshot: VaultSnapshot | null;
  members: VaultMember[] | null;
  loading: boolean;
  error: string | null;
  onReload: () => void;
}) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const isDesktop = useIsDesktop();
  const searchId = useId();
  const headingId = useId();

  const index = useMemo(
    () => (snapshot ? buildIndex(snapshot.entries, snapshot.clients) : null),
    [snapshot]
  );
  const result = useMemo(() => (index ? search(index, query) : null), [index, query]);

  const selected = useMemo(
    () => snapshot?.entries.find((entry) => entry.id === selectedId) ?? null,
    [snapshot, selectedId]
  );
  const selectedClient = selected ? (index?.clientsById.get(selected.clientId) ?? null) : null;

  // `/` deschide căutarea de oriunde din pagină — nu și din alt câmp.
  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "/" || event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
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

  const select = useCallback((entry: VaultEntry) => {
    returnFocusRef.current = document.activeElement as HTMLElement | null;
    setSelectedId(entry.id);
  }, []);

  /** La închidere, focusul se întoarce pe rândul intrării — de acolo a
      plecat, acolo continuă navigarea. Dacă rândul nu mai e (căutarea
      l-a filtrat între timp), pe elementul activ dinainte. */
  const close = useCallback(() => {
    const row = document.querySelector<HTMLElement>('[data-entry-row][aria-current="true"]');
    const back = returnFocusRef.current;
    returnFocusRef.current = null;
    setSelectedId(null);
    if (row) row.focus();
    else if (back && back !== document.body && document.contains(back)) back.focus();
  }, []);

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
          body: "Adăugarea intrărilor vine în faza următoare. Până atunci, aici se vede doar cine are cheia — sub „Membri”.",
        }
      : {
          title: `Nimic pentru „${trimmedQuery}”`,
          body: "Caută după titlu, client, #etichetă, utilizator sau notițe. Secretele nu se caută niciodată.",
        };

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
          <button type="button" onClick={onReload} disabled={loading} className={BTN_SM}>
            {loading ? "Se reîncarcă…" : "Reîncarcă"}
          </button>
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
            selectedId={selectedId}
            onSelect={select}
            empty={empty}
          />
        ) : !error ? (
          <p className="mt-6 text-[14.5px] text-dim" aria-busy="true">
            Se încarcă intrările…
          </p>
        ) : null}
      </section>

      {!selected ? (
        <aside
          aria-label="Fișa intrării"
          className="hidden lg:sticky lg:top-[5.5rem] lg:block"
        >
          <PanelPlaceholder hasEntries={entriesCount > 0} />
        </aside>
      ) : isDesktop ? (
        <aside
          aria-labelledby={headingId}
          className="sticky top-[5.5rem] max-h-[calc(100dvh-6.5rem)] overflow-hidden rounded-panel-lg border border-hair bg-char"
        >
          <EntryPanel
            entry={selected}
            client={selectedClient}
            members={members}
            headingId={headingId}
            onClose={close}
          />
        </aside>
      ) : (
        <EntryDialog headingId={headingId} onClose={close}>
          <EntryPanel
            entry={selected}
            client={selectedClient}
            members={members}
            headingId={headingId}
            onClose={close}
          />
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

  useEffect(() => {
    const panel = panelRef.current;
    panel?.querySelector<HTMLElement>(FOCUSABLE)?.focus();

    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
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
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        tabIndex={-1}
        aria-hidden
        onClick={onClose}
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
