"use client";

import { createContext, useContext, useId, useState, type ReactNode } from "react";
import { asArray, getIn } from "@/lib/ads/plan-path";
import type { PlanProblem } from "@/lib/ads/plan-validate";
import { cn } from "@/lib/utils";
import { ERROR_TEXT, FIELD, FIELD_INVALID, LABEL, WARNING_TEXT } from "./tone";

/**
 * Câmpurile previzualizării. Fiecare e legat de o CALE din plan
 * (`campaign.daily_budget`): citește valoarea brută de acolo, scrie înapoi
 * acolo, și își arată sub el erorile și avertismentele cu aceeași cale.
 *
 * Valoarea brută poate fi greșită (text în loc de număr, o variantă care nu
 * există) — câmpul o arată așa cum e, marcată, nu o ascunde. Omul trebuie
 * să vadă ce a scris conversația, nu ce credem noi că a vrut.
 */

interface PlanFormContextValue {
  draft: Record<string, unknown>;
  update: (path: string, value: unknown) => void;
  errors: Map<string, PlanProblem[]>;
  warnings: Map<string, PlanProblem[]>;
}

const PlanFormContext = createContext<PlanFormContextValue | null>(null);

export function PlanFormProvider({
  value,
  children,
}: {
  value: PlanFormContextValue;
  children: ReactNode;
}) {
  return <PlanFormContext.Provider value={value}>{children}</PlanFormContext.Provider>;
}

export function usePlanForm(): PlanFormContextValue {
  const context = useContext(PlanFormContext);
  if (!context) throw new Error("usePlanForm în afara PlanFormProvider");
  return context;
}

/** Id-ul DOM al câmpului pentru o cale — țintă pentru linkurile din lista de erori. */
export function fieldId(path: string): string {
  return `camp-${path.replace(/\./g, "-")}`;
}

export function groupByPath(problems: PlanProblem[]): Map<string, PlanProblem[]> {
  const map = new Map<string, PlanProblem[]>();
  for (const problem of problems) {
    const list = map.get(problem.path) ?? [];
    list.push(problem);
    map.set(problem.path, list);
  }
  return map;
}

function useFieldState(path: string) {
  const { draft, update, errors, warnings } = usePlanForm();
  const own = errors.get(path) ?? [];
  const cautions = warnings.get(path) ?? [];
  return {
    value: getIn(draft, path),
    update: (value: unknown) => update(path, value),
    errors: own,
    warnings: cautions,
    invalid: own.length > 0,
  };
}

export function FieldMessages({
  id,
  errors,
  warnings,
}: {
  id: string;
  errors: PlanProblem[];
  warnings: PlanProblem[];
}) {
  if (errors.length === 0 && warnings.length === 0) return null;
  return (
    <div id={id} className="mt-1.5 space-y-1">
      {errors.map((problem, index) => (
        <p key={`e${index}`} className={cn("text-[13px] leading-snug", ERROR_TEXT)}>
          {problem.message}
        </p>
      ))}
      {warnings.map((problem, index) => (
        <p key={`w${index}`} className={cn("text-[13px] leading-snug", WARNING_TEXT)}>
          {problem.message}
        </p>
      ))}
    </div>
  );
}

/** Mesajele unei căi fără câmp propriu (o secțiune întreagă lipsă). */
export function PathMessages({ path }: { path: string }) {
  const { errors, warnings } = usePlanForm();
  return (
    <FieldMessages
      id={`${fieldId(path)}-msg`}
      errors={errors.get(path) ?? []}
      warnings={warnings.get(path) ?? []}
    />
  );
}

function display(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value);
}

// ---------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------

