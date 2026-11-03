import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Capul ecranelor Prospectare: titlul, o pastilă cu o cifră vie (opțional) și acțiunile. Fără descriere
 * sub titlu (cerința din 3 nov): ce face pagina se vede din ea.
 */
export function PageHead({
  title,
  pill,
  pillTone = "lav",
  actions,
  className,
}: {
  title: ReactNode;
  pill?: ReactNode;
  pillTone?: "lav" | "mint" | "apricot" | "rose";
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-3", className)}>
      <div>
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="text-[22px] font-semibold leading-none sm:text-[26px]">{title}</h1>
          {pill ? (
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11.5px] font-medium",
                pillTone === "mint" && "border-mint/25 bg-mint/10 text-mint",
                pillTone === "apricot" && "border-apricot/25 bg-apricot/10 text-apricot",
                pillTone === "lav" && "border-lav/25 bg-lav/10 text-lav",
                pillTone === "rose" && "border-rose/25 bg-rose/10 text-rose"
              )}
            >
              {pill}
            </span>
          ) : null}
        </div>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
