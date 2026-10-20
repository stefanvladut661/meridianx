import { STATUS_LABEL } from "@/lib/ads/model/status";
import type { NormalizedStatus } from "@/lib/ads/model/types";
import { cn } from "@/lib/utils";

/**
 * Starea ca etichetă, nu comutator: portalul nu pornește nimic. Culoarea are un
 * sens (verde = cheltuie, chihlimbar = așteaptă, roșu = refuzat, gri = oprit),
 * iar textul o spune oricum — culoarea nu e singurul semnal.
 */
const TONE: Record<NormalizedStatus, string> = {
  active: "bg-[var(--ap-ok-soft)] text-[var(--ap-ok)]",
  review: "bg-[var(--ap-warn-soft)] text-[var(--ap-warn)]",
  scheduled: "bg-[var(--ap-accent-soft)] text-[var(--ap-accent-ink)]",
  issues: "bg-[var(--ap-warn-soft)] text-[var(--ap-warn)]",
  rejected: "bg-[var(--ap-error-soft)] text-[var(--ap-error)]",
  paused: "bg-[var(--ap-neutral-soft)] text-bone/80",
  ended: "bg-[var(--ap-neutral-soft)] text-dim",
  archived: "bg-[var(--ap-neutral-soft)] text-dim",
  removed: "bg-[var(--ap-neutral-soft)] text-dim",
  other: "bg-[var(--ap-neutral-soft)] text-dim",
};

export function StatusTag({ status, detail, className }: { status: NormalizedStatus; detail?: string | null; className?: string }) {
  return (
    <span
      title={detail ?? undefined}
      className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-0.5 text-[12.5px] font-semibold", TONE[status], className)}
    >
      {status === "active" ? <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" /> : null}
      {STATUS_LABEL[status]}
    </span>
  );
}
