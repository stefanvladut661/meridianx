"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { KDF } from "@/lib/vault/crypto";
import { useVault, type BusyStep } from "./vault-provider";
import { Card, FIELD, Note, PrimaryButton, formatSeconds } from "./ui";
import { KeyRing } from "./key-ring";

/**
 * Ecranul de deblocare (feat/vault, faza 2).
 *
 * Două moduri în aceeași fișă:
 * - „Deblochează" — email + parolă master (calea de fiecare zi);
 * - „Activează contul" — prima intrare: parola temporară primită de la
 *   echipă + parola master aleasă acum. Activarea înlocuiește parola
 *   Supabase a contului cu authHash-ul derivat, deci de aici încolo
 *   contul intră DOAR prin vault.
 *
 * Cât rulează Argon2id (~3 s), formularul face loc inelului de chei și
 * unui contor real: ce algoritm, câtă memorie, câte secunde. Nu e
 * decor — e răspunsul la „de ce durează", scris în clar.
 */

const MIN_MASTER_LENGTH = 12;

type Mode = "unlock" | "activate";

const STEP_LABEL: Record<BusyStep, string> = {
  deriving: "Se derivă cheia din parola master",
  "signing-in": "Se deschide sesiunea",
  "updating-password": "Se înlocuiește parola temporară",
  opening: "Se deschid cheile",
  registering: "Se generează cheile",
};

