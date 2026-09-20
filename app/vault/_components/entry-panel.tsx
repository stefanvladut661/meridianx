"use client";

import { useState } from "react";
import { KIND_LABEL, deleteEntry, type VaultClient, type VaultEntry } from "@/lib/vault/entries";
import { VaultDataError, type VaultMember } from "@/lib/vault/members";
import { useVault } from "./vault-provider";
import { EntryFieldRow } from "./entry-field";
import { BTN_SM, KIND_TAG, Note, formatDate } from "./ui";

/**
 * Fișa unei intrări (feat/vault, fazele 3–5).
 *
 * Citire, cu două acțiuni: „Editează" (deschide editorul în aceeași
 * ramă) și „Șterge" (soft, cu confirmare inline care spune exact ce
 * urmează — inclusiv că dispare și clientul, dacă era ultima lui
 * intrare). Câmpurile în ordinea în care au fost salvate — ordinea e a
 * omului, nu a noastră. Sub ele, metadatele reale: versiunea (crește
 * doar prin trigger), cine și când a modificat ultima dată.
 *
 * Aceeași componentă pe desktop (coloană, alături de listă) și pe
 * telefon (dialog peste listă) — învelișul îl alege spațiul de lucru.
 */
export function EntryPanel({
  entry,
  client,
  members,
  siblings,
  headingId,
  onClose,
  onEdit,
  onDuplicate,
  onDeleted,
}: {
  entry: VaultEntry;
  client: VaultClient | null;
  members: VaultMember[] | null;
  /** Câte intrări vii are clientul (inclusiv aceasta). */
  siblings: number;
  headingId: string;
  onClose: () => void;
  onEdit: () => void;
  /** Faza 5: editorul pornește cu o copie a intrării, în același client. */
  onDuplicate?: () => void;
  onDeleted: () => Promise<void>;
}) {
  const { supabase } = useVault();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emailOf = (id: string | null) =>
    id ? members?.find((row) => row.id === id)?.email ?? "membru eliminat" : "—";

  const clientName = client?.name ?? "Client necunoscut";
  const lastOfClient = siblings <= 1;

  async function remove() {
    if (!supabase) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteEntry(
        supabase,
        { id: entry.id, version: entry.version, clientId: entry.clientId },
        lastOfClient
      );
      await onDeleted();
    } catch (cause) {
      setError(cause instanceof VaultDataError ? cause.message : "Ștergerea a eșuat. Încearcă din nou.");
      setDeleting(false);
      setConfirming(false);
    }
  }

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
        <div className="flex shrink-0 items-center gap-1.5">
          {entry.status === "ok" ? (
            <button type="button" onClick={onEdit} className={BTN_SM}>
              Editează
            </button>
          ) : null}
          <button type="button" onClick={onClose} className={BTN_SM}>
            Închide
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
        <div aria-live="polite">{error ? <Note tone="error">{error}</Note> : null}</div>

        {entry.status === "unreadable" ? (
          <>
            <Note tone="error">
              {entry.reason} Rândul există pe server, dar nu se poate deschide cu cheia vault-ului —
              a fost alterat sau scris cu altă cheie. Spune-i echipei înainte să-l ștergi.
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

        {/* Acțiunile secundare — jos, departe de „Copiază": duplicarea și
            ștergerea (cu confirmare inline). */}
        <div className="mt-8 border-t border-hair pt-4">
          {confirming ? (
            <div className="rounded-panel-sm border-l-[3px] border-[#ef4444] bg-[#ef4444]/10 px-3.5 py-3 text-[14px] leading-relaxed text-bone">
              Intrarea dispare din listă. Istoricul ei rămâne pe server, criptat.
              {lastOfClient ? (
                <> E ultima intrare a clientului <strong className="font-semibold">{clientName}</strong> — dispare și el din listă.</>
              ) : null}
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  disabled={deleting}
                  onClick={() => void remove()}
                  className="btn !min-h-8 !bg-[#ef4444] !px-3.5 !py-1.5 !text-[12.5px] !text-white disabled:pointer-events-none disabled:opacity-60"
                >
                  {deleting ? "Se șterge…" : "Șterge intrarea"}
                </button>
                <button type="button" disabled={deleting} onClick={() => setConfirming(false)} className={BTN_SM}>
                  Anulează
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              {entry.status === "ok" && onDuplicate ? (
                <button
                  type="button"
                  onClick={onDuplicate}
                  className="text-[13px] text-dim underline-offset-4 transition-colors hover:text-bone hover:underline"
                >
                  Duplică intrarea
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setConfirming(true)}
                className="text-[13px] text-dim underline-offset-4 transition-colors hover:text-[#ff8a8a] hover:underline"
              >
                Șterge intrarea
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-hair px-5 py-3.5 font-md-mono text-[11px] leading-relaxed tracking-[0.06em] text-dim sm:px-6">
        v{entry.version} · modificat {formatDate(entry.updatedAt)} de {emailOf(entry.updatedBy)}
        {entry.createdAt !== entry.updatedAt ? <> · creat {formatDate(entry.createdAt)}</> : null}
      </div>
    </div>
  );
}