export function TextField({
  path,
  label,
  placeholder,
  mono,
  hint,
  className,
  multiline,
  counter,
  keepEmpty,
}: {
  path: string;
  label: string;
  placeholder?: string;
  mono?: boolean;
  hint?: ReactNode;
  className?: string;
  multiline?: boolean;
  /** Număr de caractere afișat lângă etichetă, cu pragul peste care se taie. */
  counter?: { limit: number; hard?: boolean };
  /** Elementele de listă rămân `""` când se golesc — altfel rândul ar dispărea sub cursor. */
  keepEmpty?: boolean;
}) {
  const field = useFieldState(path);
  const id = fieldId(path);
  const text = display(field.value);
  const describedBy = [hint ? `${id}-hint` : null, `${id}-msg`].filter(Boolean).join(" ");
  const length = text.trim().length;
  const over = counter ? length > counter.limit : false;

  const onChange = (next: string) => field.update(next === "" && !keepEmpty ? undefined : next);
  const shared = {
    id,
    value: text,
    placeholder,
    spellCheck: mono ? false : undefined,
    "aria-invalid": field.invalid || undefined,
    "aria-describedby": describedBy,
    className: cn(
      FIELD,
      multiline ? "min-h-[5.5rem] resize-y py-2.5 leading-relaxed" : "h-11",
      mono && "font-md-mono text-[13.5px]",
      field.invalid && FIELD_INVALID
    ),
  };

  return (
    <div className={cn("min-w-0", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className={LABEL}>
          {label}
        </label>
        {counter ? (
          <span
            className={cn(
              "font-md-mono text-[11px] tabular-nums",
              over ? (counter.hard ? ERROR_TEXT : WARNING_TEXT) : "text-dim"
            )}
          >
            {length}/{counter.limit}
          </span>
        ) : null}
      </div>
      <div className="mt-1.5">
        {multiline ? (
          <textarea {...shared} rows={3} onChange={(event) => onChange(event.target.value)} />
        ) : (
          <input {...shared} type="text" onChange={(event) => onChange(event.target.value)} />
        )}
      </div>
      {hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-[12.5px] leading-snug text-dim">
          {hint}
        </p>
      ) : null}
      <FieldMessages id={`${id}-msg`} errors={field.errors} warnings={field.warnings} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Număr
// ---------------------------------------------------------------------------

export function NumberField({
  path,
  label,
  suffix,
  hint,
  className,
}: {
  path: string;
  label: string;
  suffix?: string;
  hint?: ReactNode;
  className?: string;
}) {
  const field = useFieldState(path);
  const id = fieldId(path);

  /* Textul din câmp are starea lui: „5." sau „5," sunt pași spre 5,5, nu
     numere de rotunjit sub cursor. Planul primește numărul când textul se
     parsează; dacă valoarea din plan se schimbă din altă parte (JSON-ul
     rescris), câmpul se aliniază. Un număr scris ca text în plan („50")
     rămâne vizibil, iar validarea îl marchează. */
  const [local, setLocal] = useState(display(field.value));
  const [seen, setSeen] = useState(field.value);
  if (field.value !== seen) {
    setSeen(field.value);
    const parsed = Number(local.trim().replace(",", "."));
    if (local.trim() === "" || parsed !== field.value) setLocal(display(field.value));
  }

  return (
    <div className={cn("min-w-0", className)}>
      <label htmlFor={id} className={LABEL}>
        {label}
      </label>
      <div className="relative mt-1.5">
        <input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={local}
          aria-invalid={field.invalid || undefined}
          aria-describedby={`${hint ? `${id}-hint ` : ""}${id}-msg`}
          onChange={(event) => {
            const text = event.target.value;
            setLocal(text);
            const raw = text.trim().replace(",", ".");
            if (raw === "") return field.update(undefined);
            const number = Number(raw);
            field.update(Number.isFinite(number) ? number : text);
          }}
          className={cn(FIELD, "h-11 tabular-nums", suffix && "pr-14", field.invalid && FIELD_INVALID)}
        />
        {suffix ? (
          <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[13px] text-dim">
            {suffix}
          </span>
        ) : null}
      </div>
      {hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-[12.5px] leading-snug text-dim">
          {hint}
        </p>
      ) : null}
      <FieldMessages id={`${id}-msg`} errors={field.errors} warnings={field.warnings} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Alegere
// ---------------------------------------------------------------------------

export function SelectField({
  path,
  label,
  options,
  placeholder = "— alege —",
  hint,
  className,
}: {
  path: string;
  label: string;
  options: ReadonlyArray<readonly [string, string]>;
  placeholder?: string;
  hint?: ReactNode;
  className?: string;
}) {
  const field = useFieldState(path);
  const id = fieldId(path);
  const current = display(field.value);
  const known = options.some(([value]) => value === current);

  return (
    <div className={cn("min-w-0", className)}>
      <label htmlFor={id} className={LABEL}>
        {label}
      </label>
      <select
        id={id}
        value={current}
        aria-invalid={field.invalid || undefined}
        aria-describedby={`${hint ? `${id}-hint ` : ""}${id}-msg`}
        onChange={(event) => field.update(event.target.value === "" ? undefined : event.target.value)}
        className={cn(FIELD, "mt-1.5 h-11 pr-8", field.invalid && FIELD_INVALID)}
      >
        {current === "" ? <option value="">{placeholder}</option> : null}
        {!known && current !== "" ? <option value={current}>„{current}” — nu există</option> : null}
        {options.map(([value, text]) => (
          <option key={value} value={value}>
            {text}
          </option>
        ))}
      </select>
      {hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-[12.5px] leading-snug text-dim">
          {hint}
        </p>
      ) : null}
      <FieldMessages id={`${id}-msg`} errors={field.errors} warnings={field.warnings} />
    </div>
  );
}

/**
 * Comutator pentru un boolean. `dangerWhenOn`: pornit înseamnă că
 * platforma poate schimba materialul — se vede, nu doar se citește.
 */
export function ToggleField({
  path,
  title,
  body,
  dangerWhenOn,
  defaultValue = false,
}: {
  path: string;
  title: string;
  body?: string;
  dangerWhenOn?: boolean;
  defaultValue?: boolean;
}) {
  const field = useFieldState(path);
  const id = fieldId(path);
  const on = field.value === undefined ? defaultValue : field.value === true;
  const implicit = field.value === undefined;

  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="min-w-0">
        <label htmlFor={id} className="text-[14.5px] font-semibold text-bone">
          {title}
        </label>
        {body ? <p className="mt-0.5 text-[13px] leading-snug text-dim">{body}</p> : null}
        <FieldMessages id={`${id}-msg`} errors={field.errors} warnings={field.warnings} />
      </div>
      <div className="flex shrink-0 items-center gap-2.5">
        <span
          className={cn(
            "font-md-mono text-[11px] uppercase tracking-[0.16em]",
            on ? (dangerWhenOn ? WARNING_TEXT : "text-bone") : "text-dim"
          )}
        >
          {on ? "Pornit" : implicit ? "Oprit · implicit" : "Oprit"}
        </span>
        <button
          id={id}
          type="button"
          role="switch"
          aria-checked={on}
          aria-describedby={`${id}-msg`}
          onClick={() => field.update(!on)}
          className={cn(
            "relative h-6 w-11 rounded-full border transition-colors duration-150",
            on
              ? dangerWhenOn
                ? "border-[#f0b429] bg-[#f0b429]/80"
                : "border-bone bg-bone/80"
              : "border-hair-strong bg-ink/60"
          )}
        >
          <span
            aria-hidden
            className={cn(
              "absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full transition-[left] duration-150",
              on ? "left-[1.4rem] bg-ink" : "left-1 bg-bone/70"
            )}
          />
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Liste de texte
// ---------------------------------------------------------------------------

export function TextListField({
  path,
  label,
  itemLabel,
  max,
  multiline,
  counter,
  addLabel,
  emptyText,
}: {
  path: string;
  label: string;
  itemLabel: (index: number) => string;
  max: number;
  multiline?: boolean;
  counter?: { limit: number; hard?: boolean };
  addLabel: string;
  emptyText?: string;
}) {
  const { draft, update } = usePlanForm();
  const items = asArray(getIn(draft, path));
  const headingId = useId();

  return (
    <div role="group" aria-labelledby={headingId} className="min-w-0">
      <p id={headingId} className={LABEL}>
        {label}
      </p>
      <PathMessages path={path} />
      {items.length === 0 && emptyText ? (
        <p className="mt-2 text-[13.5px] text-dim">{emptyText}</p>
      ) : null}
      <ol className="mt-2 space-y-4">
        {items.map((_, index) => (
          <li key={index}>
            <TextField
              path={`${path}.${index}`}
              label={itemLabel(index)}
              multiline={multiline}
              counter={counter}
              keepEmpty
            />
            <RemoveButton label={`Scoate ${itemLabel(index).toLowerCase()}`} onClick={() => update(`${path}.${index}`, undefined)} />
          </li>
        ))}
      </ol>
      {items.length < max ? (
        <button
          type="button"
          onClick={() => update(`${path}.${items.length}`, "")}
          className="mt-3 text-[13.5px] font-medium text-bone/80 underline-offset-4 hover:text-bone hover:underline"
        >
          + {addLabel}
        </button>
      ) : (
        <p className="mt-3 text-[12.5px] text-dim">Maximum {max}.</p>
      )}
    </div>
  );
}

export function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="mt-1.5 text-[12.5px] text-dim underline-offset-4 hover:text-bone hover:underline"
    >
      Scoate
    </button>
  );
}
