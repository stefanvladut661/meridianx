"use client";

import { useCallback, useEffect, useState } from "react";
import { countStaleRows, reencryptAll } from "@/lib/vault/entries";
import { grantMissing, keyringStatus, rotateDek, type KeyringStatus } from "@/lib/vault/keyring";
import { VaultDataError, type VaultMember } from "@/lib/vault/members";
import { VaultCryptoError } from "@/lib/vault/crypto";
import { useVault } from "./vault-provider";
import { RecoveryCode } from "./recovery-code";
import { BTN_SM, BTN_SM_LIGHT, Note, countNoun, formatDate } from "./ui";

/**
 * Cheia de date (feat/vault, faza 10), în vederea Membri.
 *
 * Trei lucruri, toate cifre reale: cu ce cheie se scrie acum (originala
 * sau a N-a, de când, de cine), câte rânduri au rămas pe chei vechi
 * (rotația e reluabilă — se vede exact cât mai e) și cui îi lipsește o
 * cheie (după o rotație întreruptă sau o aprobare veche).
 *
 * Rotația: cheie nouă + COD DE RECUPERARE NOU, afișat o singură dată,
 * apoi re-criptarea tuturor rândurilor, cu contor. Se face după ce
 * elimini un membru activ: ce a văzut a văzut, dar ce urmează nu mai
 * poate deschide.
 */

type Stage =
  | { kind: "idle" }
  | { kind: "confirm" }
  | { kind: "rotating" }
  | { kind: "code"; code: string }
  | { kind: "reencrypting"; done: number; total: number }
  | { kind: "done"; done: number; skipped: number };

function describe(error: unknown): string {
  if (error instanceof VaultDataError || error instanceof VaultCryptoError) return error.message;
  return "Operația a eșuat dintr-un motiv necunoscut.";
}

