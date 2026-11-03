"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LayoutGrid } from "lucide-react";
import { nisaAdmin } from "@/app/(admin)/admin/prospectare/actions";
import { ConfirmDialog, InlineNote } from "@/components/panou/ui/actions";
import { num, relativeRo } from "@/components/panou/ui/format";
import { Btn, Card } from "@/components/panou/ui/primitives";
import { EmptyState } from "@/components/panou/ui/states";
import { useToast } from "@/components/panou/ui/toast";
import type { Nisa } from "@/lib/prospectare/types";
import { cn } from "@/lib/utils";
import { NiseAdauga } from "./nise-adauga";
import { NiseRezumat, type RezumatNise } from "./nise-rezumat";
import { GRUPE, grupaNisa, NisaPill, NisaRezultate, NisaRobot, ocupata, type GrupaNisa } from "./nise-stare";
import { PageHead } from "./page-head";
import { EroareCitire } from "./prezentare-eroare";

/**
 * Ecranul Nișe: tabla comună pe care roboții își împart cercetarea (nișă +
 * zonă). Sus rezumatul, apoi „Adaugă nișă”, apoi tabla pe grupe: în lucru,
 * libere și expirate, terminate. „Eliberează” ia nișa robotului care o are
 * (cu confirmare); nimic nu se șterge. Carduri sub 1280 px, tabel de acolo în sus.
 */

/** Terminatele pot ajunge sute: se arată primele, restul la cerere. */
const TERMINATE_VIZIBILE = 30;

function Nume({ n }: { n: Nisa }) {
  return (
    <span className="min-w-0">
      <span className="font-medium text-foreground">{n.nisa}</span>
      <span className="text-muted-foreground"> · {n.zona}</span>
    </span>
  );
}

function Nota({ text, className }: { text: string | null; className?: string }) {
  if (!text) return null;
  return (
    <p className={cn("line-clamp-3 whitespace-pre-line text-[11.5px] leading-relaxed text-foreground/75", className)} title={text}>
      {text}
    </p>
  );
}

