import type { ReactNode } from "react";
import { ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "../ui/primitives";

/**
 * „Regula casei”, ca în prototip: portalul creează doar pe pauză. Un singur
 * semn, mentă, pe care îl vezi mereu pe ecranele care creează. Nu apare nicăieri
 * un buton de pornire, de ștergere sau de schimbare a bugetului.
 */
export function HouseRule({ title = "Regula casei", children, className }: { title?: string; children?: ReactNode; className?: string }) {
  return (
    <Card className={cn("border-mint/20 bg-mint/[0.05] p-4 sm:p-4", className)}>
      <div className="flex items-start gap-2.5">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-mint" aria-hidden="true" />
        <div>
          <p className="text-[12.5px] font-medium text-[#C4F5D8]">{title}</p>
          <p className="mt-1 text-[11.5px] leading-relaxed text-[#C4F5D8]/75">
            {children ?? "Portalul creează campanii oprite. Pornirea, bugetul și licitarea se ating doar în platformă, de mână."}
          </p>
        </div>
      </div>
    </Card>
  );
}
