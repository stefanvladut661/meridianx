import type { ReactNode } from "react";
import { ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { Info } from "../ui/info";
import { Card } from "../ui/primitives";

/**
 * „Regula casei”, ca în prototip: portalul creează doar pe pauză. Un singur
 * semn, mentă, pe ecranele care creează: regula pe un rând, detaliul sub „i”.
 */
export function HouseRule({ title = "Doar pe pauză", children, className }: { title?: string; children?: ReactNode; className?: string }) {
  return (
    <Card className={cn("border-mint/20 bg-mint/[0.05] p-4 sm:p-4", className)}>
      <div className="flex items-center gap-2.5">
        <ShieldCheck className="h-4 w-4 shrink-0 text-mint" aria-hidden="true" />
        <p className="text-[14.5px] font-medium text-[#C4F5D8]">{title}</p>
        <Info label="Regula casei">{children ?? "Pornirea, bugetul și licitarea se schimbă doar în platformă, de mână."}</Info>
      </div>
    </Card>
  );
}
