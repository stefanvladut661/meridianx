import { Mail } from "lucide-react";
import { num } from "@/components/panou/ui/format";
import type { Casuta, ProgramareCuFirma } from "@/lib/prospectare/types";
import { cn } from "@/lib/utils";

/**
 * „Programate azi și mâine, pe căsuțe”: ce a pus distribuția de la 00:00 (plus programările
 * manuale) pe fiecare căsuță. Azi: programate, trimise (cerute de robot), rămase. Mâine: doar
 * manualele, restul le pune distribuția la 00:00. Limita zilei e cea din bază
 * (`prospectare_limita_casuta`): limita căsuței din Setări, altfel plafonul de încălzire;
 * o căsuță oprită are 0. Tabel de la 768 în sus, carduri sub. Fără stare: merge pe server.
 */

export interface RandProgramate {
  adresa: string;
  domeniu: string;
  activa: boolean;
  /** Limita pusă pe căsuță în Setări; null = ia plafonul de încălzire. */
  proprie: number | null;
  /** Limita zilei; null = plafonul nu s-a putut citi. */
  limita: number | null;
  azi: number;
  trimise: number;
  ramase: number;
  maine: number;
}

export interface TotalProgramate {
  azi: number;
  trimise: number;
  ramase: number;
  maine: number;
  /** Capacitatea zilei (suma limitelor căsuțelor active); null = plafonul nu s-a putut citi. */
  capacitate: number | null;
}

export function randuriProgramate(
  casute: Pick<Casuta, "adresa" | "domeniu" | "activa" | "limita_zi">[],
  programari: Pick<ProgramareCuFirma, "zi" | "casuta" | "stare">[],
  azi: string,
  maine: string,
  plafon: number | null
): { randuri: RandProgramate[]; total: TotalProgramate } {
  const pe = new Map<string, RandProgramate>();
  for (const c of casute) {
    const limita = !c.activa ? 0 : (c.limita_zi ?? plafon);
    pe.set(c.adresa, { adresa: c.adresa, domeniu: c.domeniu, activa: c.activa, proprie: c.limita_zi, limita, azi: 0, trimise: 0, ramase: 0, maine: 0 });
  }
  for (const p of programari) {
    if (!p.casuta) continue;
    // O căsuță scoasă din Setări între timp: rândul ei rămâne, fără limită.
    const r =
      pe.get(p.casuta) ??
      pe.set(p.casuta, { adresa: p.casuta, domeniu: p.casuta.split("@")[1] ?? "", activa: false, proprie: null, limita: 0, azi: 0, trimise: 0, ramase: 0, maine: 0 }).get(p.casuta)!;
    if (p.zi === azi) {
      r.azi += 1;
      if (p.stare === "folosita") r.trimise += 1;
      else if (p.stare === "programata") r.ramase += 1;
    } else if (p.zi === maine && p.stare === "programata") {
      r.maine += 1;
    }
  }
  const randuri = [...pe.values()];
  const total: TotalProgramate = { azi: 0, trimise: 0, ramase: 0, maine: 0, capacitate: 0 };
  for (const r of randuri) {
    total.azi += r.azi;
    total.trimise += r.trimise;
    total.ramase += r.ramase;
    total.maine += r.maine;
    total.capacitate = total.capacitate === null || r.limita === null ? null : total.capacitate + r.limita;
  }
  return { randuri, total };
}

/** Limita zilei, cu sursa ei: „plafon” (fără limită proprie) sau „oprită”. */
function Limita({ r }: { r: RandProgramate }) {
  if (!r.activa) return <span className="text-[11.5px] text-muted-foreground">oprită · 0</span>;
  return (
    <span className="pu-num text-[12.5px]">
      {r.limita === null ? "—" : num(r.limita)}
      {r.proprie === null ? <span className="ml-1 text-[11px] text-muted-foreground">plafon</span> : null}
    </span>
  );
}

/** Bara zilei: trimise (plin) și rămase (pal), din limita căsuței. Cifrele de lângă spun tot; bara e pentru ochi. */
function Bara({ r }: { r: RandProgramate }) {
  const baza = Math.max(r.limita ?? 0, r.azi, 1);
  return (
    <div className="mt-1.5 flex h-1.5 w-full max-w-[140px] overflow-hidden rounded-full bg-white/[0.07]" aria-hidden="true">
      <div className="h-full bg-mint" style={{ width: `${(r.trimise / baza) * 100}%` }} />
      <div className="h-full bg-lav/60" style={{ width: `${(r.ramase / baza) * 100}%` }} />
    </div>
  );
}

