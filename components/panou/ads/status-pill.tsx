import { STATUS_LABEL } from "@/lib/ads/model/status";
import type { NormalizedStatus } from "@/lib/ads/model/types";
import { Pill, type PillTone } from "../ui/primitives";

/**
 * Starea citită din platformă, ca `Pill` din kit (prototip: `STATUS_TONE`).
 * Culoarea are un sens (mentă = cheltuie, caisă = așteaptă, roz = refuzat,
 * închis = oprit), iar textul îl spune oricum.
 */
const TONE: Record<NormalizedStatus, PillTone> = {
  active: "mint",
  review: "apricot",
  scheduled: "sky",
  issues: "apricot",
  rejected: "rose",
  paused: "dark",
  ended: "neutral",
  archived: "neutral",
  removed: "neutral",
  other: "neutral",
};

export function StatusPill({ status, detail, className }: { status: NormalizedStatus; detail?: string | null; className?: string }) {
  return (
    <span title={detail ?? undefined} className="inline-flex">
      <Pill tone={TONE[status]} dot className={className}>
        {STATUS_LABEL[status]}
      </Pill>
    </span>
  );
}
