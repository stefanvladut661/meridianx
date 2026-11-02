import { Flame, Mail, TrendingDown } from "lucide-react";
import { num, timeRo } from "@/components/panou/ui/format";
import type { Casuta } from "@/lib/prospectare/types";
import { cn } from "@/lib/utils";

/**
 * Căsuțele de email, ca `MailboxTable` din prototip: tabel de la 768 în sus,
 * carduri sub. Limita zilei e cea folosită la programare: cea pusă pe căsuță
 * în Setări sau, dacă nu e pusă, plafonul de încălzire. Fără stare: merge pe server.
 */

const BARE = { mint: "bg-mint", apricot: "bg-apricot", rose: "bg-rose" } as const;

function raportul(c: Casuta): number {
  if (c.limita_azi === null) return 0;
  if (c.limita_azi === 0) return 1;
  return c.trimise_azi / c.limita_azi;
}

function ton(raport: number): keyof typeof BARE {
  if (raport >= 1) return "rose";
  if (raport >= 0.75) return "apricot";
  return "mint";
}

function Limita({ casuta }: { casuta: Casuta }) {
  const raport = raportul(casuta);
  return (
    <div className="min-w-[120px]">
      <p className="pu-num text-[12.5px] font-medium">
        {num(casuta.trimise_azi)}{" "}
        <span className="text-muted-foreground" title={casuta.limita_azi === null ? "Limita de azi nu e încă stabilită" : !casuta.activa ? "Căsuța e oprită din admin" : casuta.limita_zi !== null ? "Limită pusă pe căsuță, în Setări" : "Plafonul de încălzire din Setări"}>
          / {casuta.limita_azi === null ? "—" : num(casuta.limita_azi)}
        </span>
      </p>
      {/* Cifrele de deasupra spun tot; bara e doar pentru ochi. */}
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.07]" aria-hidden="true">
        <div className={cn("h-full rounded-full transition-[width] duration-500", BARE[ton(raport)])} style={{ width: `${Math.min(100, Math.max(0, raport * 100))}%` }} />
      </div>
    </div>
  );
}

function Oprita() {
  return (
    <span className="mt-1 inline-flex items-center rounded-full border border-rose/25 bg-rose/10 px-2 py-0.5 text-[10.5px] font-medium text-[#FFB0C0]">
      oprită din admin
    </span>
  );
}

export function MailboxTable({ casute, compact = false }: { casute: Casuta[]; compact?: boolean }) {
  if (casute.length === 0) {
    return (
      <p className={cn("text-center text-[12.5px] text-muted-foreground", compact ? "py-4" : "py-6")}>
        Nicio căsuță conectată. O căsuță apare aici după primul email trimis de pe ea.
      </p>
    );
  }

  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-border text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground">
              <th scope="col" className="py-2 pr-3 font-medium">
                Căsuță
              </th>
              <th scope="col" className="py-2 pr-3 font-medium">
                Trimise azi
              </th>
              {/* În cardul îngust de pe Prezentare încap doar coloanele principale; restul sunt pe pagina Email. */}
              {compact ? null : (
                <>
                  <th scope="col" className="py-2 pr-3 font-medium">
                    Limita atinsă
                  </th>
                  <th scope="col" className="py-2 pr-3 font-medium">
                    Bounce
                  </th>
                </>
              )}
              <th scope="col" className="py-2 pr-3 font-medium">
                Răspunsuri
              </th>
              <th scope="col" className="py-2 font-medium">
                Încălzire
              </th>
            </tr>
          </thead>
          <tbody>
            {casute.map((c) => (
              <tr key={c.adresa} className="border-b border-border/70 last:border-0">
                <td className="py-2.5 pr-3">
                  <p className="break-all text-[12.5px] font-medium">{c.adresa}</p>
                  <p className="text-[11px] text-muted-foreground">{c.domeniu}</p>
                  {!c.activa ? <Oprita /> : null}
                </td>
                <td className="py-2.5 pr-3">
                  <Limita casuta={c} />
                </td>
                {compact ? null : (
                  <>
                    <td className="pu-num py-2.5 pr-3 text-[12px] text-muted-foreground">{c.limita_atinsa_la ? timeRo(c.limita_atinsa_la) : "—"}</td>
                    <td className={cn("pu-num py-2.5 pr-3 text-[12px]", c.bounce_azi > 0 ? "text-apricot" : "text-muted-foreground")}>{num(c.bounce_azi)}</td>
                  </>
                )}
                <td className="pu-num py-2.5 pr-3 text-[12px]">{num(c.raspunsuri_azi)}</td>
                <td className="py-2.5">
                  {c.incalzire_activa ? (
                    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-mint/25 bg-mint/10 px-2 py-0.5 text-[11px] text-mint">
                      <Flame className="h-3 w-3" aria-hidden="true" /> activă
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 whitespace-nowrap text-[11.5px] text-muted-foreground">
                      <TrendingDown className="h-3 w-3" aria-hidden="true" /> oprită
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="space-y-2.5 md:hidden">
        {casute.map((c) => (
          <li key={c.adresa} className="rounded-xl border border-border p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-[12.5px] font-medium">
                  <Mail className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <span className="min-w-0 break-all">{c.adresa}</span>
                </p>
                <p className="text-[11px] text-muted-foreground">{c.domeniu}</p>
                {!c.activa ? <Oprita /> : null}
              </div>
              {c.incalzire_activa ? <span className="shrink-0 rounded-full border border-mint/25 bg-mint/10 px-2 py-0.5 text-[10.5px] text-mint">încălzire</span> : null}
            </div>
            <div className="mt-2.5">
              <Limita casuta={c} />
            </div>
            <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
              <span>limită atinsă: {c.limita_atinsa_la ? timeRo(c.limita_atinsa_la) : "—"}</span>
              <span className={c.bounce_azi > 0 ? "text-apricot" : undefined}>bounce: {num(c.bounce_azi)}</span>
              <span>răspunsuri: {num(c.raspunsuri_azi)}</span>
            </p>
          </li>
        ))}
      </ul>
    </>
  );
}
