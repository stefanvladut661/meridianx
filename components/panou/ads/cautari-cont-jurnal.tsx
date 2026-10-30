import { History } from "lucide-react";
import type { AccountChange } from "@/lib/ads/changes";
import { STORE_FAILURE_MESSAGE, type StoreResult } from "@/lib/ads/store";
import { Card, SectionTitle } from "@/components/panou/ui/primitives";
import { dateTimeRo } from "@/components/panou/ui/format";
import { cn } from "@/lib/utils";

/**
 * Jurnalul portalului pe contul ăsta (migrarea 10): ce a pus pe pauză, ce
 * negative a adăugat, ce liste a legat, ce acțiuni de conversie a creat — cine
 * și când. Doar portalul scrie aici; modificările din Google Ads sunt la Audit.
 * Pe pauză punctul e apricot (acțiunea care oprește cheltuiala), restul lavandă.
 */
export function CautariContJurnal({ journal }: { journal: StoreResult<AccountChange[]> }) {
  return (
    <Card as="section" aria-labelledby="jurnal" className="p-4 sm:p-5">
      <SectionTitle title={<span id="jurnal">Jurnalul modificărilor</span>} hint="ce a făcut portalul în contul ăsta" />
      {!journal.ok ? (
        <p className="mt-3 text-[12px] leading-relaxed text-muted-foreground">{STORE_FAILURE_MESSAGE[journal.reason]}</p>
      ) : journal.data.length === 0 ? (
        <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-dashed border-white/[0.12] px-3 py-3">
          <History className="mt-0.5 h-3.5 w-3.5 shrink-0 text-lav" aria-hidden="true" />
          <p className="text-[12px] leading-relaxed text-muted-foreground">Nimic încă. Fiecare pauză, negativ sau acțiune de conversie trimisă din portal apare aici, cu cine și când.</p>
        </div>
      ) : (
        <ol className="mt-3 space-y-3">
          {journal.data.map((entry) => (
            <li key={entry.id} className="flex gap-2.5">
              <span className={cn("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", entry.kind === "pause" ? "bg-apricot" : "bg-lav")} aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-[12px] leading-snug">{entry.summary}</p>
                <p className="text-[10.5px] text-muted-foreground">
                  {dateTimeRo(entry.createdAt)}
                  {entry.createdByEmail ? ` · ${entry.createdByEmail}` : ""} · {entry.operations} op.
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
