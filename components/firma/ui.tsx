import type { ReactNode } from "react";
import type { Tone } from "@/lib/firma/tone";
import { cn } from "@/lib/utils";

/**
 * Bucățile comune ale ecranelor modulului: titlul paginii, câmpurile,
 * etichetele de stare, anunțurile. Aceleași măsuri ca portalul de reclame.
 */

export const inputClass =
  "h-10 w-full rounded-lg border border-hair-strong bg-char px-3 text-[14px] text-bone placeholder:text-dim/70 focus-visible:border-[var(--md-a1)] aria-[invalid=true]:border-[var(--ap-error)]";
export const textareaClass =
  "w-full rounded-lg border border-hair-strong bg-char px-3 py-2 text-[14px] leading-relaxed text-bone placeholder:text-dim/70 focus-visible:border-[var(--md-a1)] aria-[invalid=true]:border-[var(--ap-error)]";
export const labelClass = "block text-[13px] font-medium text-bone";
export const thClass = "whitespace-nowrap px-3 py-2 text-left text-[12px] font-semibold uppercase tracking-[0.06em] text-dim";
export const tdClass = "px-3 py-2.5 align-top text-[14px] text-bone";

export function PageHead({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-[1.5rem] font-semibold tracking-tight text-bone">{title}</h1>
        {subtitle ? <p className="mt-0.5 max-w-3xl text-[13.5px] text-dim">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function Field({
  id,
  label,
  hint,
  error,
  children,
  className,
}: {
  id: string;
  label: string;
  hint?: ReactNode;
  error?: string | null;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <div className="mt-1">{children}</div>
      {error ? (
        <p id={`${id}-eroare`} className="mt-1 text-[13px] text-[var(--ap-error)]">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-ajutor`} className="mt-1 text-[12.5px] text-dim">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export type { Tone };

const TONE: Record<Tone, string> = {
  ok: "bg-[var(--ap-ok-soft)] text-[var(--ap-ok)]",
  warn: "bg-[var(--ap-warn-soft)] text-[var(--ap-warn)]",
  error: "bg-[var(--ap-error-soft)] text-[var(--ap-error)]",
  accent: "bg-[var(--ap-accent-soft)] text-[var(--ap-accent-ink)]",
  neutral: "bg-[var(--ap-neutral-soft)] text-bone/80",
  muted: "bg-[var(--ap-neutral-soft)] text-dim",
};

/** Starea ca etichetă: culoarea are un sens, iar textul îl spune oricum. */
export function Tag({ tone, children, title, className }: { tone: Tone; children: ReactNode; title?: string; className?: string }) {
  return (
    <span title={title} className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-0.5 text-[12.5px] font-semibold", TONE[tone], className)}>
      {children}
    </span>
  );
}

export function Notice({ tone = "neutral", children, className }: { tone?: "neutral" | "warn" | "error" | "ok"; children: ReactNode; className?: string }) {
  const toneClass =
    tone === "error"
      ? "border-[var(--ap-error)]/30 bg-[var(--ap-error-soft)] text-[var(--ap-error)]"
      : tone === "warn"
        ? "border-[var(--ap-warn)]/25 bg-[var(--ap-warn-soft)] text-[var(--ap-warn)]"
        : tone === "ok"
          ? "border-[var(--ap-ok)]/25 bg-[var(--ap-ok-soft)] text-[var(--ap-ok)]"
          : "border-hair bg-[var(--ap-side)] text-bone/85";
  return <div className={cn("rounded-xl border px-4 py-3 text-[14px] leading-relaxed", toneClass, className)}>{children}</div>;
}

export function Empty({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("rounded-xl border border-dashed border-hair-strong px-5 py-8 text-center text-[14.5px] text-dim", className)}>{children}</div>;
}
