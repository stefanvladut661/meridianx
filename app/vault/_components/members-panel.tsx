"use client";

import { useState } from "react";
import {
  approveMember,
  removeMember,
  rotateRecoveryCode,
  VaultDataError,
  type VaultMember,
  type VaultMeta,
} from "@/lib/vault/members";
import { useVault } from "./vault-provider";
import { CHIP, CHIP_TONE, Note, formatDate } from "./ui";
import { RecoveryCode } from "./recovery-code";

/**
 * Membrii vault-ului și codul de recuperare (feat/vault, faza 2).
 *
 * Aprobarea e singurul loc din aplicație în care DEK-ul se re-sigilează:
 * browserul membrului activ îl deschide din memorie și îl sigilează
 * către cheia publică a solicitantului; la server ajunge doar blob-ul.
 *
 * Eliminarea unui membru ACTIV nu rotește DEK-ul (PLAN.md): ce a apucat
 * să vadă a văzut. Confirmarea e inline, nu `window.confirm` — un dialog
 * nativ blochează pagina și nu se poate stiliza, iar aici omul trebuie
 * să citească exact ce urmează.
 */

type Confirm = { kind: "remove"; member: VaultMember } | { kind: "rotate" } | null;

function describe(error: unknown): string {
  if (error instanceof VaultDataError) return error.message;
  return "Operația a eșuat dintr-un motiv necunoscut. Reîncarcă lista și încearcă din nou.";
}