const TH = "py-2 pr-3 font-medium";
const TD_NUM = "pu-num py-2.5 pr-3 text-[12.5px]";

export function EmailProgramate({ randuri, total }: { randuri: RandProgramate[]; total: TotalProgramate }) {
  if (randuri.length === 0) {
    return (
      <p className="py-6 text-center text-[12.5px] text-muted-foreground">
        Nicio căsuță conectată, deci nimic programat. O căsuță apare după primul email trimis de pe ea; apoi distribuția îi pune firme la 00:00.
      </p>
    );
  }

  return (
    <>
      <div className="relative hidden overflow-x-auto md:block">
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">Emailuri programate azi și mâine, pe fiecare căsuță</caption>
          <thead>
            <tr className="border-b border-border text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground">
              <th scope="col" className={TH}>
                Căsuță
              </th>
              <th scope="col" className={TH}>
                Limita zilei
              </th>
              <th scope="col" className={TH}>
                Azi programate
              </th>
              <th scope="col" className={TH}>
                Trimise
              </th>
              <th scope="col" className={TH}>
                Rămase
              </th>
              <th scope="col" className="py-2 font-medium">
                Mâine
              </th>
            </tr>
          </thead>
          <tbody>
            {randuri.map((r) => (
              <tr key={r.adresa} className="border-b border-border/70">
                <th scope="row" className="py-2.5 pr-3 text-left font-normal">
                  <p className="break-all text-[12.5px] font-medium">{r.adresa}</p>
                  <p className="text-[11px] text-muted-foreground">{r.domeniu}</p>
                </th>
                <td className="py-2.5 pr-3">
                  <Limita r={r} />
                </td>
                <td className={TD_NUM}>
                  {num(r.azi)}
                  <Bara r={r} />
                </td>
                <td className={cn(TD_NUM, r.trimise > 0 ? "text-mint" : "text-muted-foreground")}>{num(r.trimise)}</td>
                <td className={cn(TD_NUM, r.ramase > 0 ? undefined : "text-muted-foreground")}>{num(r.ramase)}</td>
                <td className={cn("pu-num py-2.5 text-[12.5px]", r.maine > 0 ? undefined : "text-muted-foreground")}>{num(r.maine)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="text-[12.5px]">
              <th scope="row" className="pt-2.5 pr-3 text-left font-medium">
                Total
              </th>
              <td className="pu-num pt-2.5 pr-3 font-medium">{total.capacitate === null ? "—" : num(total.capacitate)}</td>
              <td className="pu-num pt-2.5 pr-3 font-medium">{num(total.azi)}</td>
              <td className="pu-num pt-2.5 pr-3 font-medium">{num(total.trimise)}</td>
              <td className="pu-num pt-2.5 pr-3 font-medium">{num(total.ramase)}</td>
              <td className="pu-num pt-2.5 font-medium">{num(total.maine)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <ul className="space-y-2.5 md:hidden">
        {randuri.map((r) => (
          <li key={r.adresa} className="rounded-xl border border-border p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-[12.5px] font-medium">
                  <Mail className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <span className="min-w-0 break-all">{r.adresa}</span>
                </p>
                <p className="text-[11px] text-muted-foreground">{r.domeniu}</p>
              </div>
              <p className="shrink-0 text-right text-[11px] text-muted-foreground">
                limita <Limita r={r} />
              </p>
            </div>
            <dl className="mt-2.5 grid grid-cols-4 gap-2 text-center">
              {[
                { label: "Azi", n: r.azi },
                { label: "Trimise", n: r.trimise },
                { label: "Rămase", n: r.ramase },
                { label: "Mâine", n: r.maine },
              ].map((c) => (
                <div key={c.label} className="min-w-0 rounded-lg bg-white/[0.03] px-1 py-1.5">
                  <dt className="truncate text-[10.5px] text-muted-foreground">{c.label}</dt>
                  <dd className="pu-num text-[14px] font-medium">{num(c.n)}</dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
        <li className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 rounded-xl border border-border bg-white/[0.03] p-3 text-[12px]">
          <span className="font-medium">Total</span>
          <span className="pu-num text-muted-foreground">
            azi <span className="font-medium text-foreground">{num(total.azi)}</span> din {total.capacitate === null ? "—" : num(total.capacitate)} · trimise{" "}
            <span className="font-medium text-foreground">{num(total.trimise)}</span> · rămase <span className="font-medium text-foreground">{num(total.ramase)}</span> · mâine{" "}
            <span className="font-medium text-foreground">{num(total.maine)}</span>
          </span>
        </li>
      </ul>
    </>
  );
}
