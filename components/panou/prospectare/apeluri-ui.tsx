"use client";

import { useId, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { alegeUtilizator } from "@/app/(admin)/admin/prospectare/actions";
import { InlineNote } from "@/components/panou/ui/actions";
import { num } from "@/components/panou/ui/format";
import { Btn } from "@/components/panou/ui/primitives";
import { useToast } from "@/components/panou/ui/toast";
import { UTILIZATORI } from "@/lib/prospectare/labels";
import type { Utilizator } from "@/lib/prospectare/types";
import { cn } from "@/lib/utils";

/**
 * Piesele comune ale ecranelor „Apeluri azi” și „WhatsApp azi”. Ecranele se
 * folosesc din telefon: pe ecran îngust orice țintă are cel puțin 44 px, iar
 * câmpurile au 16 px (altfel iOS mărește pagina la focus). De la `sm` în sus
 * revin mărimile din prototip.
 */

/** Pentru `Btn size="sm"` și `btnClass({ size: "sm" })`. */
export const TAP_SM = "h-11 px-4 text-[14px] sm:h-8 sm:px-3 sm:text-[12.5px]";
/** Pentru `Btn size="md"`. */
export const TAP_MD = "h-11 text-[14px] sm:h-10 sm:text-[13.5px]";
/** Câmpuri de formular: 16 px pe telefon. */
export const CAMP = "h-11 text-base sm:h-9 sm:text-[13px]";
/** Comutatorul Ștefan / Vlăduț din fundație (SegmentedControl), cu ținta de 44 px pe telefon. */
export const COMUTATOR_TAP = "[&_button]:min-h-11 [&_button]:px-4 sm:[&_button]:min-h-0 sm:[&_button]:px-3";

/** Româna: 1 firmă, 2 firme, 20 de firme, 101 firme. */
export function firmeText(n: number): string {
  const rest = n % 100;
  if (n === 1) return "1 firmă";
  return n !== 0 && (rest === 0 || rest >= 20) ? `${num(n)} de firme` : `${num(n)} firme`;
}

/**
 * Taburile listei („De sunat · 4”). Pe telefon: trei coloane egale, eticheta
 * deasupra și numărul dedesubt, fără derulare laterală; de la `sm`, pastila din prototip.
 */
export function Taburi<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
  controls,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string; count: number }[];
  ariaLabel: string;
  controls?: string;
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="grid w-full grid-flow-col auto-cols-fr gap-1 rounded-[18px] border border-white/[0.07] bg-white/[0.03] p-1 sm:inline-flex sm:w-max sm:rounded-full"
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            aria-controls={controls}
            onClick={() => onChange(option.value)}
            className={cn(
              "flex min-h-11 min-w-0 flex-col items-center justify-center rounded-[14px] px-2 py-1 text-[13px] font-medium leading-tight transition-colors sm:min-h-0 sm:flex-row sm:rounded-full sm:px-3 sm:py-1.5 sm:text-[12.5px]",
              active ? "bg-white/[0.11] text-foreground shadow-[0_1px_0_rgba(255,255,255,0.07)_inset]" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <span className="max-w-full truncate">{option.label}</span>
            <span className={cn("pu-num text-[12px] sm:text-[12.5px]", active ? "text-foreground/80" : "text-muted-foreground")}>
              <span className="hidden sm:inline" aria-hidden="true">
                {" · "}
              </span>
              <span className="sr-only">: </span>
              {num(option.count)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Text ascuns sub un buton („Script scurt”, „Mesaj după apel”), ca în CallCard din prototip. */
export function Dezvaluire({ titlu, children, className }: { titlu: ReactNode; children: ReactNode; className?: string }) {
  const [deschis, setDeschis] = useState(false);
  const id = useId();
  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setDeschis((v) => !v)}
        aria-expanded={deschis}
        aria-controls={id}
        className="inline-flex min-h-11 items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground sm:min-h-0 sm:text-[11.5px]"
      >
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform sm:h-3 sm:w-3", deschis && "rotate-180")} aria-hidden="true" />
        {titlu}
      </button>
      <div id={id} hidden={!deschis} className="mt-1.5">
        {deschis ? children : null}
      </div>
    </div>
  );
}

/**
 * Pagina arată lista din `?cine=`, dar acțiunile salvează pe cel din cookie
 * (comutatorul). Când diferă, spunem asta și lăsăm omul să le potrivească.
 */
export function NepotrivireUtilizator({ cine, salvat }: { cine: Utilizator; salvat: Utilizator }) {
  const router = useRouter();
  const { notify } = useToast();
  const [pending, startTransition] = useTransition();
  if (cine === salvat) return null;
  return (
    <InlineNote tone="apricot" className="flex flex-wrap items-center justify-between gap-2">
      <p className="min-w-0 flex-1">
        Vezi lista lui {UTILIZATORI[cine]} din adresă, dar comutatorul e pe {UTILIZATORI[salvat]}: ce imporți intră în lista lui {UTILIZATORI[salvat]}, iar
        rezultatele apar ca date de {UTILIZATORI[salvat]}.
      </p>
      <Btn
        size="sm"
        variant="outline"
        disabled={pending}
        className={TAP_SM}
        onClick={() =>
          startTransition(async () => {
            const result = await alegeUtilizator(cine);
            notify(result.message, result.ok ? undefined : "error");
            router.refresh();
          })
        }
      >
        Lucrează ca {UTILIZATORI[cine]}
      </Btn>
    </InlineNote>
  );
}

/** Caseta cu textul pregătit (mesaj sau script). */
export function TextPregatit({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p
      className={cn(
        "whitespace-pre-wrap break-words rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2.5 text-[14px] leading-relaxed text-foreground/85 sm:text-[12px]",
        className
      )}
    >
      {children}
    </p>
  );
}
