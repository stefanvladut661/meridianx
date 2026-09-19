import type { ReactNode } from "react";
import { Mark } from "@/components/site/mark";

/**
 * Vocabularul vizual al vault-ului (feat/vault, faza 2).
 *
 * Aceeași gramatică ca admin-ul — glass, hairline, Satoshi + JetBrains
 * Mono, scope-ul neutru al porții — copiată local, fiindcă vault-ul nu
 * are voie să importe din zona admin-ului (CLAUDE.md §6, regula 6).
 * Deduplicarea, dacă va fi, e treaba unei faze de curățenie.
 */

/** Câmp de formular: hairline, fundal de cerneală, focus prin border. */
export const FIELD =
  "block w-full rounded-panel-sm border border-hair bg-ink/60 px-3.5 text-[15px] text-bone placeholder:text-dim transition-colors duration-150 focus:border-hair-strong";

/** Etichetă plină — stările membrilor. Plină, nu contur: se vede de la un metru. */
export const CHIP =
  "inline-flex items-center rounded-full px-3 py-1 font-md-body text-[12.5px] font-semibold normal-case leading-[1.15] tracking-[0.01em]";

export const CHIP_TONE = {
  active: "bg-bone text-ink",
  pending: "bg-[#f0b429] text-[#2a1a00]",
} as const;

/** Butoanele mici din liste și fișe (faza 3): aceeași pilulă ca în
    antet, la scara rândului. `disabled` nu prinde hover și se estompează. */
export const BTN_SM =
  "btn btn-ghost !min-h-8 !px-3.5 !py-1.5 !text-[12.5px] disabled:pointer-events-none disabled:opacity-60";
export const BTN_SM_LIGHT =
  "btn btn-light !min-h-8 !px-3.5 !py-1.5 !text-[12.5px] disabled:pointer-events-none disabled:opacity-60";

/** Eticheta mono a tipului unei intrări — nu chip plin: tipul e o
    coordonată, nu o stare. */
export const KIND_TAG = "font-md-mono text-[10.5px] uppercase tracking-[0.18em] text-dim";

/** `3` + `intrare`/`intrări` → „3 intrări"; de la 20 în sus româna cere
    „de": „20 de intrări". */
export function countNoun(count: number, singular: string, plural: string): string {
  if (count === 1) return `1 ${singular}`;
  if (count < 20) return `${count} ${plural}`;
  return `${count} de ${plural}`;
}

/** Fișa centrală: aceeași ca la login-ul de admin — un singur obiect pe
    ecran, marca sus, restul dedesubt. `wide` pentru codul de recuperare,
    care are nevoie de loc pentru 8 grupuri. */
export function Card({
  children,
  wide = false,
}: {
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div
      className={`glass-2 edge-light relative w-full !bg-[rgb(12_13_17/0.9)] p-7 sm:p-9 ${
        wide ? "max-w-[30rem]" : "max-w-[26rem]"
      }`}
    >
      <div className="flex items-center gap-2.5 text-bone">
        <Mark size={22} />
        <span className="font-md-display text-[14px] font-semibold tracking-[0.2em]">
          MERIDIAN
        </span>
      </div>
      {children}
    </div>
  );
}

/** Mesaj cu accent pe muchia stângă: roșu pentru eroare, bone pentru
    informație. `aria-live` îl pune apelantul, pe containerul stabil. */
export function Note({
  tone,
  children,
}: {
  tone: "error" | "info";
  children: ReactNode;
}) {
  const style =
    tone === "error"
      ? "border-[#ef4444] bg-[#ef4444]/10"
      : "border-bone/70 bg-bone/[0.06]";
  return (
    <p
      className={`mt-4 rounded-panel-sm border-l-[3px] px-3.5 py-2.5 text-[14.5px] leading-relaxed text-bone ${style}`}
    >
      {children}
    </p>
  );
}

/** Butonul principal al fișei — plin, lat, cu săgeata care alunecă. */
export function PrimaryButton({
  children,
  pending = false,
  pendingLabel,
  disabled = false,
  type = "submit",
  onClick,
}: {
  children: ReactNode;
  pending?: boolean;
  pendingLabel?: string;
  disabled?: boolean;
  type?: "submit" | "button";
  onClick?: () => void;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={pending || disabled}
      className="btn btn-light mt-7 w-full !min-h-12 !text-[15.5px] disabled:pointer-events-none disabled:opacity-60"
    >
      {pending ? pendingLabel ?? children : children}
      {!pending ? (
        <span className="arw" aria-hidden>
          →
        </span>
      ) : null}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Formatare — toate orele pe Europe/Bucharest, ca în admin.
// ---------------------------------------------------------------------------

const dateFormat = new Intl.DateTimeFormat("ro-RO", {
  timeZone: "Europe/Bucharest",
  day: "numeric",
  month: "short",
  year: "numeric",
});

export function formatDate(iso: string): string {
  return dateFormat.format(new Date(iso));
}

/** `2834` → `2,8 s`. Virgulă, nu punct: e text românesc, nu cod. */
export function formatSeconds(ms: number): string {
  return `${(ms / 1000).toFixed(1).replace(".", ",")} s`;
}

/** `754000` → `12:34`. */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
