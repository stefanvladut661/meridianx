import Link from "next/link";
import { DIVISIONS } from "@/lib/division";
import { LEAD_STATUSES } from "@/lib/validations/lead";
import { STATUS_LABELS } from "@/lib/supabase/types";

/**
 * Bara de filtre (FAZA 6).
 *
 * Formular GET nativ: filtrele ajung în URL, deci starea e partajabilă,
 * se poate pune la favorite, funcționează cu butonul Înapoi și merge fără
 * o linie de JavaScript. Într-o unealtă folosită zilnic, asta bate orice
 * filtrare „reactivă" care se pierde la reîncărcare.
 *
 * Exportul CSV e un link care duce aceiași parametri mai departe — exporți
 * exact ce vezi, nu tot tabelul.
 */

const controlClasses =
  "h-9 rounded-sm border border-line bg-bg px-2.5 text-sm text-fg " +
  "focus:border-accent focus:outline-none";

export interface FilterValues {
  q?: string;
  division?: string;
  status?: string;
  from?: string;
  to?: string;
}

export function Filters({
  values,
  exportHref,
  hasFilters,
}: {
  values: FilterValues;
  exportHref: string;
  hasFilters: boolean;
}) {
  return (
    <form
      method="get"
      action="/admin"
      className="flex flex-wrap items-end gap-x-3 gap-y-3 py-4"
    >
      <div className="min-w-0 flex-1 basis-56">
        <label
          htmlFor="f-q"
          className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted"
        >
          Caută
        </label>
        <input
          id="f-q"
          name="q"
          type="search"
          defaultValue={values.q ?? ""}
          placeholder="nume, email sau companie"
          className={`${controlClasses} mt-1 block w-full`}
        />
      </div>

      <div>
        <label
          htmlFor="f-division"
          className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted"
        >
          Divizie
        </label>
        <select
          id="f-division"
          name="division"
          defaultValue={values.division ?? ""}
          className={`${controlClasses} mt-1 block`}
        >
          <option value="">Toate</option>
          {DIVISIONS.map((division) => (
            <option key={division} value={division}>
              {division === "video" ? "Video" : "Software"}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label
          htmlFor="f-status"
          className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted"
        >
          Status
        </label>
        <select
          id="f-status"
          name="status"
          defaultValue={values.status ?? ""}
          className={`${controlClasses} mt-1 block`}
        >
          <option value="">Toate</option>
          {LEAD_STATUSES.map((status) => (
            <option key={status} value={status}>
              {STATUS_LABELS[status]}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label
          htmlFor="f-from"
          className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted"
        >
          De la
        </label>
        <input
          id="f-from"
          name="from"
          type="date"
          defaultValue={values.from ?? ""}
          className={`${controlClasses} mt-1 block`}
        />
      </div>

      <div>
        <label
          htmlFor="f-to"
          className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted"
        >
          Până la
        </label>
        <input
          id="f-to"
          name="to"
          type="date"
          defaultValue={values.to ?? ""}
          className={`${controlClasses} mt-1 block`}
        />
      </div>

      <button
        type="submit"
        className="h-9 rounded-sm bg-s-signal px-4 text-sm font-semibold text-s-ink transition-colors duration-150 hover:bg-[#6b93ff]"
      >
        Filtrează
      </button>

      {hasFilters ? (
        <Link
          href="/admin"
          className="h-9 self-end px-1 font-mono text-[11px] uppercase leading-9 tracking-[0.16em] text-muted underline-offset-4 hover:text-fg hover:underline"
        >
          Șterge filtrele
        </Link>
      ) : null}

      <a
        href={exportHref}
        className="ml-auto h-9 self-end rounded-sm border border-line px-3 font-mono text-[11px] uppercase leading-[calc(2.25rem-2px)] tracking-[0.16em] text-fg/80 transition-colors duration-150 hover:border-muted hover:text-fg"
      >
        Export CSV
      </a>
    </form>
  );
}
