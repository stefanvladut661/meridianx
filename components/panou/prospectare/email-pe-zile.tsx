import Link from "next/link";
import { dayMonthRo, num, weekdayRo } from "@/components/panou/ui/format";
import type { CasutaPeZile } from "@/lib/prospectare/citire";
import { cn } from "@/lib/utils";

/**
 * Câte emailuri a trimis fiecare căsuță: totalul și fiecare zi, de la primul email
 * până azi (cele mai noi zile primele). Prima coloană rămâne pe loc când tabelul
 * se derulează pe orizontală. Adresa duce la lista emailurilor de pe căsuța aceea.
 */
export function EmailPeZile({ zile, casute, total, azi, casutaAleasa }: { zile: string[]; casute: CasutaPeZile[]; total: number; azi: string; casutaAleasa?: string }) {
  if (casute.length === 0 || zile.length === 0) {
    return <p className="py-6 text-center text-[14px] text-muted-foreground">Niciun email trimis încă.</p>;
  }
  const peZiToate = Object.fromEntries(zile.map((z) => [z, casute.reduce((s, c) => s + (c.peZi[z] ?? 0), 0)]));
  const zi = (z: string) => new Date(`${z}T12:00:00Z`);
  const celula = "pu-num whitespace-nowrap px-3 py-2.5 text-right text-[14px]";
  const fix = "sticky left-0 z-[1] bg-card";

  return (
    <div className="relative overflow-x-auto rounded-xl border border-border" role="region" aria-label="Emailuri trimise pe căsuțe și zile" tabIndex={0}>
      <table className="w-full min-w-max border-collapse text-left">
        <caption className="sr-only">Emailuri trimise de fiecare căsuță: total și pe fiecare zi, de la primul email până azi.</caption>
        <thead>
          <tr className="border-b border-border text-[12px] uppercase tracking-[0.12em] text-muted-foreground">
            <th scope="col" className={cn(fix, "py-2 pl-3 pr-4 font-medium")}>
              Căsuță
            </th>
            <th scope="col" className="px-3 py-2 text-right font-medium">
              Total
            </th>
            {zile.map((z) => (
              <th key={z} scope="col" className={cn("whitespace-nowrap px-3 py-2 text-right font-medium normal-case tracking-normal", z === azi && "text-foreground")}>
                <span className="block text-[12px] uppercase tracking-[0.12em]">{z === azi ? "azi" : weekdayRo(zi(z))}</span>
                <span className="pu-num text-[13px]">{dayMonthRo(zi(z))}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {casute.map((c) => (
            <tr key={c.adresa} className={cn("border-b border-border/70", c.adresa === casutaAleasa && "bg-white/[0.03]")}>
              <th scope="row" className={cn(fix, "max-w-[220px] py-2.5 pl-3 pr-4 font-normal")}>
                <Link
                  href={`/admin/prospectare/email?casuta=${encodeURIComponent(c.adresa)}#trimise`}
                  className="block break-all rounded-sm text-[14px] font-medium underline-offset-2 hover:underline"
                  aria-label={`${c.adresa}: vezi emailurile trimise de pe ea`}
                >
                  {c.adresa}
                </Link>
                <span className="text-[12.5px] text-muted-foreground">
                  {c.domeniu}
                  {!c.activa ? " · oprită din admin" : ""}
                </span>
              </th>
              <td className={cn(celula, "font-medium")}>{num(c.total)}</td>
              {zile.map((z) => {
                const n = c.peZi[z] ?? 0;
                return (
                  <td key={z} className={cn(celula, n === 0 && "text-muted-foreground/60")}>
                    {n === 0 ? <><span aria-hidden="true">·</span><span className="sr-only">0</span></> : num(n)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="text-foreground">
            <th scope="row" className={cn(fix, "py-2.5 pl-3 pr-4 text-[14px] font-medium")}>
              Toate căsuțele
            </th>
            <td className={cn(celula, "font-semibold")}>{num(total)}</td>
            {zile.map((z) => (
              <td key={z} className={cn(celula, "font-medium", peZiToate[z] === 0 && "text-muted-foreground/60")}>
                {peZiToate[z] === 0 ? <><span aria-hidden="true">·</span><span className="sr-only">0</span></> : num(peZiToate[z])}
              </td>
            ))}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
