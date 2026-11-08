"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { anuleazaProgramari } from "@/app/(admin)/admin/prospectare/actions";
import { ConfirmDialog } from "@/components/panou/ui/actions";
import { btnClass } from "@/components/panou/ui/primitives";
import { dayMonthRo, num, weekdayRo } from "@/components/panou/ui/format";
import { useToast } from "@/components/panou/ui/toast";
import { UTILIZATORI } from "@/lib/prospectare/labels";
import type { CanalProgramare, ContWhatsapp, ProgramareCuFirma } from "@/lib/prospectare/types";

/**
 * Programările de mâine încolo ale unui canal, pe zile, cu anulare (doar până în ziua lor).
 * Manualele au eticheta „manual”; cele mutate de limita zilei arată ziua cerută.
 */
export function ProgramariViitoare({
  canal,
  programari,
  conturi = [],
  gol = "Nimic programat de mâine încolo. Cu „Programează” alegi firme și ziua; altfel, la 00:00 se programează singure, de la cele mai vechi site-uri.",
}: {
  canal: CanalProgramare;
  programari: ProgramareCuFirma[];
  conturi?: ContWhatsapp[];
  gol?: string;
}) {
  const router = useRouter();
  const { notify } = useToast();
  const [alese, setAlese] = useState<Set<number>>(new Set());
  const [confirm, setConfirm] = useState(false);
  const [, startAnulare] = useTransition();

  if (programari.length === 0) {
    return <p className="py-3 text-[14px] text-muted-foreground">{gol}</p>;
  }

  const peZile = new Map<string, ProgramareCuFirma[]>();
  for (const p of programari) (peZile.get(p.zi) ?? peZile.set(p.zi, []).get(p.zi)!).push(p);
  const numeCont = (id: number | null) => conturi.find((c) => c.id === id)?.nume ?? (id ? `Cont ${id}` : "—");
  const cheie = (p: ProgramareCuFirma) => (canal === "email" ? p.casuta : canal === "whatsapp" ? numeCont(p.cont_whatsapp) : p.utilizator ? UTILIZATORI[p.utilizator] : "—");
  const comuta = (id: number) =>
    setAlese((v) => {
      const n = new Set(v);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const anuleaza = () =>
    new Promise<void>((resolve) =>
      startAnulare(async () => {
        const r = await anuleazaProgramari([...alese]).catch(() => ({ ok: false as const, message: "Conexiunea a căzut: nimic anulat. Încearcă din nou." }));
        notify(r.message, r.ok ? undefined : "error");
        if (r.ok) {
          setAlese(new Set());
          router.refresh();
        }
        resolve();
      })
    );

  return (
    <div className="space-y-3">
      {[...peZile].map(([zi, lista]) => (
        <section key={zi} aria-label={`Programate pe ${dayMonthRo(`${zi}T12:00:00Z`)}`}>
          <h4 className="mb-1.5 flex items-baseline gap-2 text-[13.5px] text-muted-foreground">
            <span className="font-medium text-foreground/90">
              {weekdayRo(`${zi}T12:00:00Z`)}, {dayMonthRo(`${zi}T12:00:00Z`)}
            </span>
            <span className="pu-num">{num(lista.length)}</span>
          </h4>
          <ul className="divide-y divide-border rounded-xl border border-border">
            {lista.map((p) => (
              <li key={p.id}>
                <label className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-white/[0.03]">
                  <input type="checkbox" className="h-4 w-4 shrink-0 accent-[#C6B5FF]" checked={alese.has(p.id)} onChange={() => comuta(p.id)} aria-label={`Alege #${p.firma.nr} ${p.firma.nume}`} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-medium">
                      <span className="pu-num text-muted-foreground">#{p.firma.nr}</span> {p.firma.nume}
                    </span>
                    <span className="block truncate text-[12.5px] text-muted-foreground">
                      {[cheie(p), p.sursa === "manual" ? `manual, ${p.creat_de}` : "automat", p.zi_ceruta ? `cerută pe ${dayMonthRo(`${p.zi_ceruta}T12:00:00Z`)}` : null]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[13px] text-muted-foreground">Bifează ce vrei să anulezi: firmele se întorc în rezervă.</p>
        <button type="button" className={btnClass({ variant: "danger", size: "sm" })} disabled={alese.size === 0} onClick={() => setConfirm(true)}>
          Anulează {alese.size > 0 ? num(alese.size) : ""}
        </button>
      </div>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={`Anulezi ${num(alese.size)} ${alese.size === 1 ? "programare" : "programări"}?`}
        consequence="Firmele se întorc în rezervă: la 00:00 pot fi programate din nou, automat, pe orice canal."
        confirmLabel="Anulează programările"
        onConfirm={anuleaza}
      />
    </div>
  );
}
