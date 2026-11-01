import { Lock } from "lucide-react";
import { CANALE, ETAPE } from "@/lib/prospectare/labels";
import type { Canal, Etapa } from "@/lib/prospectare/types";
import { cn } from "@/lib/utils";

/** Etapa firmei, ca în prototip (components/prospect/StageBadge.jsx), pe tema închisă. */
export function StageBadge({ etapa, className }: { etapa: Etapa; className?: string }) {
  const meta = ETAPE[etapa] ?? ETAPE.cercetat;
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11.5px] font-medium leading-5", meta.badge, className)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", meta.punct)} aria-hidden="true" />
      {meta.label}
    </span>
  );
}

/** Canalul blocat al firmei: odată setat, nu se mai schimbă (regula e în bază). */
export function CanalBadge({ canal, className }: { canal: Canal | null; className?: string }) {
  if (!canal) {
    return <span className={cn("whitespace-nowrap text-[11.5px] text-muted-foreground", className)}>fără canal</span>;
  }
  const meta = CANALE[canal] ?? CANALE.email;
  return (
    <span
      className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11.5px] font-medium", meta.badge, className)}
      title="Canal setat — nu se mai poate schimba din interfață"
    >
      {meta.label}
      <Lock className="h-2.5 w-2.5 opacity-70" aria-hidden="true" />
      <span className="sr-only"> (blocat)</span>
    </span>
  );
}
