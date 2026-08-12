import { cn } from "@/lib/utils";

/**
 * Heading de secțiune în vocabularul platoului (FAZA 2, divizia VIDEO):
 * un „slate” mono deasupra titlului — codul spune ceva adevărat despre
 * conținut (scenă, durată, stare), nu e decor.
 */
export interface SectionSlateProps {
  /** Marcajul mono de deasupra titlului, ex. „SC.01–05 · PENTRU CINE FILMĂM”. */
  code: string;
  title: string;
  lead?: string;
  className?: string;
}

export function SectionSlate({ code, title, lead, className }: SectionSlateProps) {
  return (
    <div className={cn("max-w-3xl", className)}>
      <p className="font-mono text-xs uppercase tracking-[0.3em] text-fg/60">
        <span aria-hidden="true" className="text-accent">
          ■{" "}
        </span>
        {code}
      </p>
      <h2 className="mt-4 text-balance font-display text-4xl tracking-tight sm:text-5xl">
        {title}
      </h2>
      {lead ? <p className="mt-4 text-pretty text-lg text-fg/70">{lead}</p> : null}
    </div>
  );
}
