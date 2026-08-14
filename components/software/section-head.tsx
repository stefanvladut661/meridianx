import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Capul de secțiune al lumii software (FAZA 4).
 *
 * `code` NU e decor: e citirea tehnică a secțiunii — spune ce urmează
 * în vocabularul unui instrument (CLAUDE.md §3, „structura codifică
 * informație”). Dacă un cod nu spune nimic adevărat, nu-l pune.
 *
 * Deliberat diferit de `SectionSlate` din video: acolo e o clachetă de
 * platou, aici e o etichetă de aparat — aceeași funcție, dialect diferit.
 */
export function SectionHead({
  code,
  title,
  lead,
  as: Heading = "h2",
  align = "start",
  className,
}: {
  code: string;
  title: ReactNode;
  lead?: ReactNode;
  as?: "h1" | "h2" | "h3";
  align?: "start" | "center";
  className?: string;
}) {
  return (
    <div
      className={cn(
        align === "center" ? "mx-auto max-w-3xl text-center" : "max-w-3xl",
        className
      )}
    >
      <p
        className={cn(
          "flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.24em] text-accent-2",
          align === "center" && "justify-center"
        )}
      >
        <span aria-hidden="true" className="h-px w-6 bg-accent-2/60" />
        {code}
      </p>
      <Heading
        className={cn(
          "mt-4 text-balance font-display font-semibold tracking-tight",
          Heading === "h1"
            ? "text-4xl sm:text-5xl lg:text-6xl"
            : "text-3xl sm:text-4xl"
        )}
      >
        {title}
      </Heading>
      {lead ? (
        <p className="mt-4 text-pretty text-lg leading-relaxed text-fg/75">
          {lead}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Marcajul de conținut fals (CLAUDE.md §5).
 * Vizibil, nu ascuns într-un comentariu: un vizitator trebuie să poată
 * distinge un studiu de caz real de unul de structură.
 */
export function PlaceholderTag({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-xs border border-accent-2/40 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-accent-2",
        className
      )}
    >
      <span aria-hidden="true" className="size-1 rounded-full bg-accent-2" />
      Exemplu de structură
    </span>
  );
}
