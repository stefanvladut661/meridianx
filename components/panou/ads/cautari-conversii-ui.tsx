import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Câmpul de formular al filei Conversii: eticheta mică cu majuscule din kit,
 * controlul, apoi nota sau eroarea. Eticheta e legată prin `htmlFor`, iar nota
 * stă în afara ei: cititorul de ecran nu o citește ca parte din nume.
 */
export function Camp({
  id,
  label,
  children,
  hint,
  error,
  className,
}: {
  id: string;
  label: ReactNode;
  children: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <label htmlFor={id} className="text-[11.5px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </label>
      <div className="mt-1.5">{children}</div>
      {error ? (
        <p id={`${id}-eroare`} className="mt-1.5 text-[11.5px] leading-snug text-rose">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-nota`} className="mt-1.5 text-[11.5px] leading-snug text-muted-foreground/80">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** Legătura controlului cu nota sau cu eroarea lui (aria-describedby / aria-invalid). */
export function descriere(id: string, error: ReactNode, hasHint = false): { "aria-invalid"?: true; "aria-describedby"?: string } {
  if (error) return { "aria-invalid": true, "aria-describedby": `${id}-eroare` };
  return hasHint ? { "aria-describedby": `${id}-nota` } : {};
}

/** Câmp text/număr: aceeași înfățișare ca TextInput din kit, dar cu bordură roz la eroare. */
export const campClass = (invalid: boolean, mono = false) =>
  cn(
    "h-8 w-full rounded-lg border bg-white/[0.03] px-3 text-[13px] text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-lav/50 focus:bg-white/[0.05]",
    invalid ? "border-rose/60 bg-rose/[0.05]" : "border-white/[0.12]",
    mono && "font-mono text-[12.5px]"
  );
