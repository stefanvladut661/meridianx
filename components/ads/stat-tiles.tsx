import { formatDelta, type Delta } from "@/lib/ads/metrics";
import { cn } from "@/lib/utils";
import { ERROR_TEXT, OK_TEXT } from "./tone";

/**
 * Rândul de indicatori: eticheta, valoarea, schimbarea față de perioada dinainte.
 *
 * Perioada de comparat se spune O DATĂ, deasupra rândului, nu în fiecare
 * casetă. Schimbarea are săgeată ȘI procent, nu doar culoare; culoarea
 * spune dacă e bună (cost mai mic, rezultate mai multe), nu doar direcția:
 * un CPC în creștere e roșu. Cheltuiala nu e nici bună, nici rea — neutră.
 */

export interface StatTile {
  label: string;
  value: string;
  delta: Delta;
  /** Nota mică de sub valoare, când eticheta nu ajunge („clicuri pe link”). */
  note?: string;
}

function DeltaLine({ delta }: { delta: Delta }) {
  const rounded = delta.percent === null ? null : Math.round(delta.percent);
  const arrow = rounded === null || rounded === 0 ? "" : rounded > 0 ? "▲" : "▼";
  const meaning = delta.tone === "good" ? "mai bine" : delta.tone === "bad" ? "mai rău" : "";
  return (
    <p
      className={cn(
        "mt-2 whitespace-nowrap font-md-mono text-[12px] tracking-wide",
        delta.tone === "good" ? OK_TEXT : delta.tone === "bad" ? ERROR_TEXT : "text-dim"
      )}
    >
      {arrow ? (
        <span aria-hidden className="mr-1.5">
          {arrow}
        </span>
      ) : null}
      {delta.percent === null ? "—" : formatDelta(delta)}
      {meaning ? <span className="sr-only">, {meaning}</span> : null}
    </p>
  );
}

export function StatTiles({ tiles, against }: { tiles: StatTile[]; against: string }) {
  return (
    <div>
      <p className="mb-2.5 text-[12.5px] text-dim">Procentele: {against}.</p>
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-panel-lg border border-hair bg-hair md:grid-cols-3 xl:grid-cols-6">
        {tiles.map((tile) => (
          <div key={tile.label} className="min-w-0 bg-char px-4 py-4 sm:px-5">
            <dt className="text-[12.5px] text-dim">{tile.label}</dt>
            <dd className="mt-1.5 truncate text-[1.5rem] font-semibold leading-tight tracking-tight text-bone sm:text-[1.625rem]">
              {tile.value}
            </dd>
            {tile.note ? <dd className="mt-0.5 text-[11.5px] text-dim">{tile.note}</dd> : null}
            <dd>
              <DeltaLine delta={tile.delta} />
              <span className="sr-only"> {against}</span>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
