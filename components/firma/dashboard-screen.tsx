import Link from "next/link";
import type { Panou, SumaPeMoneda } from "@/lib/firma/panou";
import { dayLabel, money, monthLabel } from "@/lib/firma/format";
import { cn } from "@/lib/utils";
import { Info } from "@/components/panou/ui/info";
import { Empty, Tag, tdClass, thClass } from "./ui";

/** Sumele pe monede: „1.200,00 lei + 300,00 €”, sau `null` → „—” (fără date nu e 0). */
function sums(value: SumaPeMoneda | null): string {
  if (!value) return "—";
  return Object.entries(value)
    .map(([currency, amount]) => money(amount, currency))
    .join(" + ");
}

function Tile({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "error" | "ok" }) {
  return (
    <li className="rounded-xl border border-hair bg-char px-4 py-3">
      <p className="text-[14px] font-medium text-dim">{label}</p>
      <p className={cn("mt-1 text-[1.375rem] font-semibold tabular-nums", tone === "error" && value !== "—" ? "text-[var(--ap-error)]" : "text-bone")}>{value}</p>
      {hint ? <p className="mt-0.5 text-[13.5px] text-dim">{hint}</p> : null}
    </li>
  );
}

export function DashboardScreen({ data, lastDigest }: { data: Panou; lastDigest: { zi: string; alerte: number; trimis: boolean; catre: string | null; mesaj: string | null } | null }) {
  const label = monthLabel(data.month);
  return (
    <div className="mt-5 grid gap-6">
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Tile label={`Facturat în ${label}`} value={sums(data.facturat)} />
        <Tile label={`Încasat în ${label}`} value={data.incasat ? sums(data.incasat.sume) || "—" : "—"} hint={data.incasat ? (data.incasat.sursa === "extras" ? "din extras" : "din Oblio") : "importă extrasul"} tone="ok" />
        <Tile label="De încasat" value={sums(data.deIncasat)} hint="în termen" />
        <Tile label="Întârziat" value={sums(data.intarziat)} tone="error" />
        <Tile label={`Cheltuieli în ${label}`} value={sums(data.cheltuieli)} />
      </ul>

      <section aria-labelledby="alerte">
        <h2 id="alerte" className="text-[16px] font-semibold text-bone">
          Alerte {data.alerte.length > 0 ? `(${data.alerte.length})` : ""}
        </h2>
        {data.alerte.length === 0 ? (
          <Empty className="mt-3">Nimic nu cere atenție.</Empty>
        ) : (
          <ul className="mt-3 divide-y divide-hair rounded-xl border border-hair bg-char">
            {data.alerte.map((alert, index) => (
              <li key={index} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-[15px]">
                <Tag tone={alert.tone}>{alert.tone === "error" ? "acum" : "de făcut"}</Tag>
                <span className="min-w-0 flex-1">{alert.text}</span>
                <Link href={alert.href} className="text-[14.5px] font-medium text-[var(--md-a1)] underline underline-offset-4">
                  Deschide
                </Link>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-[14px] text-dim">
          {lastDigest
            ? lastDigest.trimis
              ? `Ultimul rezumat pe email: ${dayLabel(lastDigest.zi)}, ${lastDigest.alerte} ${lastDigest.alerte === 1 ? "alertă" : "alerte"}, către ${lastDigest.catre}.`
              : `Rezumatul din ${dayLabel(lastDigest.zi)} n-a plecat: ${lastDigest.mesaj ?? "motiv necunoscut"}.`
            : "Niciun rezumat pe email încă. Adresa se pune în Setări."}
        </p>
      </section>

      <section aria-labelledby="reclame">
        <div className="flex items-center gap-2">
          <h2 id="reclame" className="text-[16px] font-semibold text-bone">
            Banii pe reclame, pe client
          </h2>
          <Info>Cheltuit de platforme pentru clienții legați din Reclame. Îi plătește clientul direct: nu se facturează.</Info>
        </div>
        {data.reclame && data.reclame.length > 0 ? (
          <div className="mt-3 overflow-x-auto rounded-xl border border-hair bg-char">
            <table className="ads-table min-w-full border-collapse">
              <thead>
                <tr className="border-b border-hair">
                  <th className={thClass}>Client</th>
                  <th className={cn(thClass, "text-right")}>Cheltuit</th>
                  <th className={thClass}>Notă</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hair">
                {data.reclame.map((row) => (
                  <tr key={row.client}>
                    <td className={cn(tdClass, "font-medium")}>{row.client}</td>
                    <td className={cn(tdClass, "whitespace-nowrap text-right tabular-nums")}>{sums(row.sume)}</td>
                    <td className={cn(tdClass, "text-[14.5px] text-dim")}>{row.nota ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-3 rounded-xl border border-dashed border-hair-strong px-4 py-3 text-[15px] text-dim">{data.reclameNota ?? "Niciun client legat de portalul de reclame."}</p>
        )}
      </section>

      {data.deFacut.length > 0 ? (
        <section aria-labelledby="de-facut">
          <h2 id="de-facut" className="text-[16px] font-semibold text-bone">
            Ca să apară toate cifrele
          </h2>
          <ul className="mt-2 grid gap-1 text-[15px] text-bone/85">
            {data.deFacut.map((item, index) => (
              <li key={index}>• {item}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
