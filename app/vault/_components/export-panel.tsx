"use client";

import { useEffect, useId, useState, type FormEvent } from "react";
import type { VaultSnapshot } from "@/lib/vault/entries";
import {
  EXPORT_MIN_PASSPHRASE,
  buildPlaintext,
  encryptExport,
  exportFileName,
} from "@/lib/vault/export";
import { KDF, VaultCryptoError } from "@/lib/vault/crypto";
import { KeyRing } from "./key-ring";
import { BTN_SM, FIELD, Note, countNoun, formatSeconds } from "./ui";

/**
 * Exportul criptat (feat/vault, faza 9), în aceeași ramă ca fișa.
 *
 * O parolă de export (alta decât cea master), Argon2id cu inelul la
 * vedere, apoi fișierul se descarcă din browser — nimic nu trece prin
 * server. Textul spune de ce parola de export nu se poate recupera și
 * de ce fișierul nu e „backup-ul" vault-ului decât dacă îl pui undeva
 * unde nu e laptopul.
 */

function describe(error: unknown): string {
  if (error instanceof VaultCryptoError) return error.message;
  return "Exportul a eșuat dintr-un motiv necunoscut.";
}

export function ExportPanel({
  snapshot,
  headingId,
  onClose,
}: {
  snapshot: VaultSnapshot | null;
  headingId: string;
  onClose: () => void;
}) {
  const ids = { pass: useId(), confirm: useId() };
  const [busyStartedAt, setBusyStartedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState<{ name: string; entries: number; clients: number } | null>(null);

  const readable = snapshot?.entries.filter((entry) => entry.status === "ok").length ?? 0;
  const unreadable = (snapshot?.entries.length ?? 0) - readable;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!snapshot) return;
    const form = new FormData(event.currentTarget);
    const pass = String(form.get("pass") ?? "");
    const confirm = String(form.get("confirm") ?? "");
    const errors: Record<string, string> = {};
    if (pass.length < EXPORT_MIN_PASSPHRASE) {
      errors.pass = `Parola de export are nevoie de cel puțin ${EXPORT_MIN_PASSPHRASE} caractere.`;
    }
    if (confirm !== pass) errors.confirm = "Cele două parole nu sunt identice.";
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;

    setError(null);
    setBusyStartedAt(Date.now());
    try {
      const plain = buildPlaintext(snapshot);
      const file = await encryptExport(plain, pass);
      const name = exportFileName();
      const blob = new Blob([JSON.stringify(file, null, 1)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = name;
      anchor.rel = "noopener";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
      setDone({ name, entries: plain.entries.length, clients: plain.clients.length });
      event.currentTarget.reset();
    } catch (cause) {
      setError(describe(cause));
    } finally {
      setBusyStartedAt(null);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-4 border-b border-hair px-5 py-5 sm:px-6">
        <div className="min-w-0">
          <p className="font-md-mono text-[10.5px] uppercase tracking-[0.18em] text-dim">Export · criptat</p>
          <h2 id={headingId} className="display mt-2 text-[1.5rem] text-bone sm:text-[1.625rem]">
            Copia ta, sub altă parolă
          </h2>
        </div>
        <button type="button" onClick={onClose} disabled={busyStartedAt !== null} className={`${BTN_SM} shrink-0`}>
          Închide
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
        <p className="text-[14.5px] leading-relaxed text-dim">
          Un fișier JSON cu {countNoun(readable, "intrare", "intrări")} și{" "}
          {countNoun(snapshot?.clients.length ?? 0, "client", "clienți")}, criptat aici, în browser, cu o
          parolă de export — <strong className="font-semibold text-bone">alta decât cea master</strong>. Se
          deschide doar cu ea, oriunde, oricând: în vault-ul ăsta, în altul, peste ani.
          {unreadable > 0 ? ` ${countNoun(unreadable, "intrare ilizibilă rămâne", "intrări ilizibile rămân")} pe dinafară.` : ""}
        </p>
        <p className="mt-3 font-md-mono text-[11px] leading-relaxed tracking-[0.06em] text-dim">
          Argon2id · {KDF.memlimit / (1024 * 1024)} MiB · {KDF.opslimit} pași · XChaCha20-Poly1305 · salt aleator per fișier
        </p>

        <div aria-live="polite">
          {error ? <Note tone="error">{error}</Note> : null}
          {done ? (
            <Note tone="info">
              <strong className="font-semibold">{done.name}</strong> — {countNoun(done.entries, "intrare", "intrări")},{" "}
              {countNoun(done.clients, "client", "clienți")}. Pune-l undeva unde nu e laptopul (un disc, un
              cloud) și ține parola de export separat de el. Fără ea, fișierul e zgomot.
            </Note>
          ) : null}
        </div>

        {busyStartedAt !== null ? (
          <BusyInline startedAt={busyStartedAt} />
        ) : (
          <form onSubmit={onSubmit} className="mt-6" noValidate>
            <Field id={ids.pass} name="pass" label="Parola de export" error={fieldErrors.pass} hint={`Minimum ${EXPORT_MIN_PASSPHRASE} caractere. Nu se poate recupera — nici cu codul vault-ului.`} />
            <Field id={ids.confirm} name="confirm" label="Repetă parola de export" error={fieldErrors.confirm} />
            <button
              type="submit"
              disabled={!snapshot || readable === 0}
              className="btn btn-light mt-5 !min-h-10 !px-5 !py-2.5 !text-[13.5px] disabled:pointer-events-none disabled:opacity-60"
            >
              Criptează și descarcă
            </button>
          </form>
        )}
      </div>

      <div className="border-t border-hair px-5 py-3.5 font-md-mono text-[11px] leading-relaxed tracking-[0.06em] text-dim sm:px-6">
        se importă înapoi din „Importă” · nu conține istoricul și coșul
      </div>
    </div>
  );
}

function Field({ id, name, label, error, hint }: { id: string; name: string; label: string; error?: string; hint?: string }) {
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const described = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className="mt-4 first:mt-0">
      <label htmlFor={id} className="eyebrow !text-[11px]">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type="password"
        autoComplete="new-password"
        required
        aria-invalid={error ? true : undefined}
        aria-describedby={described}
        className={`${FIELD} mt-1.5 h-11 ${error ? "!border-[#ef4444]" : ""}`}
        spellCheck={false}
      />
      {hint ? (
        <p id={hintId} className="mt-1.5 text-[12.5px] leading-relaxed text-dim">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="mt-1.5 text-[13px] text-[#ff8a8a]">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function BusyInline({ startedAt }: { startedAt: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(interval);
  }, []);
  return (
    <div className="mt-6 flex items-center gap-4" role="status" aria-live="polite">
      <KeyRing spinning className="h-16 w-16 shrink-0 text-bone" />
      <div>
        <p className="text-[15px] text-bone">Se derivă cheia de export</p>
        <p className="mt-1 font-md-mono text-[12px] tracking-[0.08em] text-dim">
          Argon2id · <span className="text-bone tabular-nums">{formatSeconds(Math.max(0, now - startedAt))}</span>
        </p>
      </div>
    </div>
  );
}
