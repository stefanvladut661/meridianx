"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { CornerDownLeft, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { PANOU_MODULES } from "./nav";

const OPEN_EVENT = "panou:cauta";

/** Deschide căutarea de oriunde (butonul din meniu); Ctrl+K / ⌘K o deschid direct. */
export function openCommandPalette() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

/** Fără diacritice și fără majuscule: „postari” găsește „Postări”. */
function fold(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

interface Entry {
  id: string;
  label: string;
  hint: string;
  href: string;
}

/**
 * Căutarea de ecrane (Ctrl+K): toate modulele și subpaginile lor, cu săgeți și
 * Enter. `<dialog>` nativ: focusul rămâne înăuntru, Esc o închide.
 */
export function CommandPalette({ googleTools }: { googleTools: boolean }) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);

  const entries = useMemo<Entry[]>(
    () =>
      PANOU_MODULES.flatMap((module) => [
        { id: module.href, label: module.label, hint: "Modul", href: module.href },
        ...module
          .items(googleTools)
          .filter((item) => item.href !== module.href)
          .map((item) => ({ id: item.href, label: item.label, hint: module.label, href: item.href })),
      ]),
    [googleTools]
  );

  const results = useMemo(() => {
    const needle = fold(query.trim());
    const found = needle ? entries.filter((entry) => fold(`${entry.label} ${entry.hint}`).includes(needle)) : entries;
    return found.slice(0, 14);
  }, [entries, query]);

  useEffect(() => {
    const open = () => {
      setQuery("");
      setIndex(0);
      if (!dialog.current?.open) dialog.current?.showModal();
      requestAnimationFrame(() => input.current?.focus());
    };
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (dialog.current?.open) dialog.current.close();
        else open();
      }
    };
    window.addEventListener(OPEN_EVENT, open);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener(OPEN_EVENT, open);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  const go = (entry: Entry | undefined) => {
    if (!entry) return;
    dialog.current?.close();
    router.push(entry.href);
  };

  return (
    <dialog
      ref={dialog}
      aria-label="Caută un ecran"
      className="m-auto mt-[12vh] w-[min(36rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-hair-strong bg-char p-0 text-bone shadow-2xl backdrop:bg-black/60"
      onClick={(event) => {
        if (event.target === dialog.current) dialog.current?.close();
      }}
    >
      <div className="flex items-center gap-2.5 border-b border-hair px-4 py-3">
        <Search className="h-4 w-4 text-dim" aria-hidden="true" />
        <input
          ref={input}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setIndex(0);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setIndex((current) => Math.min(current + 1, results.length - 1));
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setIndex((current) => Math.max(current - 1, 0));
            } else if (event.key === "Enter") {
              event.preventDefault();
              go(results[index]);
            }
          }}
          placeholder="Caută un ecran: campanii, coadă, seif…"
          aria-label="Caută"
          className="h-7 flex-1 bg-transparent text-[14px] outline-none placeholder:text-dim"
        />
        <kbd className="rounded border border-hair-strong px-1.5 py-0.5 font-md-mono text-[10px] text-dim">esc</kbd>
      </div>
      <ul role="listbox" aria-label="Rezultate" className="max-h-[52vh] overflow-y-auto p-2">
        {results.length === 0 ? (
          <li className="px-3 py-8 text-center text-[13px] text-dim">Niciun ecran pentru „{query}”. Încearcă numele modulului.</li>
        ) : (
          results.map((entry, position) => (
            <li key={entry.id} role="option" aria-selected={position === index}>
              <button
                type="button"
                onMouseEnter={() => setIndex(position)}
                onClick={() => go(entry)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
                  position === index ? "bg-white/[0.08]" : "hover:bg-white/[0.04]"
                )}
              >
                <span className="min-w-0 flex-1 truncate text-[13px]">{entry.label}</span>
                <span className="shrink-0 text-[10.5px] uppercase tracking-[0.1em] text-dim">{entry.hint}</span>
                {position === index ? <CornerDownLeft className="h-3 w-3 shrink-0 text-dim" aria-hidden="true" /> : null}
              </button>
            </li>
          ))
        )}
      </ul>
      <div className="flex items-center gap-3 border-t border-hair px-4 py-2 text-[10.5px] text-dim">
        <span>↑↓ alege</span>
        <span>↵ deschide</span>
        <span className="ml-auto">Ctrl K oriunde</span>
      </div>
    </dialog>
  );
}
