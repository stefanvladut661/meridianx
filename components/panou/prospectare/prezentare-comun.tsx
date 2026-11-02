import { num } from "@/components/panou/ui/format";
import type { Dispozitiv } from "@/lib/prospectare/types";
import { cn } from "@/lib/utils";

/**
 * Bucăți comune ecranelor Prospectare (Prezentare, Email, Roboți, Setări).
 * Fără "use client": se folosesc și din paginile de server, și din componentele client.
 */

/** Fișa unei firme: tabelul Firme o deschide din `?firma=<id>`. */
export const linkFirma = (id: string): string => `/admin/prospectare/firme?firma=${encodeURIComponent(id)}`;

/** „1 căsuță”, „5 căsuțe”, „20 de căsuțe”: pluralul românesc, cu numărul formatat. */
export function cate(n: number, unu: string, multe: string): string {
  const rest = n % 100;
  const cuDe = rest >= 20 || (rest === 0 && n !== 0);
  return `${num(n)} ${n === 1 ? unu : cuDe ? `de ${multe}` : multe}`;
}

/** Un robot e „activ acum” dacă a cerut ceva în ultimele 15 minute (aceeași regulă ca rezumatul din bază). */
export const ACTIV_ACUM_MS = 15 * 60 * 1000;

export type StareRobot = "acum" | "asteapta" | "oprit";

export function stareRobot(d: Pick<Dispozitiv, "activ" | "ultima_activitate">, acum: number): StareRobot {
  if (!d.activ) return "oprit";
  if (d.ultima_activitate && acum - new Date(d.ultima_activitate).getTime() < ACTIV_ACUM_MS) return "acum";
  return "asteapta";
}

const STARI: Record<StareRobot, { label: string; title: string; punct: string; text: string }> = {
  acum: { label: "activ acum", title: "A cerut ceva în ultimele 15 minute", punct: "animate-dotpulse bg-mint", text: "text-[#A7EFC3]" },
  asteapta: { label: "în așteptare", title: "Activ, dar n-a cerut nimic în ultimele 15 minute", punct: "bg-apricot/70", text: "text-muted-foreground" },
  oprit: { label: "dezactivat", title: "Dezactivat din admin: primește 401 la orice cerere", punct: "bg-white/25", text: "text-muted-foreground" },
};

/** Starea robotului, ca `LiveDot` din prototip, cu trei stări în loc de două. */
export function RobotStare({ stare, className }: { stare: StareRobot; className?: string }) {
  const meta = STARI[stare];
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap text-[11.5px]", meta.text, className)} title={meta.title}>
      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", meta.punct)} aria-hidden="true" />
      {meta.label}
    </span>
  );
}
