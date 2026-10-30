"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { KeyRound, Lock } from "lucide-react";
import { KDF } from "@/lib/vault/crypto";
import { Btn, Card, Pill } from "@/components/panou/ui/primitives";
import { InlineNote } from "@/components/panou/ui/actions";
import { useVault, type BusyStep } from "../_components/vault-provider";
import { BusyBlock, LABEL_CLASS } from "./ui";

/** Ce se întâmplă în fiecare pas, în cuvinte. Același vocabular la deblocare, activare, recuperare. */
export const STEP_LABEL: Record<BusyStep, string> = {
  deriving: "Se derivă cheia din parola master",
  "signing-in": "Se deschide sesiunea",
  "updating-password": "Se înlocuiește parola temporară",
  opening: "Se deschid cheile",
  registering: "Se generează cheile",
  recovering: "Se deschide seiful cu codul",
  rekeying: "Se refac cheile",
};

export const argonDetail = `Argon2id · ${KDF.memlimit / (1024 * 1024)} MiB · ${KDF.opslimit} pași`;

const INPUT =
  "mt-1.5 h-10 w-full rounded-xl border border-white/[0.12] bg-white/[0.03] px-3 font-mono text-[13px] outline-none focus:border-mint/50 disabled:opacity-50";

/**
 * Poarta de deblocare (UnlockScreen din prototip). Parola master deschide
 * cheia în browser; din ea ies două chei: una te autentifică, cealaltă
 * descuie datele, iar serverul o vede doar pe prima. Fără email, contul nu
 * se știe: salt-ul Argon2id vine din el.
 */
export function UnlockScreen() {
  const vault = useVault();
  const [email, setEmail] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const busy = vault.phase.kind === "busy" ? vault.phase : null;

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const emailValue = String(form.get("email") ?? "").trim();
    const master = String(form.get("master") ?? "");
    if (!emailValue) {
      setFieldError("Completează emailul contului de seif.");
      return;
    }
    if (!master) {
      setFieldError("Completează parola master.");
      return;
    }
    setFieldError(null);
    void vault.unlock(emailValue, master);
  }

  return (
    <div className="mx-auto max-w-md">
      <Card className="pu-sealed border-white/[0.08] p-6 sm:p-8">
        <div className="flex items-center justify-between">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-mint/25 bg-mint/10">
            <Lock className="h-5 w-5 text-mint" aria-hidden="true" />
          </span>
          <Pill tone="neutral" className="font-mono text-[10px]">
            zero-knowledge
          </Pill>
        </div>
        <h1 className="mt-5 text-[20px] font-semibold">Seiful e încuiat</h1>
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">
          Parola master deschide cheia în browser. Serverul nu o vede niciodată și nu o poate recupera.
        </p>

        <div aria-live="polite">
          {vault.notice ? <InlineNote tone="neutral" className="mt-4">{vault.notice}</InlineNote> : null}
          {vault.error ? <InlineNote tone="rose" className="mt-4">{vault.error}</InlineNote> : null}
          {fieldError ? <InlineNote tone="rose" className="mt-4">{fieldError}</InlineNote> : null}
        </div>

        {busy ? (
          <div className="mt-5">
            <BusyBlock label={STEP_LABEL[busy.step]} detail={busy.step === "deriving" ? `${argonDetail} · durează câteva secunde, intenționat` : undefined} startedAt={busy.startedAt} />
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mt-5 space-y-3" noValidate>
            <label className="block">
              <span className={LABEL_CLASS}>Email</span>
              <input
                name="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="username"
                spellCheck={false}
                autoFocus
                placeholder="numele@firma.ro"
                className={INPUT}
              />
            </label>
            <label className="block">
              <span className={LABEL_CLASS}>Parolă master</span>
              <input name="master" type="password" autoComplete="current-password" placeholder="••••••••••••" className={`${INPUT} tracking-[0.2em]`} />
            </label>
            <Btn type="submit" variant="primary" className="w-full justify-center" icon={KeyRound}>
              Deschide seiful
            </Btn>
          </form>
        )}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.07] pt-4 text-[11.5px]">
          <Link href="/vault/recuperare" className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
            Recuperează cu codul
          </Link>
          <Link href="/vault/activare" className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
            Prima intrare? Activează seiful
          </Link>
        </div>
      </Card>
    </div>
  );
}
