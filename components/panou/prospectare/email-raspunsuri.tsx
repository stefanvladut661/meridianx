"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink, Loader2, MoveRight, Reply } from "lucide-react";
import { schimbaEtapa } from "@/app/(admin)/admin/prospectare/actions";
import { relativeRo, dateTimeRo } from "@/components/panou/ui/format";
import { Btn, btnClass } from "@/components/panou/ui/primitives";
import { EmptyState } from "@/components/panou/ui/states";
import { useToast } from "@/components/panou/ui/toast";
import type { RaspunsEmail } from "@/lib/prospectare/types";
import { cn } from "@/lib/utils";
import { linkFirma } from "./prezentare-comun";
import { StageBadge } from "./stage-badge";

/**
 * Răspunsurile la email din ultimele 14 zile, ca în prototip: tipul (Pozitiv,
 * NU, Automat), extrasul, „Deschide în Gmail” și „Mută la Interesați”.
 * Un „NU” mută firma singur la „Nu contacta” (regula e în bază).
 */

const TIPURI: Record<RaspunsEmail["tip"], { label: string; cls: string }> = {
  pozitiv: { label: "Pozitiv", cls: "border-mint/30 bg-mint/10 text-mint" },
  nu: { label: "NU", cls: "border-rose/30 bg-rose/10 text-rose" },
  automat: { label: "Automat", cls: "border-border bg-secondary text-muted-foreground" },
  altul: { label: "De citit", cls: "border-sky/30 bg-sky/10 text-sky" },
};

/** Căutarea în Gmail: mesajele de la domeniul firmei, în contul căsuței care a primit răspunsul. */
function linkGmail(r: RaspunsEmail): string {
  const baza = r.casuta ? `https://mail.google.com/mail/?authuser=${encodeURIComponent(r.casuta)}` : "https://mail.google.com/mail/u/0/";
  return `${baza}#search/${encodeURIComponent(`from:${r.firma.domeniu}`)}`;
}

export function EmailRaspunsuri({ raspunsuri, acum }: { raspunsuri: RaspunsEmail[]; acum: number }) {
  const router = useRouter();
  const { notify } = useToast();
  const [pending, startTransition] = useTransition();
  const [lucru, setLucru] = useState<number | null>(null);

  const muta = (r: RaspunsEmail) => {
    setLucru(r.id);
    startTransition(async () => {
      const result = await schimbaEtapa({
        firmaId: r.firma.id,
        etapa: "interesat",
        motiv: r.tip === "pozitiv" ? "Răspuns pozitiv la email" : "Răspuns la email, citit de om",
      });
      notify(result.ok ? `${r.firma.nume}: ${result.message}` : result.message, result.ok ? undefined : "error");
      router.refresh();
      setLucru(null);
    });
  };

  if (raspunsuri.length === 0) {
    return <EmptyState icon={Reply} title="Niciun răspuns încă" />;
  }

  return (
    <ul className="divide-y divide-border">
      {raspunsuri.map((r) => {
        const meta = TIPURI[r.tip];
        const etapa = r.firma.etapa;
        // Pozitivele (și cele neclasificate, după ce le citește omul) se pot muta la Interesați.
        const poateMuta = (r.tip === "pozitiv" || r.tip === "altul") && etapa !== "client" && etapa !== "nu_contacta";
        const dejaMutata = etapa === "interesat";
        const seMuta = pending && lucru === r.id;
        return (
          <li key={r.id} className="px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Link href={linkFirma(r.firma.id)} className="min-w-0 rounded-sm text-[14px] font-medium underline-offset-2 hover:underline">
                <span className="pu-num text-muted-foreground">#{r.firma.nr}</span> {r.firma.nume}
              </Link>
              <span className={cn("rounded-full border px-2 py-0.5 text-[12px] font-medium", meta.cls)}>{meta.label}</span>
            </div>
            <p className="mt-1 break-words text-[13px] leading-relaxed text-muted-foreground">{r.extras ? `„${r.extras}”` : "Fără extras."}</p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <time dateTime={r.la} title={dateTimeRo(r.la)} className="text-[13px] text-muted-foreground">
                {relativeRo(r.la, acum)}
              </time>
              {r.casuta ? <span className="min-w-0 break-all text-[13px] text-muted-foreground">· {r.casuta}</span> : null}
              <StageBadge etapa={etapa} className="px-2 py-0 text-[12px]" />
              <span className="ml-auto flex flex-wrap items-center gap-1.5">
                <a href={linkGmail(r)} target="_blank" rel="noreferrer" className={btnClass({ variant: "outline", size: "xs" })}>
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                  Deschide în Gmail
                  <span className="sr-only"> (se deschide într-o filă nouă)</span>
                </a>
                {poateMuta ? (
                  <Btn
                    size="xs"
                    variant={dejaMutata ? "outline" : "primary"}
                    icon={seMuta ? Loader2 : MoveRight}
                    disabled={dejaMutata || pending}
                    aria-busy={seMuta}
                    onClick={() => muta(r)}
                  >
                    {dejaMutata ? "La Interesați" : seMuta ? "Se mută…" : "Mută la Interesați"}
                  </Btn>
                ) : null}
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
