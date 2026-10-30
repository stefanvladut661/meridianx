import Link from "next/link";
import type { Panou, SumaPeMoneda } from "@/lib/firma/panou";
import { dayLabel, money, monthLabel } from "@/lib/firma/format";
import { cn } from "@/lib/utils";
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
      <p className="text-[12.5px] font-medium text-dim">{label}</p>
      <p className={cn("mt-1 text-[1.375rem] font-semibold tabular-nums", tone === "error" && value !== "—" ? "text-[var(--ap-error)]" : "text-bone")}>{value}</p>
      {hint ? <p className="mt-0.5 text-[12px] text-dim">{hint}</p> : null}
    </li>
  );
}

export function DashboardScreen({ data, lastDigest }: { data: Panou; lastDigest: { zi: string; alerte: number; trimis: boolean; catre: string | null; mesaj: string | null } | null }) {
  const label = monthLabel(data.month);
  return (
    <div className="mt-5 grid gap-6">
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Tile label={`Facturat în ${label}`} value={sums(data.facturat)} hint="facturile emise în lună" />
        <Tile label={`Încasat în ${label}`} value={data.incasat ? sums(data.incasat.sume) || "—" : "—"} hint={data.incasat ? (data.incasat.sursa === "extras" ? "din extras, plățile legate de facturi" : "din Oblio (ultima încasare în lună)") : "importă extrasul lunii"} tone="ok" />
        <Tile label="De încasat" value={sums(data.deIncasat)} hint="facturi emise, în termen" />
        <Tile label="Întârziat" value={sums(data.intarziat)} hint="scadența a trecut" tone="error" />
        <Tile label={`Cheltuieli în ${label}`} value={sums(data.cheltuieli)} hint="bonurile și facturile urcate" />
      </ul>

      <section aria-labelledby="alerte">
        <h2 id="alerte" className="text-[15px] font-semibold text-bone">
          Alerte {data.alerte.length > 0 ? `(${data.alerte.length})` : ""}
        </h2>
        {data.alerte.length === 0 ? (
          <Empty className="mt-3">Nimic nu cere atenție: nicio factură întârziată, niciun contract la final, pachetul contabilului trimis, nicio reînnoire în 7 zile, nicio ciornă de aprobat.</Empty>
        ) : (
          <ul className="mt-3 divide-y divide-hair rounded-xl border border-hair bg-char">
            {data.alerte.map((alert, index) => (
              <li key={index} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-[14px]">
                <Tag tone={alert.tone}>{alert.tone === "error" ? "acum" : "de făcut"}</Tag>
                <span className="min-w-0 flex-1">{alert.text}</span>
                <Link href={alert.href} className="text-[13px] font-medium text-[var(--md-a1)] underline underline-offset-4">
                  Deschide
                </Link>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-[12.5px] text-dim">
          {lastDigest
            ? lastDigest.trimis
              ? `Ultimul rezumat pe email: ${dayLabel(lastDigest.zi)}, ${lastDigest.alerte} ${lastDigest.alerte === 1 ? "alertă" : "alerte"}, către ${lastDigest.catre}.`
              : `Rezumatul din ${dayLabel(lastDigest.zi)} n-a plecat: ${lastDigest.mesaj ?? "motiv necunoscut"}.`
            : "Rezumatul de dimineață pleacă pe email doar în zilele cu alerte (adresa se pune în Setări; jobul se programează în vercel.json)."}
        </p>
      </section>

      <section aria-labelledby="reclame">
        <h2 id="reclame" className="text-[15px] font-semibold text-bone">
          Banii pe reclame, pe client — {label}
        </h2>
        <p className="mt-0.5 text-[13px] text-dim">Din portalul de reclame, ce au cheltuit platformele pentru fiecare client legat. Îi plătește clientul direct; nu se facturează.</p>
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
                    <td className={cn(tdClass, "text-[13px] text-dim")}>{row.nota ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-3 rounded-xl border border-dashed border-hair-strong px-4 py-3 text-[14px] text-dim">{data.reclameNota ?? "Niciun client legat de portalul de reclame."}</p>
        )}
      </section>

      {data.deFacut.length > 0 ? (
        <section aria-labelledby="de-facut">
          <h2 id="de-facut" className="text-[15px] font-semibold text-bone">
            Ca să apară toate cifrele
          </h2>
          <ul className="mt-2 grid gap-1 text-[14px] text-bone/85">
            {data.deFacut.map((item, index) => (
              <li key={index}>• {item}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
