import { num } from "@/components/panou/ui/format";
import type { Dispozitiv, SesiuneRobot } from "@/lib/prospectare/types";
import { cn } from "@/lib/utils";

/**
 * Bucăți comune ecranelor Prospectare (Prezentare, Email, Roboți, Setări).
 * Fără "use client": se folosesc și din paginile de server, și din componentele client.
 */

/** Fișa unei firme: tabelul Firme o deschide din `?firma=<id>`. */
export const linkFirma = (id: string): string => `/admin/prospectare/firme?firma=${encodeURIComponent(id)}`;

/** „1 căsuță”, „5 căsuțe”, „20 de căsuțe”: pluralul românesc, cu numărul formatat. */
export function cate(n: number, unu: string, multe: string): string {
  const rest = n % 100;
  const cuDe = rest >= 20 || (rest === 0 && n !== 0);
  return `${num(n)} ${n === 1 ? unu : cuDe ? `de ${multe}` : multe}`;
}

/**
 * Fără niciun semn în ultima jumătate de oră, robotul (sau terminalul) e „Oprit”. Un terminal care construiește dă semn
 * cel puțin o dată la 25 de minute (heartbeat), deci jumătatea de oră nu-l prinde din greșeală.
 */
export const SEMN_MS = 30 * 60 * 1000;

/** Stările pe înțelesul nostru: lucrează acum (verde), pornit dar nu lucrează (galben), oprit (gri). */
export type StareRobot = "lucreaza" | "pornit" | "oprit";

const recent = (t: string | null | undefined, acum: number): boolean => Boolean(t) && acum - Date.parse(t as string) <= SEMN_MS;

/**
 * Un terminal lucrează dacă a dat semn în ultima jumătate de oră și: are o firmă în construcție (rezervare), sau cercetează /
 * trimite (sarcină raportată în ultima jumătate de oră). Construcția fără firmă (ex. doar a cerut lista, între două firme)
 * înseamnă pornit, nu lucru.
 */
export function stareSesiune(s: Pick<SesiuneRobot, "ultima_activitate" | "ce_face" | "ce_face_la" | "firma_curenta">, acum: number): StareRobot {
  if (!recent(s.ultima_activitate, acum)) return "oprit";
  if (s.firma_curenta) return "lucreaza";
  if ((s.ce_face === "cercetare" || s.ce_face === "trimitere") && recent(s.ce_face_la, acum)) return "lucreaza";
  return "pornit";
}

/** Calculatorul: lucrează dacă lucrează măcar un terminal; pornit dacă a dat semn; altfel oprit (și arhivat / fără token valid). */
export function stareRobot(
  d: Pick<Dispozitiv, "activ" | "arhivat_la" | "ultima_activitate" | "ce_face" | "ce_face_la" | "firma_curenta" | "sesiuni">,
  acum: number
): StareRobot {
  if (!d.activ || d.arhivat_la) return "oprit";
  if (d.sesiuni.length === 0) {
    return stareSesiune({ ultima_activitate: d.ultima_activitate ?? "", ce_face: d.ce_face, ce_face_la: d.ce_face_la, firma_curenta: d.firma_curenta }, acum);
  }
  const stari = d.sesiuni.map((s) => stareSesiune(s, acum));
  if (stari.includes("lucreaza")) return "lucreaza";
  return stari.includes("pornit") || recent(d.ultima_activitate, acum) ? "pornit" : "oprit";
}

const STARI: Record<StareRobot, { label: string; title: string; punct: string; text: string }> = {
  lucreaza: {
    label: "Lucrează acum",
    title: "Un terminal construiește o firmă, cercetează sau trimite, iar robotul a dat semn în ultima jumătate de oră",
    punct: "animate-dotpulse bg-mint",
    text: "text-[#A7EFC3]",
  },
  pornit: {
    label: "Pornit, dar nu lucrează",
    title: "A dat semn în ultima jumătate de oră, dar niciun terminal nu are o sarcină",
    punct: "bg-[#F2C94C]",
    text: "text-[#F5DC8E]",
  },
  oprit: { label: "Oprit", title: "Niciun semn de o jumătate de oră", punct: "bg-white/25", text: "text-muted-foreground" },
};

/** Starea robotului sau a unui terminal: punct colorat + eticheta. */
export function RobotStare({ stare, className }: { stare: StareRobot; className?: string }) {
  const meta = STARI[stare];
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap text-[13px]", meta.text, className)} title={meta.title}>
      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", meta.punct)} aria-hidden="true" />
      {meta.label}
    </span>
  );
}

/** Numele afișat al robotului: calculatorul („PC Ștefan”), altfel numele tehnic. */
export const numeCalculator = (d: Pick<Dispozitiv, "nume" | "calculator">): string => d.calculator?.trim() || d.nume;