export function UnlockScreen() {
  const vault = useVault();
  const [mode, setMode] = useState<Mode>("unlock");
  const [email, setEmail] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const headingRef = useRef<HTMLHeadingElement>(null);
  const ids = {
    email: useId(),
    temp: useId(),
    master: useId(),
    confirm: useId(),
    hint: useId(),
  };

  const busy = vault.phase.kind === "busy" ? vault.phase : null;

  // La schimbarea modului, titlul primește focusul: cititorul de ecran
  // află că s-a schimbat fișa, nu doar un câmp.
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [mode]);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const emailValue = String(form.get("email") ?? "").trim();
    const errors: Record<string, string> = {};

    if (!emailValue) errors.email = "Completează emailul.";

    if (mode === "unlock") {
      const master = String(form.get("master") ?? "");
      if (!master) errors.master = "Completează parola master.";
      setFieldErrors(errors);
      if (Object.keys(errors).length) return;
      void vault.unlock(emailValue, master);
      return;
    }

    const temp = String(form.get("temp") ?? "");
    const master = String(form.get("master") ?? "");
    const confirm = String(form.get("confirm") ?? "");
    if (!temp) errors.temp = "Completează parola temporară primită de la echipă.";
    if (master.length < MIN_MASTER_LENGTH) {
      errors.master = `Parola master are nevoie de cel puțin ${MIN_MASTER_LENGTH} caractere.`;
    }
    if (confirm !== master) errors.confirm = "Cele două parole master nu sunt identice.";
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;
    void vault.activate(emailValue, temp, master);
  }

  return (
    <Card>
      {busy ? (
        <BusyPanel step={busy.step} startedAt={busy.startedAt} mode={mode} kdfMs={vault.lastKdfMs} />
      ) : (
        <>
          <p className="eyebrow mt-8 !text-[11.5px]">
            {mode === "unlock" ? "Vault · zero-knowledge" : "Prima intrare · pasul 1 din 3"}
          </p>
          <h1
            ref={headingRef}
            tabIndex={-1}
            className="display mt-3 text-[2.125rem] text-bone outline-none"
          >
            {mode === "unlock" ? "Deblochează vault-ul" : "Activează contul"}
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-dim">
            {mode === "unlock"
              ? "Parola master nu pleacă din browser. Din ea ies două chei: una te autentifică, cealaltă descuie datele — serverul o vede doar pe prima."
              : "Ai primit de la echipă o parolă temporară. Alege acum parola master: nu pleacă din browser și nu se poate reseta prin email."}
          </p>

          <div aria-live="polite">
            {vault.notice ? <Note tone="info">{vault.notice}</Note> : null}
            {vault.error ? <Note tone="error">{vault.error}</Note> : null}
          </div>

          <form onSubmit={onSubmit} className="mt-8" noValidate>
            <Field
              id={ids.email}
              name="email"
              label="Email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={setEmail}
              error={fieldErrors.email}
            />

            {mode === "activate" ? (
              <Field
                id={ids.temp}
                name="temp"
                label="Parolă temporară"
                type="password"
                autoComplete="current-password"
                error={fieldErrors.temp}
              />
            ) : null}

            <Field
              id={ids.master}
              name="master"
              label="Parolă master"
              type="password"
              autoComplete={mode === "unlock" ? "current-password" : "new-password"}
              error={fieldErrors.master}
              describedBy={mode === "activate" ? ids.hint : undefined}
            />
            {mode === "activate" ? (
              <p id={ids.hint} className="mt-2 text-[13px] leading-relaxed text-dim">
                Minimum {MIN_MASTER_LENGTH} caractere. Contul devine dedicat vault-ului — dacă
                aceeași adresă intră și în /admin, folosește altă adresă aici.
              </p>
            ) : null}

            {mode === "activate" ? (
              <Field
                id={ids.confirm}
                name="confirm"
                label="Repetă parola master"
                type="password"
                autoComplete="new-password"
                error={fieldErrors.confirm}
              />
            ) : null}

            <PrimaryButton>{mode === "unlock" ? "Deblochează" : "Activează contul"}</PrimaryButton>
          </form>

          <button
            type="button"
            onClick={() => {
              setFieldErrors({});
              setMode(mode === "unlock" ? "activate" : "unlock");
            }}
            className="mt-5 text-[14px] text-dim underline-offset-4 transition-colors hover:text-bone hover:underline"
          >
            {mode === "unlock" ? "Prima intrare? Activează contul" : "← Am deja parola master"}
          </button>
        </>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------

function Field({
  id,
  name,
  label,
  type,
  autoComplete,
  value,
  onChange,
  error,
  describedBy,
}: {
  id: string;
  name: string;
  label: string;
  type: "email" | "password";
  autoComplete: string;
  value?: string;
  onChange?: (value: string) => void;
  error?: string;
  describedBy?: string;
}) {
  const errorId = `${id}-error`;
  const described = [error ? errorId : null, describedBy].filter(Boolean).join(" ") || undefined;
  return (
    <div className="mt-4 first:mt-0">
      <label htmlFor={id} className="eyebrow !text-[11.5px]">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        autoComplete={autoComplete}
        required
        value={value}
        onChange={onChange ? (event) => onChange(event.target.value) : undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={described}
        className={`${FIELD} mt-2 h-12 ${error ? "!border-[#ef4444]" : ""}`}
        spellCheck={false}
      />
      {error ? (
        <p id={errorId} className="mt-1.5 text-[13px] text-[#ff8a8a]">
          {error}
        </p>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------

/** Contorul: se actualizează de 10 ori pe secundă cât durează pasul. */
function useElapsed(startedAt: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    setNow(Date.now());
    const interval = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(interval);
  }, [startedAt]);
  return Math.max(0, now - startedAt);
}

export function BusyPanel({
  step,
  startedAt,
  mode,
  kdfMs,
}: {
  step: BusyStep;
  startedAt: number;
  mode?: Mode;
  kdfMs: number | null;
}) {
  const elapsed = useElapsed(startedAt);
  const memoryMiB = KDF.memlimit / (1024 * 1024);

  return (
    <div className="mt-8 text-center" role="status" aria-live="polite">
      <p className="eyebrow !text-[11.5px]">
        {mode === "activate" ? "Prima intrare · pasul 1 din 3" : "Vault · zero-knowledge"}
      </p>
      <KeyRing spinning className="mx-auto mt-6 h-40 w-40 text-bone" />
      <p className="display mt-6 text-[1.5rem] text-bone">{STEP_LABEL[step]}</p>
      <p className="mt-3 font-md-mono text-[12px] tracking-[0.08em] text-dim">
        {step === "deriving" ? (
          <>
            Argon2id · {memoryMiB} MiB · {KDF.opslimit} pași ·{" "}
            <span className="text-bone tabular-nums">{formatSeconds(elapsed)}</span>
          </>
        ) : (
          <>
            {kdfMs !== null ? <>cheie derivată în {formatSeconds(kdfMs)} · </> : null}
            <span className="text-bone tabular-nums">{formatSeconds(elapsed)}</span>
          </>
        )}
      </p>
    </div>
  );
}
