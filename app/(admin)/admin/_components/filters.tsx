import Link from "next/link";
import { DIVISIONS } from "@/lib/division";
import { LEAD_STATUSES } from "@/lib/validations/lead";
import { STATUS_LABELS } from "@/lib/supabase/types";
import { FIELD } from "./tone";

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

export interface FilterValues {
  q?: string;
  division?: string;
  status?: string;
  from?: string;
  to?: string;
}

const control = `${FIELD} mt-2 h-10`;

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
      className="glass mt-4 flex flex-wrap items-end gap-x-3 gap-y-4 p-4 sm:p-5"
    >
      <div className="min-w-0 flex-1 basis-56">
        <label htmlFor="f-q" className="eyebrow">
          Caută
        </label>
        <input
          id="f-q"
          name="q"
          type="search"
          defaultValue={values.q ?? ""}
          placeholder="nume, email sau firmă"
          className={control}
        />
      </div>

      <div className="min-w-0 grow basis-36 sm:grow-0">
        <label htmlFor="f-division" className="eyebrow">
          Divizie
        </label>
        <select
          id="f-division"
          name="division"
          defaultValue={values.division ?? ""}
          className={control}
        >
          <option value="">Toate</option>
          {DIVISIONS.map((division) => (
            <option key={division} value={division}>
              {division === "video" ? "Video" : "Software"}
            </option>
          ))}
        </select>
      </div>

      <div className="min-w-0 grow basis-40 sm:grow-0">
        <label htmlFor="f-status" className="eyebrow">
          Status
        </label>
        <select
          id="f-status"
          name="status"
          defaultValue={values.status ?? ""}
          className={control}
        >
          <option value="">Toate</option>
          {LEAD_STATUSES.map((status) => (
            <option key={status} value={status}>
              {STATUS_LABELS[status]}
            </option>
          ))}
        </select>
      </div>

      <div className="min-w-0 grow basis-40 sm:grow-0">
        <label htmlFor="f-from" className="eyebrow">
          De la
        </label>
        <input
          id="f-from"
          name="from"
          type="date"
          defaultValue={values.from ?? ""}
          className={control}
        />
      </div>

      <div className="min-w-0 grow basis-40 sm:grow-0">
        <label htmlFor="f-to" className="eyebrow">
          Până la
        </label>
        <input
          id="f-to"
          name="to"
          type="date"
          defaultValue={values.to ?? ""}
          className={control}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          className="btn btn-light !min-h-10 !px-5 !py-2 !text-[13.5px]"
        >
          Filtrează
        </button>

        {hasFilters ? (
          <Link
            href="/admin"
            className="text-[13px] text-dim underline-offset-4 transition-colors hover:text-bone hover:underline"
          >
            Șterge filtrele
          </Link>
        ) : null}
      </div>

      <a
        href={exportHref}
        className="btn btn-ghost !min-h-10 !px-4 !py-2 !text-[12.5px] sm:ml-auto"
      >
        Export CSV
        <span className="arw" aria-hidden>
          ↓
        </span>
      </a>
    </form>
  );
}
