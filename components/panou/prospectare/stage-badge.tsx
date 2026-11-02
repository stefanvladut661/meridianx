import { Check } from "lucide-react";
import { dateTimeRo } from "@/components/panou/ui/format";
import { CANALE, ETAPE } from "@/lib/prospectare/labels";
import type { Canal, Etapa, Firma } from "@/lib/prospectare/types";
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

type CuCanale = Pick<Firma, "email_la" | "whatsapp_la" | "whatsapp_cont" | "telefon_la">;

/** Canalele folosite, în ordinea fixă email → WhatsApp → telefon. */
export function canaleFolosite(f: CuCanale): { canal: Canal; la: string; cont: number | null }[] {
  const out: { canal: Canal; la: string; cont: number | null }[] = [];
  if (f.email_la) out.push({ canal: "email", la: f.email_la, cont: null });
  if (f.whatsapp_la) out.push({ canal: "whatsapp", la: f.whatsapp_la, cont: f.whatsapp_cont });
  if (f.telefon_la) out.push({ canal: "telefon", la: f.telefon_la, cont: null });
  return out;
}

/**
 * Canalele pe care a fost contactată firma: câte o pastilă cu bifă pentru
 * fiecare (email și WhatsApp pot fi amândouă). Fiecare canal se folosește o
 * singură dată; regula e în bază.
 */
export function CanaleBadge({ firma, className }: { firma: CuCanale; className?: string }) {
  const canale = canaleFolosite(firma);
  if (!canale.length) {
    return <span className={cn("whitespace-nowrap text-[11.5px] text-muted-foreground", className)}>necontactată</span>;
  }
  return (
    <span className={cn("inline-flex flex-wrap items-center gap-1", className)}>
      {canale.map((c) => {
        const meta = CANALE[c.canal];
        const detaliu = `${meta.label}${c.cont ? `, contul ${c.cont}` : ""}: ${dateTimeRo(c.la)}`;
        return (
          <span key={c.canal} title={detaliu} className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11.5px] font-medium", meta.badge)}>
            <Check className="h-2.5 w-2.5 opacity-80" aria-hidden="true" />
            {meta.label}
            <span className="sr-only"> ({detaliu})</span>
          </span>
        );
      })}
    </span>
  );
}