export function KeyPanel({
  members,
  onChanged,
}: {
  members: VaultMember[] | null;
  /** După rotație / re-criptare / acordare: lista și membrii se reîncarcă. */
  onChanged: () => Promise<void>;
}) {
  const { supabase, keys } = useVault();
  const [status, setStatus] = useState<KeyringStatus | null>(null);
  const [stale, setStale] = useState<number | null>(null);
  const [stage, setStage] = useState<Stage>({ kind: "idle" });
  const [error, setError] = useState<string | null>(null);
  const [granting, setGranting] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!supabase || !keys || !members) return;
    try {
      const [nextStatus, nextStale] = await Promise.all([
        keyringStatus(supabase, keys, members),
        countStaleRows(supabase, keys.currentDekId),
      ]);
      setStatus(nextStatus);
      setStale(nextStale);
      setError(null);
    } catch (cause) {
      setError(describe(cause));
    }
  }, [supabase, keys, members]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const emailOf = (id: string | null) =>
    id ? (members?.find((row) => row.id === id)?.email ?? "membru eliminat") : "—";

  async function reencrypt() {
    if (!supabase || !keys) return;
    setStage({ kind: "reencrypting", done: 0, total: stale ?? 0 });
    try {
      const result = await reencryptAll(supabase, keys, (done, total) =>
        setStage({ kind: "reencrypting", done, total })
      );
      setStage({ kind: "done", ...result });
      await Promise.all([refresh(), onChanged()]);
    } catch (cause) {
      setError(describe(cause));
      setStage({ kind: "idle" });
    }
  }

  async function rotate() {
    if (!supabase || !keys || !members) return;
    setError(null);
    setStage({ kind: "rotating" });
    try {
      const result = await rotateDek(supabase, keys, members);
      setStage({ kind: "code", code: result.recoveryCode });
    } catch (cause) {
      setError(describe(cause));
      setStage({ kind: "idle" });
    }
  }

  async function grant(member: VaultMember) {
    if (!supabase || !keys) return;
    setGranting(member.id);
    setError(null);
    try {
      await grantMissing(supabase, keys, member);
      await refresh();
    } catch (cause) {
      setError(describe(cause));
    } finally {
      setGranting(null);
    }
  }

  const current = status?.current ?? null;
  const rotations = status?.deks.length ?? 0;

  return (
    <section aria-labelledby="cheie-titlu" className="glass mt-6 rounded-panel-lg p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <p className="eyebrow !text-[11.5px]">Cheia de date</p>
          <h2 id="cheie-titlu" className="display mt-2 text-[1.5rem] text-bone">
            Cu ce se criptează acum
          </h2>
        </div>
        {stage.kind === "idle" ? (
          <button
            type="button"
            onClick={() => setStage({ kind: "confirm" })}
            disabled={!status || !members}
            className="btn btn-ghost !min-h-9 !px-4 !py-2 !text-[12.5px] disabled:pointer-events-none disabled:opacity-60"
          >
            Rotește cheia
          </button>
        ) : null}
      </div>

      {status ? (
        <p className="mt-3 font-md-mono text-[11px] leading-relaxed tracking-[0.06em] text-dim">
          {current
            ? `cheia ${rotations + 1} · rotită ${formatDate(current.createdAt)} de ${emailOf(current.createdBy)}`
            : "cheia originală · nicio rotație"}
          {rotations > 0 ? ` · ${countNoun(rotations + 1, "cheie", "chei")} în inel` : ""}
          <br />
          {stale === null
            ? ""
            : stale === 0
              ? "toate rândurile sunt pe cheia curentă"
              : `${countNoun(stale, "rând", "rânduri")} încă pe chei vechi`}
        </p>
      ) : null}

      <p className="mt-4 max-w-[40rem] text-[14.5px] leading-relaxed text-dim">
        Un membru eliminat a avut cheia în memorie. Rotația pune o cheie nouă, sigilată doar pentru
        cei rămași, și un cod de recuperare nou; ce se scrie de acum nu se mai deschide cu ce știa
        el. Cheile vechi rămân pentru istoric.
      </p>

      <div aria-live="polite">{error ? <Note tone="error">{error}</Note> : null}</div>

      {status?.ownMissing.length ? (
        <Note tone="error">
          Ție îți {status.ownMissing.length === 1 ? "lipsește o cheie rotită" : `lipsesc ${status.ownMissing.length} chei rotite`}
          . Rândurile scrise cu ele apar ca ilizibile până ți le acordă un membru activ.
        </Note>
      ) : null}

      {status?.missing.length ? (
        <ul className="mt-4 divide-y divide-hair rounded-panel-sm border border-hair">
          {status.missing.map(({ member, dekIds }) => (
            <li key={member.id} className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5">
              <span className="min-w-0 truncate text-[14px] text-bone">
                {member.email}
                <span className="ml-2 font-md-mono text-[11px] text-dim">
                  {countNoun(dekIds.length, "cheie lipsă", "chei lipsă")}
                </span>
              </span>
              <button
                type="button"
                disabled={granting === member.id}
                onClick={() => void grant(member)}
                className={BTN_SM_LIGHT}
              >
                {granting === member.id ? "Se acordă…" : "Acordă cheile"}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {stage.kind === "idle" && stale !== null && stale > 0 ? (
        <button type="button" onClick={() => void reencrypt()} className={`${BTN_SM} mt-4`}>
          Reia re-criptarea ({stale})
        </button>
      ) : null}

      {stage.kind === "confirm" ? (
        <div className="mt-5 rounded-panel-sm border-l-[3px] border-[#f0b429] bg-[#f0b429]/10 px-3.5 py-3 text-[14px] leading-relaxed text-bone">
          Se generează o cheie nouă și un <strong className="font-semibold">cod de recuperare nou</strong> —
          cel vechi moare pe loc, notează-l pe cel nou. Apoi toate rândurile se re-criptează, aici, în
          browser — câteva secunde pe un vault obișnuit.
          Ceilalți membri activi primesc cheia automat.
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={() => void rotate()} className={BTN_SM_LIGHT}>
              Rotește cheia acum
            </button>
            <button type="button" onClick={() => setStage({ kind: "idle" })} className={BTN_SM}>
              Anulează
            </button>
          </div>
        </div>
      ) : null}

      {stage.kind === "rotating" ? (
        <p className="mt-5 text-[14.5px] text-dim" role="status">
          Se generează cheia și se sigilează pentru fiecare membru…
        </p>
      ) : null}

      {stage.kind === "code" ? (
        <div className="mt-2">
          <RecoveryCode
            code={stage.code}
            onConfirm={() => void reencrypt()}
            confirmLabel="Am notat codul nou — re-criptează rândurile"
          />
        </div>
      ) : null}

      {stage.kind === "reencrypting" ? (
        <p className="mt-5 font-md-mono text-[12px] tracking-[0.06em] text-bone tabular-nums" role="status">
          Se re-criptează {stage.done} din {stage.total}…
        </p>
      ) : null}

      {stage.kind === "done" ? (
        <div className="mt-2">
          <Note tone="info">
            {countNoun(stage.done, "rând re-criptat", "rânduri re-criptate")}
            {stage.skipped
              ? ` · ${countNoun(stage.skipped, "rând sărit", "rânduri sărite")} (modificate între timp sau ilizibile — reia re-criptarea)`
              : " · totul e pe cheia nouă"}
            .
          </Note>
          <button type="button" onClick={() => setStage({ kind: "idle" })} className={`${BTN_SM} mt-3`}>
            Am înțeles
          </button>
        </div>
      ) : null}
    </section>
  );
}
