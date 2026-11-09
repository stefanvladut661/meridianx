import Link from "next/link";
import { Mail } from "lucide-react";
import { dayMonthRo, num, timeRo } from "@/components/panou/ui/format";
import { EmptyState } from "@/components/panou/ui/states";
import { StageBadge } from "@/components/panou/prospectare/stage-badge";
import { linkFirma } from "@/components/panou/prospectare/prezentare-comun";
import type { CasutaPeZile } from "@/lib/prospectare/citire";
import type { EmailTrimis } from "@/lib/prospectare/types";
import { cn } from "@/lib/utils";

/** Filtrul pe căsuță: linkuri simple (merge fără JavaScript), cu numărul de emailuri al fiecăreia. */
export function FiltruCasute({ casute, total, aleasa }: { casute: CasutaPeZile[]; total: number; aleasa?: string }) {
  const chip = "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[13px] transition-colors";
  const optiuni = [{ adresa: undefined as string | undefined, label: "Toate căsuțele", n: total }, ...casute.map((c) => ({ adresa: c.adresa, label: c.adresa, n: c.total }))];
  return (
    <nav aria-label="Filtrează după căsuță" className="flex flex-wrap gap-1.5">
      {optiuni.map((o) => {
        const activ = o.adresa === aleasa;
        return (
          <Link
            key={o.label}
            href={o.adresa ? `/admin/prospectare/email?casuta=${encodeURIComponent(o.adresa)}#trimise` : "/admin/prospectare/email#trimise"}
            aria-current={activ ? "page" : undefined}
            className={cn(chip, activ ? "border-foreground/30 bg-white/[0.08] text-foreground" : "border-border text-muted-foreground hover:text-foreground")}
          >
            <span className="break-all">{o.label}</span>
            <span className="pu-num font-medium text-foreground/85">{num(o.n)}</span>
          </Link>
        );
      })}
    </nav>
  );
}

/** Lista emailurilor trimise: data și ora, firma (spre fișă), căsuța de pe care a plecat, etapa de acum a firmei. */
export function EmailTrimise({ emailuri, aleasa }: { emailuri: EmailTrimis[]; aleasa?: string }) {
  if (emailuri.length === 0) {
    return (
      <EmptyState
        icon={Mail}
        title={aleasa ? "Nicio trimitere de pe căsuța asta" : "Niciun email trimis încă"}
        text={aleasa ? "Alege altă căsuță." : undefined}
      />
    );
  }
  return (
    <ul className="divide-y divide-border">
      {emailuri.map((e) => (
        <li key={e.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5">
          <time dateTime={e.la} className="pu-num w-[92px] shrink-0 text-[13.5px] text-muted-foreground">
            {dayMonthRo(e.la)}, {timeRo(e.la)}
          </time>
          <div className="min-w-0 flex-1 basis-48">
            <Link href={linkFirma(e.firma.id)} className="block truncate rounded-sm text-[14px] font-medium underline-offset-2 hover:underline">
              <span className="pu-num text-muted-foreground">#{e.firma.nr}</span> {e.firma.nume}
            </Link>
            <p className="break-all text-[12.5px] text-muted-foreground">{e.casuta ?? "căsuță necunoscută"}</p>
          </div>
          <StageBadge etapa={e.firma.etapa} className="px-2 py-0 text-[12px]" />
        </li>
      ))}
    </ul>
  );
}