export function NiseEcran({ nise, eroare, rezumat, acum }: { nise: Nisa[]; eroare: string | null; rezumat: RezumatNise | null; acum: number }) {
  const router = useRouter();
  const { notify } = useToast();
  const nisaRef = useRef<HTMLInputElement>(null);
  const [deEliberat, setDeEliberat] = useState<Nisa | null>(null);
  const [toateTerminate, setToateTerminate] = useState(false);

  const grupe: Record<GrupaNisa, Nisa[]> = { in_lucru: [], libere: [], terminate: [] };
  for (const n of nise) grupe[grupaNisa(n)].push(n);
  // Între libere, expiratele întâi: au încă un robot trecut pe ele și pot cere „Eliberează”.
  grupe.libere.sort((a, b) => Number(b.expirata) - Number(a.expirata));
  const ascunse = toateTerminate ? 0 : Math.max(grupe.terminate.length - TERMINATE_VIZIBILE, 0);
  const vizibile = (g: GrupaNisa) => (g === "terminate" && ascunse > 0 ? grupe.terminate.slice(0, TERMINATE_VIZIBILE) : grupe[g]);

  const inLucru = grupe.in_lucru.length;

  const buton = (n: Nisa, className?: string) =>
    ocupata(n) ? (
      <Btn size="xs" variant="outline" className={className} onClick={() => setDeEliberat(n)} aria-label={`Eliberează ${n.nisa} · ${n.zona}`}>
        Eliberează
      </Btn>
    ) : null;

  const maiMulte =
    ascunse > 0 ? (
      <div className="px-4 py-3 text-center">
        <Btn size="xs" variant="ghost" onClick={() => setToateTerminate(true)}>
          Arată încă {num(ascunse)} {ascunse === 1 ? "terminată" : "terminate"}
        </Btn>
      </div>
    ) : null;

  const robotDeEliberat = deEliberat?.dispozitiv ? `robotul „${deEliberat.dispozitiv}”` : "robotul care o are";
  const semnDeEliberat = deEliberat ? (deEliberat.semn_la ?? deEliberat.rezervata_la) : null;

  return (
    <div className="space-y-4">
      <PageHead
        title="Nișe"
        pill={eroare ? undefined : `${num(inLucru)} în lucru`}
        pillTone="lav"
      />

      <NiseRezumat rezumat={rezumat} nise={nise} />

      <Card>
        <NiseAdauga nisaRef={nisaRef} />
      </Card>

      <Card padded={false} className="overflow-hidden">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border px-4 py-3.5 sm:px-5">
          <h2 className="text-[15px] font-semibold tracking-[-0.01em]">Tabla de nișe</h2>
          {!eroare && nise.length > 0 ? <p className="pu-num text-[12px] text-muted-foreground">{num(nise.length)} pe tablă</p> : null}
        </div>

        {eroare ? (
          <EroareCitire title="Nișele nu s-au putut citi" message={eroare} />
        ) : nise.length === 0 ? (
          <EmptyState
            icon={LayoutGrid}
            title="Nicio nișă pe tablă"
            text={
              <>
                Roboții își rezervă singuri nișele, prin <code className="font-mono text-[12px] text-foreground">POST /api/prospectare/robot/nisa</code> (acțiunea „rezerva”). Poți
                pune și tu una pe tablă, liberă, din „Adaugă nișă”.
              </>
            }
            action={
              <Btn size="sm" variant="primary" onClick={() => nisaRef.current?.focus()}>
                Adaugă prima nișă
              </Btn>
            }
          />
        ) : (
          <>
            {/* Carduri: telefon, tabletă, laptop mic. */}
            <div className="xl:hidden">
              {GRUPE.map((g) => (
                <section key={g.id} aria-labelledby={`nise-c-${g.id}`} className="border-b border-border last:border-0">
                  <h3 id={`nise-c-${g.id}`} className="flex items-baseline gap-2 px-4 pb-2 pt-4 text-[11px] font-medium uppercase tracking-[0.14em] text-foreground/75 sm:px-5">
                    {g.titlu} <span className="pu-num text-muted-foreground">{num(grupe[g.id].length)}</span>
                  </h3>
                  {grupe[g.id].length === 0 ? (
                    <p className="px-4 pb-4 text-[12px] text-muted-foreground sm:px-5">{g.gol}</p>
                  ) : (
                    <ul className="grid gap-2.5 px-3 pb-4 sm:px-4 md:grid-cols-2">
                      {vizibile(g.id).map((n) => (
                        <li key={n.id} className={cn("flex flex-col gap-2.5 rounded-2xl border bg-white/[0.02] p-3.5", n.expirata ? "border-apricot/25" : "border-white/[0.07]")}>
                          <div className="flex items-start justify-between gap-2 text-[13px]">
                            <Nume n={n} />
                            <NisaPill nisa={n} />
                          </div>
                          <NisaRobot n={n} acum={acum} />
                          <NisaRezultate n={n} />
                          <Nota text={n.nota} />
                          {buton(n, "self-start")}
                        </li>
                      ))}
                    </ul>
                  )}
                  {g.id === "terminate" ? maiMulte : null}
                </section>
              ))}
            </div>

            {/* Tabel: de la 1280 px. */}
            <div className="hidden overflow-x-auto xl:block">
              <table className="w-full border-collapse text-left">
                <caption className="sr-only">Tabla de nișe, pe grupe: în lucru, libere și expirate, terminate</caption>
                <thead>
                  <tr className="border-b border-border text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                    <th scope="col" className="py-2.5 pl-5 pr-3 font-medium">
                      Nișă · zonă
                    </th>
                    <th scope="col" className="py-2.5 pr-3 font-medium">
                      Stare
                    </th>
                    <th scope="col" className="py-2.5 pr-3 font-medium">
                      Robot și semn de viață
                    </th>
                    <th scope="col" className="py-2.5 pr-3 font-medium">
                      Rezultate
                    </th>
                    <th scope="col" className="py-2.5 pr-5 text-right font-medium">
                      <span className="sr-only">Acțiune</span>
                    </th>
                  </tr>
                </thead>
                {GRUPE.map((g) => (
                  <tbody key={g.id} className="border-b border-border last:border-0">
                    <tr>
                      <th scope="rowgroup" colSpan={5} className="bg-white/[0.025] py-2 pl-5 pr-3 text-[11px] font-medium uppercase tracking-[0.14em] text-foreground/75">
                        {g.titlu} <span className="pu-num ml-1 text-muted-foreground">{num(grupe[g.id].length)}</span>
                      </th>
                    </tr>
                    {grupe[g.id].length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-3 pl-5 pr-3 text-[12px] text-muted-foreground">
                          {g.gol}
                        </td>
                      </tr>
                    ) : (
                      vizibile(g.id).map((n) => (
                        <tr key={n.id} className="border-t border-border/70 align-top">
                          <td className="max-w-[320px] py-3 pl-5 pr-3 text-[13px]">
                            <Nume n={n} />
                            <Nota text={n.nota} className="mt-1" />
                          </td>
                          <td className="py-3 pr-3">
                            <NisaPill nisa={n} />
                          </td>
                          <td className="max-w-[260px] py-3 pr-3">
                            <NisaRobot n={n} acum={acum} />
                          </td>
                          <td className="w-[220px] py-3 pr-3">
                            <NisaRezultate n={n} />
                          </td>
                          <td className="py-3 pr-5 text-right">{buton(n)}</td>
                        </tr>
                      ))
                    )}
                    {g.id === "terminate" && maiMulte ? (
                      <tr>
                        <td colSpan={5} className="p-0">
                          {maiMulte}
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                ))}
              </table>
            </div>
          </>
        )}
      </Card>

      <InlineNote tone="neutral">
        Roboții vorbesc cu tabla prin <code className="font-mono text-[11.5px] text-foreground">POST /api/prospectare/robot/nisa</code>: „rezerva” (nișă + zonă), „progres”
        (semn de viață și cifrele, care nu scad niciodată) și „termina”. O nișă terminată nu se mai rezervă. „Eliberează” nu șterge nimic: nișa redevine liberă, cu cifrele și
        nota de până atunci.
      </InlineNote>

      <ConfirmDialog
        open={deEliberat !== null}
        onOpenChange={(v) => {
          if (!v) setDeEliberat(null);
        }}
        title={deEliberat ? `Eliberezi „${deEliberat.nisa} · ${deEliberat.zona}”?` : "Eliberezi nișa?"}
        description="Nișa redevine liberă pe tablă. Cifrele de până acum și nota rămân; în notă se scrie cine a eliberat-o și când."
        consequence={
          deEliberat
            ? deEliberat.expirata
              ? `Ultimul semn de la ${robotDeEliberat}: ${semnDeEliberat ? relativeRo(semnDeEliberat, acum) : "niciunul"}. După eliberare, orice robot o poate rezerva; dacă ${robotDeEliberat} revine, primește 409 și trebuie să ceară altă nișă.`
              : `${robotDeEliberat.charAt(0).toUpperCase()}${robotDeEliberat.slice(1)} o pierde chiar dacă lucrează acum pe ea: la următorul raport primește 409 și se oprește. Orice alt robot o poate rezerva apoi.`
            : undefined
        }
        confirmLabel="Eliberează"
        tone={deEliberat?.expirata ? "primary" : "danger"}
        onConfirm={async () => {
          if (!deEliberat) return;
          const result = await nisaAdmin({ actiune: "elibereaza", id: deEliberat.id });
          notify(result.message, result.ok ? undefined : "error");
          router.refresh();
        }}
      />
    </div>
  );
}
