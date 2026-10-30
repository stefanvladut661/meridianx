import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import type { Delta } from "@/lib/ads/metrics";
import { cn } from "@/lib/utils";

/**
 * Schimbarea față de perioada de aceeași durată de dinainte, ca `Trend` din kit
 * (săgeată + procent), dar cu trei sensuri: mentă = mai bine, roz = mai rău,
 * gri = informativ (cheltuiala nu e nici bună, nici rea). `Trend` din kit
 * cunoaște doar bine/rău, deci aici stă varianta care are și „informativ”.
 * Culoarea nu e singurul semnal: săgeata și procentul spun la fel, iar
 * cititorul de ecran aude „mai bine” sau „mai rău”.
 */
export function DeltaChip({ delta, className }: { delta: Delta; className?: string }) {
  if (delta.percent === null) return <span className="text-xs text-muted-foreground">—</span>;
  const rounded = Math.round(delta.percent);
  const Icon = rounded === 0 ? Minus : rounded > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={cn(
        "pu-num inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11.5px] font-medium",
        delta.tone === "good" ? "bg-mint/12 text-mint" : delta.tone === "bad" ? "bg-rose/12 text-rose" : "bg-white/[0.06] text-muted-foreground",
        className
      )}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      {rounded === 0 ? "la fel" : `${Math.abs(delta.percent).toLocaleString("ro-RO", { maximumFractionDigits: 1 })}%`}
      <span className="sr-only">{rounded === 0 ? "" : rounded > 0 ? ", în creștere" : ", în scădere"}{delta.tone === "good" ? " (mai bine)" : delta.tone === "bad" ? " (mai rău)" : ""}</span>
    </span>
  );
}
