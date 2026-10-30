"use client";

import { useEffect, useId, useState, type InputHTMLAttributes, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { TextInput } from "@/components/panou/ui/select";
import { formatSeconds } from "./format";

/**
 * Piese mici, repetate în ecranele Vault-ului, cu clasele din prototip.
 * Kitul panoului (Card, Btn, Pill…) rămâne în `components/panou/ui`; aici sunt
 * doar bucățile care apar în prototip ca markup repetat, nu ca primitive.
 */

/** Eticheta de câmp, ca în prototip: mică, majusculă, cu spațiere. */
export const LABEL_CLASS = "text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground";

/** Titlul paginii (h1) cu rândul de explicație de sub el și, opțional, acțiuni în dreapta. */
export function PageHead({ title, text, action }: { title: string; text?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-[22px] font-semibold leading-none sm:text-[26px]">{title}</h1>
        {text ? <p className="mt-2 max-w-2xl text-[12.5px] text-muted-foreground">{text}</p> : null}
      </div>
      {action}
    </div>
  );
}

/** Câmp cu etichetă, indiciu și eroare, legate prin aria-describedby. */
export function LabeledInput({
  label,
  hint,
  error,
  className,
  mono = true,
  ...input
}: {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  mono?: boolean;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "id">) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-err`;
  const described = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className="block">
      <label htmlFor={id} className={LABEL_CLASS}>
        {label}
      </label>
      <TextInput
        id={id}
        className={cn("mt-1", mono && "font-mono", error && "border-rose/50", className)}
        aria-invalid={error ? true : undefined}
        aria-describedby={described}
        {...input}
      />
      {hint ? (
        <span id={hintId} className="mt-1 block text-[10px] text-muted-foreground">
          {hint}
        </span>
      ) : null}
      {error ? (
        <span id={errorId} className="mt-1 block text-[10px] text-rose">
          {error}
        </span>
      ) : null}
    </div>
  );
}

/** Secundele de la `startedAt` încoace, reactualizate de 10 ori pe secundă. */
export function useElapsed(startedAt: number | null): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (startedAt === null) return;
    setNow(Date.now());
    const interval = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(interval);
  }, [startedAt]);
  return startedAt === null ? 0 : Math.max(0, now - startedAt);
}

/**
 * Pasul în curs (derivarea cheii, deschiderea sesiunii…): spinner, ce se întâmplă
 * și cât a trecut. Bara e fără procent, fiindcă browserul nu știe cât mai durează
 * Argon2id; contorul de secunde spune tot ce are de spus.
 */
export function BusyBlock({ label, detail, startedAt }: { label: string; detail?: ReactNode; startedAt: number | null }) {
  const elapsed = useElapsed(startedAt);
  return (
    <div role="status" aria-live="polite">
      <p className="flex items-center gap-2 text-[12px] text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> {label}…
      </p>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.07]" aria-hidden="true">
        <div className="h-full w-1/3 animate-sweep rounded-full bg-mint" />
      </div>
      <p className="mt-1.5 text-[10.5px] text-muted-foreground/70">
        {detail}
        {detail ? " · " : null}
        <span className="pu-num font-mono text-foreground/80">{formatSeconds(elapsed)}</span>
      </p>
    </div>
  );
}

/** Cercul care se consumă (ceasul codului 2FA), din prototip. */
export function Ring({
  progress,
  size = 34,
  stroke = 3,
  color = "#8FE3B0",
  track = "rgba(255,255,255,0.1)",
}: {
  progress: number;
  size?: number;
  stroke?: number;
  color?: string;
  track?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - Math.min(1, Math.max(0, progress)))}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  );
}
