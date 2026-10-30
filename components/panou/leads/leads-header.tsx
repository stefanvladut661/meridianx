import { RefreshCw } from "lucide-react";
import { Btn, LiveDot, Pill } from "../ui/primitives";

/** Titlul ecranului, punctul „Live” și butonul de reîmprospătare, ca în prototip. */
export function LeadsHeader({ refreshing, onRefresh }: { refreshing: boolean; onRefresh: () => void }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <div className="flex items-center gap-2.5">
          <h1 className="text-[22px] font-semibold leading-none sm:text-[26px]">Lead-uri</h1>
          <Pill tone="lav" dot>
            formular site
          </Pill>
        </div>
        <p className="mt-2 text-[12.5px] text-muted-foreground">Cererile din divizia Video și Software, în ordinea în care au intrat.</p>
      </div>
      <div className="flex items-center gap-3">
        <LiveDot active={refreshing} label={refreshing ? "Se reîncarcă" : "Live · la 20s"} />
        <Btn size="sm" variant="outline" icon={RefreshCw} onClick={onRefresh}>
          Reîmprospătează
        </Btn>
      </div>
    </div>
  );
}
