import { Pill, type PillTone } from "@/components/panou/ui/primitives";
import { dateTimeRo, num, relativeRo } from "@/components/panou/ui/format";
import type { Nisa } from "@/lib/prospectare/types";
import { cn } from "@/lib/utils";

/**
 * Bucățile tablei de nișe: starea (cu „Expirată” peste status), grupa în care
 * intră, linia robotului și rezultatele. Fără "use client": se folosesc din
 * ecranul client, dar n-au stare.
 */

export type StareNisa = Nisa["status"] | "expirata";

/** „Expirată” bate statusul: rezervată, dar fără semn de viață de 24 h. */
export const stareNisa = (n: Pick<Nisa, "status" | "expirata">): StareNisa => (n.expirata ? "expirata" : n.status);

/** O nișă e a unui robot (o poate pierde la „Eliberează”) cât e rezervată sau în cercetare, chiar expirată. */
export const ocupata = (n: Pick<Nisa, "status">): boolean => n.status === "rezervata" || n.status === "in_cercetare";

const STARI: Record<StareNisa, { label: string; tone: PillTone; title: string; dot?: boolean }> = {
  in_cercetare: { label: "În cercetare", tone: "sky", title: "Robotul a raportat progres în ultimele 24 de ore", dot: true },
  rezervata: { label: "Rezervată", tone: "lav", title: "Un robot a luat-o, încă n-a raportat progres" },
  expirata: { label: "Expirată", tone: "apricot", title: "Rezervată, dar fără semn de viață de 24 de ore: alt robot o poate prelua" },
  libera: { label: "Liberă", tone: "neutral", title: "O poate rezerva orice robot" },
  terminata: { label: "Terminată", tone: "mint", title: "Cercetată până la capăt: nu se mai rezervă" },
};

export function NisaPill({ nisa, className }: { nisa: Pick<Nisa, "status" | "expirata">; className?: string }) {
  const meta = STARI[stareNisa(nisa)];
  return (
    <span title={meta.title} className={cn("shrink-0", className)}>
      <Pill tone={meta.tone} dot={meta.dot}>
        {meta.label}
      </Pill>
    </span>
  );
}

export type GrupaNisa = "in_lucru" | "libere" | "terminate";

export const GRUPE: { id: GrupaNisa; titlu: string; gol: string }[] = [
  { id: "in_lucru", titlu: "În lucru", gol: "Niciun robot nu cercetează acum o nișă." },
  { id: "libere", titlu: "Libere și expirate", gol: "Nicio nișă liberă: roboții își adaugă singuri altele când o cer." },
  { id: "terminate", titlu: "Terminate", gol: "Nicio nișă terminată încă." },
];

export function grupaNisa(n: Pick<Nisa, "status" | "expirata">): GrupaNisa {
  if (n.status === "terminata") return "terminate";
  if (n.status === "libera" || n.expirata) return "libere";
  return "in_lucru";
}

function Cand({ la, acum, prefix }: { la: string; acum: number; prefix: string }) {
  return (
    <time dateTime={la} title={dateTimeRo(la)}>
      {prefix} {relativeRo(la, acum)}
    </time>
  );
}

/** Cine are nișa și de când: robotul, rezervarea și ultimul semn de viață (pe expirate, cu apricot). */
export function NisaRobot({ n, acum }: { n: Nisa; acum: number }) {
  const nume = n.dispozitiv ?? (n.dispozitiv_id ? "robot șters" : null);
  // Mai multe sesiuni pe același robot (migrarea 38): „PC Ștefan · sesiunea 2”.
  const robot = nume && n.sesiune ? `${nume} · sesiunea ${n.sesiune}` : nume;
  const semn = n.semn_la ?? n.rezervata_la;

  if (n.status === "libera") {
    return (
      <span className="block text-[11.5px] text-muted-foreground">
        <span className="block text-[12px] text-foreground/80">Nerezervată</span>
        <Cand la={n.creat_la} acum={acum} prefix="adăugată" />
        {n.creat_de ? `, de ${n.creat_de}` : null}
      </span>
    );
  }

  if (n.status === "terminata") {
    return (
      <span className="block text-[11.5px] text-muted-foreground">
        <span className="block truncate text-[12px] font-medium text-foreground">{robot ?? "—"}</span>
        {n.terminata_la ? <Cand la={n.terminata_la} acum={acum} prefix="terminată" /> : "terminată"}
      </span>
    );
  }

  return (
    <span className="block text-[11.5px] text-muted-foreground">
      <span className="block truncate text-[12px] font-medium text-foreground">{robot ?? "robot necunoscut"}</span>
      {n.rezervata_la ? <Cand la={n.rezervata_la} acum={acum} prefix="rezervată" /> : "rezervată"}
      {" · "}
      {semn ? (
        <span className={n.expirata ? "text-[#FFC79C]" : undefined}>
          <Cand la={semn} acum={acum} prefix="ultimul semn" />
        </span>
      ) : (
        "fără semn de viață"
      )}
    </span>
  );
}

/**
 * Găsite, apoi eligibile vs respinse: bara are ca bază firmele găsite, deci
 * partea goală e ce n-a fost încă evaluat. Cifrele sunt în text; bara e doar vizuală.
 */
export function NisaRezultate({ n, className }: { n: Pick<Nisa, "gasite" | "eligibile" | "respinse">; className?: string }) {
  const evaluate = n.eligibile + n.respinse;
  const baza = Math.max(n.gasite, evaluate);
  const neevaluate = Math.max(n.gasite - evaluate, 0);
  return (
    <div className={cn("min-w-0 text-[11.5px]", className)}>
      <p className="text-[12px] text-foreground/80">
        <span className="pu-num font-medium text-foreground">{num(n.gasite)}</span> găsite
        {neevaluate > 0 ? <span className="text-muted-foreground"> · {num(neevaluate)} neevaluate</span> : null}
      </p>
      {baza > 0 ? (
        <div className="mt-1.5 flex h-1.5 w-full max-w-[180px] overflow-hidden rounded-full bg-white/[0.08]" aria-hidden="true">
          <span className="h-full bg-mint" style={{ width: `${(n.eligibile / baza) * 100}%` }} />
          <span className="h-full bg-rose/80" style={{ width: `${(n.respinse / baza) * 100}%` }} />
        </div>
      ) : null}
      <p className="pu-num mt-1">
        {evaluate === 0 ? (
          <span className="text-muted-foreground">nimic evaluat încă</span>
        ) : (
          <>
            <span className="text-[#A7EFC3]">{num(n.eligibile)} eligibile</span>
            <span className="text-muted-foreground"> · </span>
            <span className="text-[#FFB0C0]">{num(n.respinse)} respinse</span>
          </>
        )}
      </p>
    </div>
  );
}