export function MembersPanel({
  members,
  meta,
  loadError,
  reload,
}: {
  /** Din `useVaultData`, în shell — aceeași listă ca eticheta din antet. */
  members: VaultMember[] | null;
  meta: VaultMeta | null;
  loadError: string | null;
  reload: () => Promise<void>;
}) {
  const vault = useVault();
  const { supabase, keys, member: self } = vault;

  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [freshCode, setFreshCode] = useState<string | null>(null);
  const [removedActive, setRemovedActive] = useState<string | null>(null);

  const error = actionError ?? loadError;
  const setError = setActionError;

  async function approve(target: VaultMember) {
    if (!supabase || !keys) return;
    setBusyId(target.id);
    setError(null);
    try {
      await approveMember(supabase, keys, target);
      await reload();
    } catch (cause) {
      setError(describe(cause));
    } finally {
      setBusyId(null);
    }
  }

  async function remove(target: VaultMember) {
    if (!supabase) return;
    setBusyId(target.id);
    setError(null);
    setConfirm(null);
    try {
      await removeMember(supabase, target.id);
      if (target.wrappedDek) setRemovedActive(target.email);
      await reload();
    } catch (cause) {
      setError(describe(cause));
    } finally {
      setBusyId(null);
    }
  }

  async function rotate() {
    if (!supabase || !keys) return;
    setBusyId("rotate");
    setError(null);
    setConfirm(null);
    try {
      const code = await rotateRecoveryCode(supabase, keys);
      setFreshCode(code);
      await reload();
    } catch (cause) {
      setError(describe(cause));
    } finally {
      setBusyId(null);
    }
  }

  const emailOf = (id: string | null) =>
    id ? members?.find((row) => row.id === id)?.email ?? "membru eliminat" : null;

  const pendingCount = members?.filter((row) => !row.wrappedDek).length ?? 0;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
      {/* Membri ------------------------------------------------------ */}
      <section aria-labelledby="membri-titlu" className="glass rounded-panel-lg p-5 sm:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <p className="eyebrow !text-[11.5px]">
              Membri
              {members ? ` · ${members.length}` : ""}
              {pendingCount ? ` · ${pendingCount} în așteptare` : ""}
            </p>
            <h2 id="membri-titlu" className="display mt-2 text-[1.5rem] text-bone">
              Cine deschide vault-ul
            </h2>
          </div>
          <button
            type="button"
            onClick={() => void reload()}
            className="btn btn-ghost !min-h-9 !px-4 !py-2 !text-[12.5px]"
          >
            Reîncarcă
          </button>
        </div>

        <div aria-live="polite">
          {error ? <Note tone="error">{error}</Note> : null}
          {removedActive ? (
            <Note tone="info">
              {removedActive} a avut cheia de date în memorie. Rotește cheia din secțiunea „Cheia de date”, ca ce se
              scrie de acum să nu se mai deschidă cu ea.
            </Note>
          ) : null}
        </div>

        {members === null ? (
          <p className="mt-6 text-[14.5px] text-dim">Se încarcă membrii…</p>
        ) : (
          <ul className="mt-5 divide-y divide-hair">
            {members.map((row) => {
              const isSelf = row.id === self?.id;
              const active = Boolean(row.wrappedDek);
              const working = busyId === row.id;
              const confirmingRemove = confirm?.kind === "remove" && confirm.member.id === row.id;
              return (
                <li key={row.id} className="py-4 first:pt-2 last:pb-0">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <span className="min-w-0 flex-1 basis-[14rem] truncate text-[15px] text-bone">
                      {row.email}
                      {isSelf ? <span className="ml-2 text-[13px] text-dim">(tu)</span> : null}
                    </span>
                    <span className={`${CHIP} ${active ? CHIP_TONE.active : CHIP_TONE.pending}`}>
                      {active ? "Activ" : "În așteptare"}
                    </span>
                    {!active ? (
                      <button
                        type="button"
                        disabled={working}
                        onClick={() => void approve(row)}
                        className="btn btn-light !min-h-9 !px-4 !py-2 !text-[12.5px] disabled:pointer-events-none disabled:opacity-60"
                      >
                        {working ? "Se sigilează…" : "Aprobă"}
                      </button>
                    ) : null}
                    {!isSelf && !confirmingRemove ? (
                      <button
                        type="button"
                        disabled={working}
                        onClick={() => setConfirm({ kind: "remove", member: row })}
                        className="btn btn-ghost !min-h-9 !px-4 !py-2 !text-[12.5px] disabled:pointer-events-none disabled:opacity-60"
                      >
                        {active ? "Elimină" : "Respinge"}
                      </button>
                    ) : null}
                  </div>

                  <p className="mt-1.5 font-md-mono text-[11px] tracking-[0.06em] text-dim">
                    {active ? "activ" : "cerere"} din {formatDate(row.createdAt)}
                    {active && row.approvedBy && row.approvedBy !== row.id
                      ? ` · aprobat de ${emailOf(row.approvedBy)}`
                      : active && row.approvedBy === row.id
                        ? " · fondator"
                        : ""}
                  </p>

                  {confirmingRemove ? (
                    <div className="mt-3 rounded-panel-sm border-l-[3px] border-[#ef4444] bg-[#ef4444]/10 px-3.5 py-3 text-[14px] leading-relaxed text-bone">
                      {active
                        ? "Membrul pierde accesul de la următoarea deblocare. Ce a văzut până acum a văzut — DEK-ul nu se rotește."
                        : "Cererea dispare. Contul Supabase rămâne; poate cere din nou."}
                      <div className="mt-3 flex gap-2">
                        <button
                          type="button"
                          onClick={() => void remove(row)}
                          className="btn !min-h-9 !bg-[#ef4444] !px-4 !py-2 !text-[12.5px] !text-white"
                        >
                          {active ? "Elimină membrul" : "Respinge cererea"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirm(null)}
                          className="btn btn-ghost !min-h-9 !px-4 !py-2 !text-[12.5px]"
                        >
                          Anulează
                        </button>
                      </div>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}

        <p className="mt-6 border-t border-hair pt-4 text-[13px] leading-relaxed text-dim">
          Un membru nou se adaugă din Supabase → Authentication → Users, cu o parolă temporară.
          Își activează contul de pe ecranul de deblocare, apoi apare aici în așteptare.
        </p>
      </section>

      {/* Cod de recuperare --------------------------------------------- */}
      <section aria-labelledby="recuperare-titlu" className="glass rounded-panel-lg p-5 sm:p-6">
        <p className="eyebrow !text-[11.5px]">Cod de recuperare</p>
        <h2 id="recuperare-titlu" className="display mt-2 text-[1.5rem] text-bone">
          Calea înapoi
        </h2>

        {meta ? (
          <p className="mt-3 font-md-mono text-[11px] leading-relaxed tracking-[0.06em] text-dim">
            creat {formatDate(meta.createdAt)}
            {meta.createdBy ? ` de ${emailOf(meta.createdBy)}` : ""}
            <br />
            {meta.recoveryRotations === 0
              ? "niciodată regenerat"
              : `regenerat de ${meta.recoveryRotations} ${meta.recoveryRotations === 1 ? "dată" : "ori"} · ultima ${formatDate(meta.updatedAt)}`}
          </p>
        ) : null}

        <p className="mt-4 text-[14.5px] leading-relaxed text-dim">
          Deschide DEK-ul fără nicio parolă master. Dacă hârtia s-a pierdut sau a văzut-o cine nu
          trebuia, regenerează-l: cel vechi moare pe loc.
        </p>

        {freshCode ? (
          <div className="mt-2">
            <RecoveryCode
              code={freshCode}
              onConfirm={() => setFreshCode(null)}
              confirmLabel="Am notat codul nou"
            />
          </div>
        ) : confirm?.kind === "rotate" ? (
          <div className="mt-5 rounded-panel-sm border-l-[3px] border-bone/70 bg-bone/[0.06] px-3.5 py-3 text-[14px] leading-relaxed text-bone">
            Codul actual nu va mai deschide nimic. Cel nou se afișează o singură dată, imediat.
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => void rotate()}
                className="btn btn-light !min-h-9 !px-4 !py-2 !text-[12.5px]"
              >
                Regenerează
              </button>
              <button
                type="button"
                onClick={() => setConfirm(null)}
                className="btn btn-ghost !min-h-9 !px-4 !py-2 !text-[12.5px]"
              >
                Anulează
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            disabled={busyId === "rotate" || !meta}
            onClick={() => setConfirm({ kind: "rotate" })}
            className="btn btn-ghost mt-5 !min-h-10 !px-5 !py-2.5 !text-[13.5px] disabled:pointer-events-none disabled:opacity-60"
          >
            {busyId === "rotate" ? "Se regenerează…" : "Regenerează codul"}
          </button>
        )}
      </section>
    </div>
  );
}
