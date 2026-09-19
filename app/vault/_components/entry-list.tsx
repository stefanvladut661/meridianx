"use client";

import { useRef, type KeyboardEvent } from "react";
import { Mark } from "@/components/site/mark";
import { KIND_LABEL, entrySummary, type VaultEntry } from "@/lib/vault/entries";
import type { SearchGroup } from "@/lib/vault/search";
import { KIND_TAG, countNoun, formatDate } from "./ui";

/**
 * Lista intrărilor, grupată pe client (feat/vault, faza 3).
 *
 * Grupul e clientul: așa gândește agenția („parolele de la X"), și așa
 * arată și lista — capul de grup poartă numele clientului și câte
 * intrări are, rândurile de sub el doar titlul și un rezumat nesecret.
 * Niciun secret nu ajunge în listă, nici mascat: lista se citește de la
 * distanță, fișa de aproape.
 *
 * Fiecare rând e un buton adevărat. Săgețile sus/jos mută focusul
 * între rânduri (peste capetele de grup), Home/End sar la capete —
 * ca într-o listă nativă, fără să fie un `listbox` cu focus virtual.
 */

export interface EmptyState {
  title: string;
  body: string;
}

export function EntryList({
  groups,
  total,
  selectedId,
  onSelect,
  empty,
}: {
  groups: SearchGroup[];
  total: number;
  selectedId: string | null;
  onSelect: (entry: VaultEntry) => void;
  empty: EmptyState;
}) {
  const listRef = useRef<HTMLUListElement>(null);

  function onKeyDown(event: KeyboardEvent<HTMLUListElement>) {
    const keys = ["ArrowDown", "ArrowUp", "Home", "End"];
    if (!keys.includes(event.key) || !listRef.current) return;
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

  if (total === 0) {
    return (
      <div className="mt-4 flex flex-col items-center rounded-panel-lg border border-dashed border-hair-strong px-6 py-16 text-center">
        <Mark size={28} className="text-dim" />
        <p className="display mt-6 text-[1.5rem] text-bone">{empty.title}</p>
        <p className="mt-3 max-w-md text-pretty text-[14.5px] leading-relaxed text-dim">{empty.body}</p>
      </div>
    );
  }

  return (
    <ul ref={listRef} onKeyDown={onKeyDown} className="mt-4 space-y-5" aria-label="Intrări, grupate pe client">
      {groups.map((group) => (
        <li key={group.clientId}>
          <div className="flex items-baseline justify-between gap-3 px-1">
            <h3 className="min-w-0 truncate text-[13px] font-semibold tracking-[0.01em] text-bone/85">
              {group.client?.name ?? `Client necunoscut · ${group.clientId.slice(0, 8)}`}
            </h3>
            <span className="shrink-0 font-md-mono text-[11px] tracking-[0.06em] text-dim">
              {countNoun(group.entries.length, "intrare", "intrări")}
            </span>
          </div>
          <ul className="mt-2 overflow-hidden rounded-panel-lg border border-hair bg-char">
            {group.entries.map((entry) => (
              <li key={entry.id} className="border-b border-hair last:border-b-0">
                <EntryRow entry={entry} selected={entry.id === selectedId} onSelect={onSelect} />
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}

function EntryRow({
  entry,
  selected,
  onSelect,
}: {
  entry: VaultEntry;
  selected: boolean;
  onSelect: (entry: VaultEntry) => void;
}) {
  const unreadable = entry.status === "unreadable";
  const summary = entry.status === "ok" ? entrySummary(entry.payload) : null;
  const tags = entry.status === "ok" ? entry.payload.tags : [];

  return (
    <button
      type="button"
      data-entry-row
      aria-current={selected ? "true" : undefined}
      onClick={() => onSelect(entry)}
      className={`group relative block w-full px-4 py-3.5 text-left transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-bone/70 sm:px-5 ${
        selected ? "bg-white/[0.07]" : "hover:bg-white/[0.045]"
      }`}
    >
      {/* Muchia rândului selectat — ca în tabelul de lead-uri, dar în
          bone: aici nu există divizii. */}
      <span
        aria-hidden
        className={`absolute inset-y-2.5 left-0 w-1 rounded-r-full bg-bone transition-opacity duration-150 ${
          selected ? "opacity-100" : "opacity-0"
        }`}
      />
      <span className="flex items-start justify-between gap-4">
        <span className="min-w-0 flex-1">
          <span
            className={`block truncate text-[15.5px] font-semibold ${
              unreadable ? "text-[#ff8a8a]" : "text-bone"
            }`}
          >
            {entry.status === "ok" ? entry.payload.title : "Intrare ilizibilă"}
          </span>
          {summary ? (
            <span className="mt-0.5 block truncate font-md-mono text-[12.5px] text-dim">{summary}</span>
          ) : unreadable ? (
            <span className="mt-0.5 block truncate text-[13px] text-dim">nu s-a putut decripta</span>
          ) : null}
          {tags.length > 0 ? (
            <span className="mt-1 block truncate font-md-mono text-[11px] tracking-[0.04em] text-dim/80">
              {tags.map((tag) => `#${tag}`).join("  ")}
            </span>
          ) : null}
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1 pt-0.5">
          {/* Tipul apare doar când NU e o autentificare obișnuită: „login”
              e regula, restul sunt excepțiile care merită văzute. */}
          {entry.status !== "ok" ? (
            <span className={KIND_TAG}>ilizibil</span>
          ) : entry.payload.kind !== "login" ? (
            <span className={KIND_TAG}>{KIND_LABEL[entry.payload.kind]}</span>
          ) : null}
          <span className="font-md-mono text-[11px] tracking-[0.04em] text-dim/80 tabular-nums">
            {formatDate(entry.updatedAt)}
          </span>
        </span>
      </span>
    </button>
  );
}
