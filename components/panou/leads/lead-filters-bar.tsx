"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Search, SlidersHorizontal, X } from "lucide-react";
import { LEAD_STATUSES } from "@/lib/validations/lead";
import { Btn, btnClass } from "../ui/primitives";
import { SoftSelect } from "../ui/select";
import { useToast } from "../ui/toast";
import { statusLabel } from "./labels";
import { leadCount, type LeadFilterValues } from "./urls";

const CLEARED: LeadFilterValues = { q: "", division: "", status: "", from: "", to: "" };

/**
 * Bara de filtre din prototip. Filtrele stau în URL (q, division, status, from, to),
 * deci serverul recitește lista la fiecare schimbare: căutarea așteaptă o fracțiune de
 * secundă după ultima literă, restul se aplică pe loc. Controalele se mută imediat,
 * nu după răspunsul bazei.
 */
export function LeadFiltersBar({
  filters,
  hasFilters,
  filtered,
  totalAll,
  exportHref,
  pending,
  onChange,
}: {
  filters: LeadFilterValues;
  hasFilters: boolean;
  /** Câte lead-uri are filtrul curent. */
  filtered: number;
  /** Câte lead-uri are toată baza; `null` dacă indicatorii nu s-au putut citi. */
  totalAll: number | null;
  exportHref: string;
  pending: boolean;
  onChange: (patch: Partial<Record<keyof LeadFilterValues | "page", string>>) => void;
}) {
  const { notify } = useToast();
  const [local, setLocal] = useState<LeadFilterValues>(filters);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Cititorul din temporizator trebuie să vadă adresa de acum, nu pe cea de la tastarea literei.
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  // Adresa s-a schimbat din afară (Șterge filtrele, Înapoi în browser): controalele o urmează.
  // Cât timp omul tastează sau așteaptă un răspuns, controalele rămân ale lui.
  useEffect(() => {
    if (pending || timer.current) return;
    setLocal({ q: filters.q, division: filters.division, status: filters.status, from: filters.from, to: filters.to });
  }, [filters.q, filters.division, filters.status, filters.from, filters.to, pending]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  const apply = (patch: Partial<LeadFilterValues>) => {
    setLocal((current) => ({ ...current, ...patch }));
    onChangeRef.current({ ...patch, page: "" });
  };

  const typeQuery = (value: string) => {
    setLocal((current) => ({ ...current, q: value }));
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      onChangeRef.current({ q: value.trim(), page: "" });
    }, 320);
  };

  const flushQuery = () => {
    if (!timer.current) return;
    clearTimeout(timer.current);
    timer.current = null;
    onChangeRef.current({ q: local.q.trim(), page: "" });
  };

  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setLocal(CLEARED);
    onChangeRef.current({ ...CLEARED, page: "" });
  };

  const showClear = hasFilters || Object.values(local).some(Boolean);

  return (
    <form
      role="search"
      className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-3"
      onSubmit={(event) => {
        event.preventDefault();
        flushQuery();
      }}
    >
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <input
            inputMode="search"
            enterKeyHint="search"
            value={local.q}
            onChange={(event) => typeQuery(event.target.value)}
            maxLength={120}
            placeholder="Caută nume, email sau firmă"
            aria-label="Caută lead-uri"
            className="h-9 w-full rounded-lg border border-white/[0.1] bg-white/[0.03] pl-9 pr-3 text-[13px] outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-lav/50"
          />
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:flex lg:items-center">
          <SoftSelect
            ariaLabel="Divizie"
            value={local.division || "toate"}
            onChange={(value) => apply({ division: value === "toate" ? "" : value })}
            className="lg:w-[116px]"
            options={[
              { value: "toate", label: "Toate diviziile" },
              { value: "video", label: "Video" },
              { value: "software", label: "Software" },
            ]}
          />
          <SoftSelect
            ariaLabel="Status"
            value={local.status || "toate"}
            onChange={(value) => apply({ status: value === "toate" ? "" : value })}
            className="lg:w-[132px]"
            options={[{ value: "toate", label: "Toate statusurile" }, ...LEAD_STATUSES.map((status) => ({ value: status, label: statusLabel(status) }))]}
          />
          <label className="flex h-8 items-center gap-1.5 rounded-lg border border-white/[0.1] bg-white/[0.04] px-2 text-[11px] text-muted-foreground lg:w-[148px]">
            <span className="shrink-0">de la</span>
            <input
              type="date"
              value={local.from}
              onChange={(event) => apply({ from: event.target.value })}
              aria-label="De la data"
              className="h-7 w-full bg-transparent text-[11.5px] text-foreground outline-none"
            />
          </label>
          <label className="flex h-8 items-center gap-1.5 rounded-lg border border-white/[0.1] bg-white/[0.04] px-2 text-[11px] text-muted-foreground lg:w-[148px]">
            <span className="shrink-0">până</span>
            <input
              type="date"
              value={local.to}
              onChange={(event) => apply({ to: event.target.value })}
              aria-label="Până la data"
              className="h-7 w-full bg-transparent text-[11.5px] text-foreground outline-none"
            />
          </label>
        </div>

        <div className="flex items-center gap-2">
          {showClear ? (
            <Btn size="sm" variant="ghost" icon={X} onClick={clear}>
              Șterge filtrele
            </Btn>
          ) : (
            <span className="hidden items-center gap-1.5 text-[11.5px] text-muted-foreground/70 xl:inline-flex">
              <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" /> fără filtre
            </span>
          )}
          {/* Exportul e ruta de server (toate rândurile filtrului, nu doar pagina): un link adevărat, cu aceiași parametri. */}
          {filtered === 0 ? (
            <Btn size="sm" variant="outline" icon={Download} disabled>
              Exportă CSV
            </Btn>
          ) : (
            <a
              href={exportHref}
              className={btnClass({ variant: "outline", size: "sm" })}
              onClick={() => notify(`Export pornit: ${leadCount(filtered)}, exact ce vezi în filtru.`)}
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Exportă CSV
            </a>
          )}
        </div>
      </div>

      <p className="mt-2 text-[11px] text-muted-foreground/70" aria-live="polite">
        {totalAll === null || filtered === totalAll ? `${leadCount(filtered)} în total` : `${filtered} din ${leadCount(totalAll)} se potrivesc filtrului`}
      </p>
    </form>
  );
}
