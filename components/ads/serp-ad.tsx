"use client";

import { useMemo, useState } from "react";
import type { SummaryAd } from "@/lib/ads/google/search/summary";
import { RSA_DESCRIPTION_MAX, RSA_HEADLINE_MAX } from "@/lib/ads/google/search/limits";
import { googleLength } from "@/lib/ads/google/search/text";
import { cn } from "@/lib/utils";
import { ERROR_TEXT } from "./tone";

/**
 * Anunțul de căutare, arătat cum îl vede omul care caută: eticheta
 * „Sponsorizat”, adresa cu căile, trei titluri și două descrieri.
 *
 * Google combină singur titlurile și descrierile. Cele fixate stau mereu pe
 * poziția lor; restul se rotesc. „Altă combinație” arată încă o variantă
 * posibilă — nu toate, nu în ordinea Google. Sub machetă, lista completă,
 * cu lungimea fiecărui text cum o numără Google.
 *
 * Macheta e pe fond deschis intenționat: e singurul loc din portal unde
 * vezi interfața altcuiva, nu a noastră.
 */

function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/** O combinație posibilă: fixatele pe poziția lor, celelalte alese din cele nefolosite. */
function combination(items: Array<{ text: string; pin: number | null }>, positions: number, seed: number): string[] {
  const random = seeded(seed);
  const used = new Set<number>();
  const result: string[] = [];
  for (let position = 1; position <= positions; position += 1) {
    const pinned = items.map((item, index) => ({ item, index })).filter(({ item }) => item.pin === position);
    const pool = pinned.length > 0 ? pinned : items.map((item, index) => ({ item, index })).filter(({ item, index }) => item.pin === null && !used.has(index));
    if (pool.length === 0) continue;
    const pick = pool[Math.floor(random() * pool.length)];
    used.add(pick.index);
    result.push(pick.item.text);
  }
  return result;
}

export function SerpAd({
  ad,
  index,
  extras,
}: {
  ad: SummaryAd;
  index: number;
  /** Ce poate apărea sub anunț: linkurile suplimentare, mesajele scurte, telefonul. */
  extras?: { sitelinks: string[]; callouts: string[]; phone: string | null };
}) {
  const [seed, setSeed] = useState(index + 1);
  const headlines = useMemo(() => combination(ad.headlines, 3, seed), [ad.headlines, seed]);
  const descriptions = useMemo(() => combination(ad.descriptions, 2, seed * 31 + 7), [ad.descriptions, seed]);
  const host = ad.displayUrl?.split(" › ")[0] ?? null;
  const pinnedHeadlines = ad.headlines.filter((item) => item.pin !== null).length;

  return (
    <div className="min-w-0">
      <figure className="overflow-hidden rounded-panel border border-hair">
        <div className="bg-[#ffffff] px-4 py-4 text-[#202124] sm:px-5" lang="ro">
          <p className="text-[13px] font-bold leading-none">Sponsorizat</p>
          <div className="mt-3 flex items-center gap-3">
            <span aria-hidden className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-[#dadce0] bg-[#f1f3f4] text-[12px] font-semibold text-[#4d5156]">
              {host ? host.charAt(0).toUpperCase() : "?"}
            </span>
            <div className="min-w-0 leading-tight">
              <p className="truncate text-[14px] text-[#202124]">{host ?? "adresă lipsă"}</p>
              <p className="truncate text-[12px] text-[#4d5156]">
                {ad.origin ? [ad.origin, ad.path1, ad.path1 ? ad.path2 : null].filter(Boolean).join(" › ") : "—"}
              </p>
            </div>
          </div>
          <p className="mt-2 text-[19px] leading-snug text-[#1a0dab] [overflow-wrap:anywhere]">
            {headlines.length > 0 ? headlines.join(" | ") : <span className="text-[#5f6368]">Fără titluri</span>}
          </p>
          <p className="mt-1 text-[14px] leading-relaxed text-[#4d5156] [overflow-wrap:anywhere]">
            {descriptions.length > 0 ? descriptions.join(" ") : "Fără descrieri"}
          </p>
          {extras && extras.callouts.length > 0 ? (
            <p className="mt-1 text-[14px] leading-relaxed text-[#4d5156]">{extras.callouts.slice(0, 4).join(" · ")}</p>
          ) : null}
          {extras && extras.sitelinks.length > 0 ? (
            <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[14px] text-[#1a0dab]">
              {extras.sitelinks.slice(0, 4).map((text) => (
                <li key={text}>{text}</li>
              ))}
            </ul>
          ) : null}
          {extras?.phone ? <p className="mt-2 text-[14px] text-[#202124]">Sună la {extras.phone}</p> : null}
        </div>
        <figcaption className="flex flex-wrap items-center justify-between gap-2 border-t border-hair bg-ink/40 px-4 py-2.5">
          <span className="font-md-mono text-[11.5px] text-dim">
            Anunțul {index + 1} · o combinație posibilă
            {pinnedHeadlines > 0 ? ` · ${pinnedHeadlines === 1 ? "un titlu fixat" : `${pinnedHeadlines} titluri fixate`}` : ""}
          </span>
          <button
            type="button"
            onClick={() => setSeed((value) => value + 1)}
            className="rounded-full border border-hair-strong px-3 py-1 text-[12.5px] text-bone/85 hover:text-bone"
          >
            Altă combinație
          </button>
        </figcaption>
      </figure>

      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <TextList title={`Titluri · ${ad.headlines.length}`} items={ad.headlines} max={RSA_HEADLINE_MAX} />
        <TextList title={`Descrieri · ${ad.descriptions.length}`} items={ad.descriptions} max={RSA_DESCRIPTION_MAX} />
      </div>
    </div>
  );
}

function TextList({ title, items, max }: { title: string; items: Array<{ text: string; pin: number | null }>; max: number }) {
  return (
    <div className="min-w-0">
      <h6 className="font-md-mono text-[11px] uppercase tracking-[0.16em] text-dim">{title}</h6>
      <ol className="mt-2 space-y-1">
        {items.map((item, index) => {
          const length = googleLength(item.text.trim());
          return (
            <li key={index} className="flex min-w-0 items-baseline gap-2 text-[13.5px] leading-snug">
              <span className="w-5 shrink-0 text-right font-md-mono text-[11px] tabular-nums text-dim">{index + 1}</span>
              <span className="min-w-0 flex-1 text-bone/90 [overflow-wrap:anywhere]">{item.text}</span>
              {item.pin !== null ? (
                <span className="shrink-0 rounded-full border border-hair-strong px-1.5 font-md-mono text-[10.5px] text-bone/80">
                  fixat {item.pin}
                </span>
              ) : null}
              <span className={cn("shrink-0 font-md-mono text-[11px] tabular-nums", length > max ? ERROR_TEXT : "text-dim")}>
                {length}/{max}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
