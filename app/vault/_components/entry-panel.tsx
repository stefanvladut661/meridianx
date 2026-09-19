"use client";

import { KIND_LABEL, type VaultClient, type VaultEntry } from "@/lib/vault/entries";
import type { VaultMember } from "@/lib/vault/members";
import { EntryFieldRow } from "./entry-field";
import { BTN_SM, KIND_TAG, Note, formatDate } from "./ui";

/**
 * Fișa unei intrări (feat/vault, faza 3).
 *
 * Doar citire în faza asta: editarea și ștergerea vin în faza 4, sub
 * același antet. Câmpurile în ordinea în care au fost salvate — ordinea
 * e a omului, nu a noastră. Sub ele, metadatele reale: versiunea (crește
 * doar prin trigger), cine și când a modificat ultima dată.
 *
 * Aceeași componentă pe desktop (coloană, alături de listă) și pe
 * telefon (dialog peste listă) — învelișul îl alege spațiul de lucru.
 */
export function EntryPanel({
  entry,
  client,
  members,
  headingId,
  onClose,
}: {
  entry: VaultEntry;
  client: VaultClient | null;
  members: VaultMember[] | null;
  headingId: string;
  onClose: () => void;
}) {
  const emailOf = (id: string | null) =>
    id ? members?.find((row) => row.id === id)?.email ?? "membru eliminat" : "—";

  const clientName = client?.name ?? "Client necunoscut";

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-4 border-b border-hair px-5 py-5 sm:px-6">
        <div className="min-w-0">
          <p className={KIND_TAG}>
            {clientName}
            {entry.status === "ok" ? <> · {KIND_LABEL[entry.payload.kind]}</> : null}
          </p>
          <h2
            id={headingId}
            className="display mt-2 break-words text-[1.5rem] text-bone sm:text-[1.625rem]"
          >
            {entry.status === "ok" ? entry.payload.title : "Intrare ilizibilă"}
          </h2>
        </div>
        <button type="button" onClick={onClose} className={`${BTN_SM} shrink-0`}>
          Închide
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
        {entry.status === "unreadable" ? (
          <>
            <Note tone="error">
              {entry.reason} Rândul există pe server, dar nu se poate deschide cu cheia vault-ului —
              a fost alterat sau scris cu altă cheie. Spune-i echipei; nu-l edita.
            </Note>
            <p className="mt-4 font-md-mono text-[11px] tracking-[0.06em] text-dim">id {entry.id}</p>
          </>
        ) : (
          <>
            {entry.payload.fields.length === 0 ? (
              <p className="text-[14.5px] text-dim">Intrarea n-are câmpuri — doar notițele de mai jos.</p>
            ) : (
              <div>
                {entry.payload.fields.map((field, index) => (
                  <EntryFieldRow key={`${entry.id}:${entry.version}:${index}`} field={field} />
                ))}
              </div>
            )}

            {entry.payload.notes.trim() ? (
              <div className="mt-5 border-t border-hair pt-4">
                <p className="eyebrow !text-[11px]">Notițe</p>
                <p className="mt-1.5 whitespace-pre-wrap break-words text-[14.5px] leading-relaxed text-bone">
                  {entry.payload.notes}
                </p>
              </div>
            ) : null}

            {entry.payload.tags.length > 0 ? (
              <ul className="mt-5 flex flex-wrap gap-1.5" aria-label="Etichete">
                {entry.payload.tags.map((tag) => (
                  <li
                    key={tag}
                    className="rounded-full border border-hair px-2.5 py-1 font-md-mono text-[11px] tracking-[0.04em] text-dim"
                  >
                    #{tag}
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        )}
      </div>

      <div className="border-t border-hair px-5 py-3.5 font-md-mono text-[11px] leading-relaxed tracking-[0.06em] text-dim sm:px-6">
        v{entry.version} · modificat {formatDate(entry.updatedAt)} de {emailOf(entry.updatedBy)}
        {entry.createdAt !== entry.updatedAt ? <> · creat {formatDate(entry.createdAt)}</> : null}
      </div>
    </div>
  );
}
