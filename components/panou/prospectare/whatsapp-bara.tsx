"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Check, Loader2, MessageCircle, Undo2, X } from "lucide-react";
import { btnClass } from "@/components/panou/ui/primitives";
import { cn } from "@/lib/utils";

/**
 * Bara de jos a ecranului „WhatsApp azi”, după fiecare trimitere: „Trimis pe
 * <cont> · Anulează”, 10 secunde. Toast-ul din kit n-are buton, de aici bara
 * proprie. Timpul stă pe loc cât mouse-ul sau focusul e pe bară (cine citește
 * sau ajunge la „Anulează” cu tastatura nu e grăbit). Anunțurile pentru
 * cititorul de ecran le face ecranul, într-o zonă `aria-live` separată.
 */

export interface BaraWhatsapp {
  /** Crește la fiecare mesaj nou: repornește cele 10 secunde. */
  id: number;
  /**
   * trimis: marcată, WhatsApp deschis · blocat: marcată, dar browserul n-a deschis fereastra ·
   * anulare: se anulează · anulat: marcarea s-a anulat · eroare: acțiunea a fost refuzată.
   */
  tip: "trimis" | "blocat" | "anulare" | "anulat" | "eroare";
  firmaId: string;
  firma: string;
  /** Contul de pe care a plecat (pentru „trimis” și „blocat”). */
  contNume?: string;
  titlu: string;
  detaliu?: string;
  /** Contul a trecut de limita zilei: avertisment, mesajul a plecat. */
  pesteLimita?: boolean;
  /** Conversația cu mesajul gata (pentru „blocat”). */
  link?: string;
}

const SECUNDE = 10;
/** Mesajele care pleacă singure; „blocat” și „eroare” stau până le închizi, „anulare” până răspunde baza. */
const SE_INCHIDE_SINGURA = new Set<BaraWhatsapp["tip"]>(["trimis", "anulat"]);

export function BaraTrimitere({
  bara,
  onAnuleaza,
  onDeschis,
  onInchide,
}: {
  bara: BaraWhatsapp | null;
  onAnuleaza: (firmaId: string) => void;
  /** „Deschide WhatsApp” din bara „blocat” a fost apăsat. */
  onDeschis: () => void;
  /** `deLaButon`: închisă cu ×, focusul trebuie mutat înapoi în listă. */
  onInchide: (deLaButon: boolean) => void;
}) {
  const [pauza, setPauza] = useState(false);
  const ref = useRef<HTMLElement>(null);
  const id = bara?.id;
  const tip = bara?.tip;

  // Mesaj nou: pauza se recalculează. Butonul apăsat poate să fi dispărut fără `blur`, iar pauza ar rămâne agățată.
  useEffect(() => {
    const el = ref.current;
    setPauza(!!el && (el.matches(":hover") || el.contains(document.activeElement)));
  }, [id]);

  useEffect(() => {
    if (id === undefined || !tip || !SE_INCHIDE_SINGURA.has(tip) || pauza) return;
    const t = setTimeout(() => onInchide(false), SECUNDE * 1000);
    return () => clearTimeout(t);
  }, [id, tip, pauza, onInchide]);

  if (!bara) return null;

  const ton = bara.tip === "eroare" ? "rose" : bara.tip === "blocat" || bara.pesteLimita ? "apricot" : bara.tip === "trimis" ? "mint" : "neutral";
  const Icon = bara.tip === "anulare" ? Loader2 : bara.tip === "eroare" || ton === "apricot" ? AlertTriangle : bara.tip === "anulat" ? Undo2 : Check;
  const poateAnula = bara.tip === "trimis" || bara.tip === "blocat";

  return (
    <section
      ref={ref}
      aria-label="Ultima trimitere pe WhatsApp"
      onMouseEnter={() => setPauza(true)}
      onMouseLeave={() => setPauza(false)}
      onFocus={() => setPauza(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setPauza(false);
      }}
      className="pointer-events-none fixed inset-x-3 bottom-[calc(3.5rem+env(safe-area-inset-bottom)+0.5rem)] z-[55] lg:inset-x-auto lg:bottom-5 lg:left-[calc(266px+2rem)] lg:right-8 lg:flex lg:justify-center"
    >
      <div
        className={cn(
          "pointer-events-auto flex w-full flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border px-3.5 py-2.5 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.9)] motion-safe:animate-rise lg:max-w-2xl",
          ton === "mint" && "border-mint/25 bg-[#0F1712] text-[#C4F5D8]",
          ton === "apricot" && "border-apricot/25 bg-[#191310] text-[#FFD0AC]",
          ton === "rose" && "border-rose/25 bg-[#1A1013] text-[#FFC2CE]",
          ton === "neutral" && "border-white/[0.1] bg-[#121216] text-foreground"
        )}
      >
        <Icon className={cn("h-4 w-4 shrink-0", bara.tip === "anulare" && "motion-safe:animate-spin")} aria-hidden="true" />
        <div className="min-w-0 flex-1 basis-36">
          <p className="text-[15px] font-medium leading-snug">{bara.titlu}</p>
          {bara.detaliu ? <p className="text-[13.5px] leading-snug opacity-80">{bara.detaliu}</p> : null}
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          {bara.tip === "blocat" && bara.link ? (
            <a href={bara.link} target="_blank" rel="noreferrer" onClick={onDeschis} className={btnClass({ variant: "primary", size: "sm", className: "h-9" })}>
              <MessageCircle className="h-4 w-4" aria-hidden="true" />
              Deschide WhatsApp
              <span className="sr-only"> către {bara.firma}, cu mesajul gata (filă nouă)</span>
            </a>
          ) : null}
          {poateAnula ? (
            <button type="button" onClick={() => onAnuleaza(bara.firmaId)} className={btnClass({ variant: "outline", size: "sm", className: "h-9 border-white/[0.16]" })}>
              Anulează
              <span className="sr-only"> marcarea pentru {bara.firma}</span>
            </button>
          ) : null}
          {bara.tip !== "anulare" ? (
            <button
              type="button"
              onClick={() => onInchide(true)}
              aria-label="Închide mesajul"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg opacity-70 hover:bg-white/[0.06] hover:opacity-100"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
