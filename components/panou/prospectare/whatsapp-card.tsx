"use client";

import { useTransition } from "react";
import { Check, MessageCircle } from "lucide-react";
import { CopyButton } from "@/components/panou/ui/actions";
import { btnClass, Card } from "@/components/panou/ui/primitives";
import { linkWhatsApp, numarAfisat, numarScurt } from "@/lib/prospectare/contact";
import type { ListaCuFirma } from "@/lib/prospectare/types";
import { cn } from "@/lib/utils";

/** WhatsAppCard din prototip: o firmă, numărul fără 0, mesajul pregătit și „Marchează trimis”. */

/** Copierile mici din prototip (xs), cu 44 px pe telefon. */
const COPIE = "h-11 px-3 text-[13px] sm:h-7 sm:px-2.5 sm:text-[12px]";

export function WhatsAppCard({ linie, mesaj, onTrimis }: { linie: ListaCuFirma; mesaj: string; onTrimis: (linie: ListaCuFirma) => Promise<void> }) {
  const firma = linie.firma;
  const trimis = linie.rezultat === "trimis";
  const [pending, startTransition] = useTransition();
  const meta = [firma.oras, firma.nisa, firma.persoana_contact].filter(Boolean).join(" · ");

  return (
    // Prototipul estompează la 55%; la 80% textul estompat rămâne peste contrastul AA.
    <Card className={cn("p-4 transition-opacity", trimis && "opacity-80")} aria-busy={pending || undefined}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="break-words text-[16px] font-semibold leading-tight sm:text-[15px]">{firma.nume}</h3>
          {meta ? <p className="mt-0.5 text-[12.5px] text-muted-foreground sm:text-[11.5px]">{meta}</p> : null}
        </div>
        <CopyButton value={firma.nume} label="Copiază numele" size="xs" className={COPIE} />
      </div>

      {firma.telefon ? (
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <span className="pu-num mr-auto text-[21px] font-medium leading-none tracking-tight sm:mr-0">{numarAfisat(firma.telefon)}</span>
          <CopyButton value={numarScurt(firma.telefon)} label="Copiază numărul" size="xs" className={COPIE} />
        </div>
      ) : (
        <p className="mt-2.5 text-[12.5px] text-[#FFB0C0]">Firma nu are telefon în fișă.</p>
      )}

      <div className="mt-3 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2.5">
        {mesaj ? (
          <>
            <p className="whitespace-pre-wrap break-words text-[14px] leading-relaxed text-foreground/85 sm:text-[12px]">{mesaj}</p>
            <div className="mt-2">
              <CopyButton value={mesaj} label="Copiază mesajul" size="xs" className={COPIE} />
            </div>
          </>
        ) : (
          <p className="text-[12.5px] text-muted-foreground sm:text-[12px]">Șablonul primului mesaj e gol: scrie-l în Setări, la șabloane.</p>
        )}
      </div>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        {firma.telefon ? (
          <a
            href={linkWhatsApp(firma.telefon, mesaj)}
            target="_blank"
            rel="noreferrer"
            aria-label={`Deschide WhatsApp către ${firma.nume}, cu mesajul pregătit`}
            className={btnClass({ variant: "primary", size: "lg", className: "h-12 w-full gap-2 text-[15px] sm:h-11 sm:w-auto sm:text-sm" })}
          >
            <MessageCircle className="h-4 w-4" aria-hidden="true" />
            Deschide WhatsApp
          </a>
        ) : null}
        <button
          type="button"
          aria-pressed={trimis}
          disabled={trimis || pending}
          onClick={() =>
            startTransition(async () => {
              await onTrimis(linie);
            })
          }
          className={cn(
            "inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl border px-4 text-[14px] font-medium transition-colors disabled:cursor-default sm:h-11 sm:w-auto sm:text-[13px]",
            trimis ? "border-mint/40 bg-mint/10 text-mint" : "border-white/[0.14] text-foreground hover:bg-white/[0.06]",
            pending && "opacity-70"
          )}
        >
          <span
            className={cn("flex h-4 w-4 items-center justify-center rounded border", trimis ? "border-mint bg-mint text-[#0C0C10]" : "border-white/[0.3]")}
            aria-hidden="true"
          >
            {trimis ? <Check className="h-3 w-3" /> : null}
          </span>
          {pending ? "Se marchează…" : trimis ? "Trimis" : "Marchează trimis"}
        </button>
      </div>

      {linie.nota ? <p className="mt-2 break-words text-[12px] italic text-muted-foreground sm:text-[11px]">„{linie.nota}”</p> : null}
    </Card>
  );
}
