"use client";

import { useCallback, useEffect, useState } from "react";
import { loadDeleted, restoreEntry, type DeletedEntry } from "@/lib/vault/entries";
import { VaultDataError, type VaultMember } from "@/lib/vault/members";
import { VaultCryptoError } from "@/lib/vault/crypto";
import { useVault } from "./vault-provider";
import { BTN_SM, KIND_TAG, Note, countNoun, formatDate } from "./ui";

/**
 * Coșul (feat/vault, faza 6): intrările șterse, în aceeași ramă ca fișa.
 *
 * Ștergerea e soft (faza 4), deci nimic nu e pierdut: de aici se
 * restaurează, cu tot cu clientul plecat odată cu ultima lui intrare.
 * Ștergerea DEFINITIVĂ nu există în aplicație — RLS-ul n-are politică
 * de delete, intenționat: o parolă ștearsă din greșeală se recuperează,
 * una ștearsă rău-intenționat nu dispare fără urmă. Curățenia finală
 * se face în SQL, de un om, când chiar e nevoie.
 */

function describe(error: unknown): string {
  if (error instanceof VaultDataError || error instanceof VaultCryptoError) return error.message;
  return "Coșul nu s-a putut încărca. Încearcă din nou.";
}

export function TrashPanel({
  members,
  headingId,
  onClose,
  onRestored,
}: {
  members: VaultMember[] | null;
  headingId: string;
  onClose: () => void;
  onRestored: () => Promise<void>;
}) {
  const { supabase, keys } = useVault();
  const [items, setItems] = useState<DeletedEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!supabase || !keys) return;
    try {
      setItems(await loadDeleted(supabase, keys.dek));
      setError(null);
    } catch (cause) {
      setError(describe(cause));
    }
  }, [supabase, keys]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const emailOf = (id: string | null) =>
    id ? (members?.find((row) => row.id === id)?.email ?? "membru eliminat") : "—";

  async function restore(item: DeletedEntry) {
    if (!supabase) return;
    setBusyId(item.entry.id);
    setError(null);
    try {
      await restoreEntry(supabase, { id: item.entry.id, clientId: item.entry.clientId });
      await Promise.all([reload(), onRestored()]);
    } catch (cause) {
      setError(describe(cause));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-4 border-b border-hair px-5 py-5 sm:px-6">
        <div className="min-w-0">
          <p className={KIND_TAG}>Coș{items ? ` · ${countNoun(items.length, "intrare", "intrări")}` : ""}</p>
          <h2 id={headingId} className="display mt-2 text-[1.5rem] text-bone sm:text-[1.625rem]">
            Șterse, nu pierdute
          </h2>
        </div>
        <button type="button" onClick={onClose} className={`${BTN_SM} shrink-0`}>
          Închide
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
        <div aria-live="polite">{error ? <Note tone="error">{error}</Note> : null}</div>

        {items === null ? (
          <p className="text-[14.5px] text-dim" aria-busy="true">
            Se decriptează coșul…
          </p>
        ) : items.length === 0 ? (
          <p className="text-[14.5px] leading-relaxed text-dim">
            Coșul e gol. Ce ștergi din listă ajunge aici și se poate aduce înapoi oricând.
          </p>
        ) : (
          <ul className="divide-y divide-hair">
            {items.map((item) => {
              const working = busyId === item.entry.id;
              return (
                <li key={item.entry.id} className="py-3.5 first:pt-0 last:pb-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className={`truncate text-[15px] font-semibold ${item.entry.status === "ok" ? "text-bone" : "text-[#ff8a8a]"}`}>
                        {item.entry.status === "ok" ? item.entry.payload.title : "Intrare ilizibilă"}
                      </p>
                      <p className="mt-0.5 truncate font-md-mono text-[11px] tracking-[0.04em] text-dim">
                        {item.clientName}
                        {item.clientDeleted ? " (client șters)" : ""} · ștearsă {formatDate(item.deletedAt)} de{" "}
                        {emailOf(item.entry.updatedBy)}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={working}
                      onClick={() => void restore(item)}
                      className={`${BTN_SM} shrink-0`}
                    >
                      {working ? "Se restaurează…" : "Restaurează"}
                    </button>
                  </div>
                  {item.clientDeleted ? (
                    <p className="mt-1.5 text-[12.5px] text-dim">
                      Restaurarea aduce înapoi și clientul „{item.clientName}”.
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="border-t border-hair px-5 py-3.5 font-md-mono text-[11px] leading-relaxed tracking-[0.06em] text-dim sm:px-6">
        ștergerea definitivă nu se face din aplicație — doar din SQL, de un om
      </div>
    </div>
  );
}
