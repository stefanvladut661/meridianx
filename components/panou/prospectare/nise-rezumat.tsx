import { num } from "@/components/panou/ui/format";
import { Card, Stat } from "@/components/panou/ui/primitives";
import type { Nisa } from "@/lib/prospectare/types";

/** Ce trebuie din `citesteRezumat()` pentru tabla de nișe. */
export interface RezumatNise {
  nise: { libere: number; rezervate: number; terminate: number };
  evaluate: { eligibile: number; respinse: number };
  coada_constructie: number;
}

/**
 * Rezumatul de sus: nișele pe stări (din rezumatul bazei, unde „libere” include
 * expiratele), firmele evaluate de roboți și coada de construcție. Dacă rezumatul
 * n-a venit, nișele se numără din tablă, iar restul arată „—”.
 */
export function NiseRezumat({ rezumat, nise }: { rezumat: RezumatNise | null; nise: Nisa[] }) {
  const expirate = nise.filter((n) => n.expirata).length;
  const pe = rezumat?.nise ?? {
    rezervate: nise.filter((n) => (n.status === "rezervata" || n.status === "in_cercetare") && !n.expirata).length,
    libere: nise.filter((n) => n.status === "libera" || n.expirata).length,
    terminate: nise.filter((n) => n.status === "terminata").length,
  };
  const eligibile = rezumat?.evaluate.eligibile ?? 0;
  const respinse = rezumat?.evaluate.respinse ?? 0;
  const evaluate = eligibile + respinse;

  return (
    <Card>
      <h2 className="sr-only">Rezumat</h2>
      <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 xl:grid-cols-5">
        <Stat label="În lucru" value={num(pe.rezervate)} />
        <Stat
          label="Libere"
          value={num(pe.libere)}
          hint={expirate > 0 ? <span className="text-[#FFC79C]">din care {num(expirate)} expirate</span> : undefined}
        />
        <Stat label="Terminate" value={num(pe.terminate)} tone="dim" />
        <Stat
          label="Firme evaluate"
          value={rezumat ? num(evaluate) : "—"}
          hint={
            !rezumat ? (
              "nu s-a citit"
            ) : evaluate === 0 ? (
              "niciuna încă"
            ) : (
              <>
                <span className="mt-0.5 flex h-1.5 w-full max-w-[160px] overflow-hidden rounded-full bg-white/[0.08]" aria-hidden="true">
                  <span className="h-full bg-mint" style={{ width: `${(eligibile / evaluate) * 100}%` }} />
                  <span className="h-full bg-rose/80" style={{ width: `${(respinse / evaluate) * 100}%` }} />
                </span>
                <span className="pu-num mt-1.5 block">
                  <span className="text-[#A7EFC3]">{num(eligibile)} eligibile</span> · <span className="text-[#FFB0C0]">{num(respinse)} respinse</span>
                </span>
              </>
            )
          }
        />
        <Stat
          label="Coada de construcție"
          value={rezumat ? num(rezumat.coada_constructie) : "—"}
          hint={rezumat ? undefined : "nu s-a citit"}
          className="col-span-2 sm:col-span-1"
        />
      </div>
    </Card>
  );
}
