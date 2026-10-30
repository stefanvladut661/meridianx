import type { ReactNode } from "react";
import { countOf } from "@/lib/ads/plan-derive";
import { cn } from "@/lib/utils";

/**
 * Piesele mici ale filelor Cont și Termeni (câmpuri native în stilul din
 * prototip, rândurile de alegere). Locale: kitul n-are textarea sau select mic.
 */

export const textareaClass =
  "w-full resize-y rounded-lg border border-white/[0.12] bg-white/[0.03] p-3 text-[12.5px] leading-relaxed outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-lav/50 focus:bg-white/[0.05]";

export const selectSmallClass =
  "h-7 rounded-lg border border-white/[0.1] bg-white/[0.04] px-2 text-[11.5px] text-foreground outline-none transition-colors hover:bg-white/[0.07] focus:border-lav/50";

export const checkClass = "h-4 w-4 shrink-0 accent-lav";

/** Eticheta de grup (legend) și cea a câmpurilor, aceeași ca `Field` din kit. */
export const legendClass = "text-[11.5px] font-medium uppercase tracking-[0.12em] text-muted-foreground";

/** „1 campanie” / „20 de campanii”: singular scris, plural cu „de” de la 20. */
export function counted(count: number, one: string, many: string): string {
  return count === 1 ? `1 ${one}` : countOf(count, many);
}

/** Un rând de alegere (radio) cu chenar, ca în prototip: cel ales are fundal lavandă. */
export function RadioRow({
  name,
  value,
  checked,
  disabled,
  onChange,
  children,
  aside,
}: {
  name: string;
  value: string;
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
  children: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-2.5 text-[13px] transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-lav",
        checked ? "border-lav/40 bg-lav/10 text-foreground" : "border-white/[0.09] text-foreground/80 hover:bg-white/[0.04]",
        disabled && "pointer-events-none opacity-45"
      )}
    >
      <input type="radio" name={name} value={value} checked={checked} disabled={disabled} onChange={onChange} className={checkClass} />
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {aside ? <span className="ml-auto shrink-0 font-mono text-[10.5px] text-muted-foreground">{aside}</span> : null}
    </label>
  );
}

/** Antetul unui card cu tabel sau listă, cu linie jos (ca în prototip: `border-b border-white/[0.06] px-4 py-3`). */
export function CardHead({ title, hint, action, id }: { title: ReactNode; hint?: ReactNode; action?: ReactNode; id?: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] px-4 py-3">
      <div className="min-w-0">
        <h2 id={id} className="text-[13.5px] font-medium">
          {title}
        </h2>
        {hint ? <p className="text-[11px] text-muted-foreground">{hint}</p> : null}
      </div>
      {action}
    </div>
  );
}

/** Capul de coloană al tabelelor, cu clasele din prototip. */
export const thClass = "px-3 py-2.5 font-medium";
export const theadClass = "border-b border-white/[0.06] text-[10px] uppercase tracking-[0.14em] text-muted-foreground";
