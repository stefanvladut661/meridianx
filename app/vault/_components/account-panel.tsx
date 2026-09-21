"use client";

import { useEffect, useId, useState, type FormEvent } from "react";
import { KDF, VaultCryptoError } from "@/lib/vault/crypto";
import { VaultDataError } from "@/lib/vault/members";
import { useVault, type BusyStep } from "./vault-provider";
import { KeyRing } from "./key-ring";
import { FIELD, Note, formatSeconds } from "./ui";

/**
 * Contul tău — schimbarea parolei master (feat/vault, faza 7), în
 * vederea Membri.
 *
 * Două derivări Argon2id (parola actuală, ca dovadă; parola nouă,
 * pentru KEK-ul nou) — cam 6 secunde pe un laptop, cu inelul și pașii
 * la vedere, ca la deblocare. Parola actuală se cere fiindcă un laptop
 * lăsat deblocat nu trebuie să fie de ajuns ca să preiei contul.
 *
 * Ce NU se schimbă: DEK-ul, deci nici datele, nici codul de recuperare.
 * Ce se schimbă: perechea de chei a membrului și parola Supabase.
 */

const MIN_MASTER_LENGTH = 12;

const STEP_LABEL: Partial<Record<BusyStep, string>> = {
  deriving: "Se derivă cheia din parolă",
  "signing-in": "Se verifică parola actuală",
  rekeying: "Se refac cheile",
  "updating-password": "Se schimbă parola Supabase",
};

function describe(error: unknown): string {
  if (error instanceof VaultDataError || error instanceof VaultCryptoError || error instanceof Error) {
    return error.message;
  }
  return "Schimbarea parolei a eșuat dintr-un motiv necunoscut.";
}

export function AccountPanel() {
  const vault = useVault();
  const ids = { current: useId(), next: useId(), confirm: useId() };
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<BusyStep | null>(null);
  const [startedAt, setStartedAt] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const current = String(form.get("current") ?? "");
    const next = String(form.get("next") ?? "");
    const confirm = String(form.get("confirm") ?? "");
    const errors: Record<string, string> = {};
    if (!current) errors.current = "Completează parola master actuală.";
    if (next.length < MIN_MASTER_LENGTH) {
      errors.next = `Parola master nouă are nevoie de cel puțin ${MIN_MASTER_LENGTH} caractere.`;
    } else if (next === current) {
      errors.next = "Parola nouă e identică cu cea actuală.";
    }
    if (confirm !== next) errors.confirm = "Cele două parole noi nu sunt identice.";
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;

    setError(null);
    setDone(false);
    const formElement = event.currentTarget;
    try {
      await vault.changeMasterPassword(current, next, (s) => {
        setStep(s);
        setStartedAt(Date.now());
      });
      setDone(true);
      setOpen(false);
      formElement.reset();
    } catch (cause) {
      setError(describe(cause));
    } finally {
      setStep(null);
    }
  }

  return (
    <section aria-labelledby="cont-titlu" className="glass mt-6 rounded-panel-lg p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <p className="eyebrow !text-[11.5px]">Contul tău</p>
          <h2 id="cont-titlu" className="display mt-2 text-[1.5rem] text-bone">
            Parola master
          </h2>
        </div>
        {!open && !step ? (
          <button
            type="button"
            onClick={() => {
              setOpen(true);
              setDone(false);
            }}
            className="btn btn-ghost !min-h-9 !px-4 !py-2 !text-[12.5px]"
          >
            Schimbă parola master
          </button>
        ) : null}
      </div>

      <p className="mt-3 max-w-[40rem] text-[14.5px] leading-relaxed text-dim">
        {vault.member?.email} · Din parola master ies cheile tale; datele și codul de recuperare
        rămân aceleași. Nu se poate reseta prin email — dacă o pierzi, cere o parolă temporară
        și folosește codul de recuperare.
      </p>

      <div aria-live="polite">
        {done ? (
          <Note tone="info">
            Parola master s-a schimbat. Cheile tale au fost refăcute; codul de recuperare rămâne
            valabil. De acum, deblochezi cu parola nouă.
          </Note>
        ) : null}
        {error ? <Note tone="error">{error}</Note> : null}
      </div>

      {step ? (
        <BusyInline step={step} startedAt={startedAt} />
      ) : open ? (
        <form onSubmit={onSubmit} className="mt-5 max-w-[26rem]" noValidate>
          <PasswordField
            id={ids.current}
            name="current"
            label="Parola master actuală"
            autoComplete="current-password"
            error={fieldErrors.current}
          />
          <PasswordField
            id={ids.next}
            name="next"
            label="Parola master nouă"
            autoComplete="new-password"
            error={fieldErrors.next}
            hint={`Minimum ${MIN_MASTER_LENGTH} caractere.`}
          />
          <PasswordField
            id={ids.confirm}
            name="confirm"
            label="Repetă parola nouă"
            autoComplete="new-password"
            error={fieldErrors.confirm}
          />
          <div className="mt-5 flex flex-wrap gap-2">
            <button type="submit" className="btn btn-light !min-h-10 !px-5 !py-2.5 !text-[13.5px]">
              Schimbă parola
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setFieldErrors({});
                setError(null);
              }}
              className="btn btn-ghost !min-h-10 !px-5 !py-2.5 !text-[13.5px]"
            >
              Anulează
            </button>
          </div>
        </form>
      ) : null}
    </section>
  );
}

function PasswordField({
  id,
  name,
  label,
  autoComplete,
  error,
  hint,
}: {
  id: string;
  name: string;
  label: string;
  autoComplete: string;
  error?: string;
  hint?: string;
}) {
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const described = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className="mt-4 first:mt-0">
      <label htmlFor={id} className="eyebrow !text-[11.5px]">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type="password"
        autoComplete={autoComplete}
        required
        aria-invalid={error ? true : undefined}
        aria-describedby={described}
        className={`${FIELD} mt-2 h-11 ${error ? "!border-[#ef4444]" : ""}`}
        spellCheck={false}
      />
      {hint ? (
        <p id={hintId} className="mt-1.5 text-[13px] text-dim">
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

/** Aceeași demonstrație ca la deblocare: inelul, pasul, secundele. */
function BusyInline({ step, startedAt }: { step: BusyStep; startedAt: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    setNow(Date.now());
    const interval = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(interval);
  }, [startedAt]);
  const elapsed = Math.max(0, now - startedAt);
  return (
    <div className="mt-5 flex items-center gap-4" role="status" aria-live="polite">
      <KeyRing spinning className="h-16 w-16 shrink-0 text-bone" />
      <div>
        <p className="text-[15px] text-bone">{STEP_LABEL[step] ?? "Se lucrează…"}</p>
        <p className="mt-1 font-md-mono text-[12px] tracking-[0.08em] text-dim">
          {step === "deriving" ? `Argon2id · ${KDF.memlimit / (1024 * 1024)} MiB · ${KDF.opslimit} pași · ` : null}
          <span className="text-bone tabular-nums">{formatSeconds(elapsed)}</span>
        </p>
      </div>
    </div>
  );
}
