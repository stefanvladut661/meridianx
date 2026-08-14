"use client";

import type { ReactNode } from "react";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  FEATURES,
  INTEGRATIONS,
  MAINTENANCE,
  PROJECT_TYPES,
  type ProjectTypeId,
} from "@/lib/estimator-config";
import { availableAddons } from "@/components/software/estimator/estimate";
import type { BriefState } from "./brief-state";
import type { FieldErrors } from "./validate";

/**
 * Conținutul celor cinci pași ai brief-ului (FAZA 5).
 *
 * O întrebare majoră per pas. Opțiunile arată ca poziții pe un
 * instrument, nu ca butoane de landing page: cod mono, marcaj pătrat,
 * stare de selecție citibilă și fără culoare (bordură + fundal, nu
 * doar nuanță). Tranziții sub 150ms — lumea software (CLAUDE.md §2).
 */

// i18n: tot copy-ul din acest fișier e RO hardcodat — F7 îl extrage

export const BUDGETS = [
  "Sub 5.000 €",
  "5.000 – 15.000 €",
  "15.000 – 30.000 €",
  "Peste 30.000 €",
  "Nu știu încă",
] as const;

export const TIMELINES = [
  "Cât mai repede",
  "În 1–3 luni",
  "În 3–6 luni",
  "Planific pentru anul viitor",
  "Depinde de finanțare",
] as const;

const LANGUAGE_OPTIONS = [
  { value: 1, label: "Doar română" },
  { value: 2, label: "Română + engleză" },
  { value: 3, label: "Trei limbi" },
  { value: 4, label: "Patru sau mai multe" },
];

/** Marcajul de selecție — pătrat plin, nu bifă: e un instrument. */
function Marker({ selected }: { selected: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "mt-0.5 inline-block size-3 shrink-0 rounded-xs border transition-colors duration-150",
        selected ? "border-accent bg-accent" : "border-muted"
      )}
    />
  );
}

interface OptionProps {
  type: "radio" | "checkbox";
  name: string;
  code: string;
  label: string;
  hint?: string;
  selected: boolean;
  onSelect: () => void;
}

function Option({
  type,
  name,
  code,
  label,
  hint,
  selected,
  onSelect,
}: OptionProps) {
  return (
    <label
      className={cn(
        "flex cursor-pointer gap-3 rounded-md border p-4 transition-colors duration-150",
        // controlul e sr-only, deci inelul de focus trebuie mutat aici
        "has-[:focus-visible]:[outline:2px_solid_var(--focus-ring)] has-[:focus-visible]:[outline-offset:2px]",
        selected
          ? "border-accent bg-accent/8"
          : "border-line hover:border-muted"
      )}
    >
      <input
        type={type}
        name={name}
        className="sr-only"
        checked={selected}
        onChange={onSelect}
      />
      <Marker selected={selected} />
      <span className="min-w-0">
        <span className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-mono text-[11px] tracking-[0.18em] text-muted">
            {code}
          </span>
          <span className="font-medium text-fg">{label}</span>
        </span>
        {hint ? (
          <span className="mt-1 block text-sm text-muted">{hint}</span>
        ) : null}
      </span>
    </label>
  );
}

function Legend({ children }: { children: ReactNode }) {
  return (
    <legend className="text-base font-medium text-fg">{children}</legend>
  );
}

export interface StepProps {
  state: BriefState;
  set: <K extends keyof BriefState>(key: K, value: BriefState[K]) => void;
  toggleIn: (key: "features" | "integrations", id: string) => void;
  errors: FieldErrors;
}

/* ── 01 · Tipul proiectului ─────────────────────────────────────── */

export function StepType({ state, set, errors }: StepProps) {
  return (
    <fieldset aria-describedby={errors.type ? "brief-type-error" : undefined}>
      <Legend>Ce vrei să construim?</Legend>
      <p className="mt-2 text-sm text-muted">
        Alege ce se apropie cel mai mult. Dacă niciuna nu se potrivește, ultima
        opțiune e un răspuns bun, nu o evadare.
      </p>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {PROJECT_TYPES.map((type, index) => (
          <Option
            key={type.id}
            type="radio"
            name="project-type"
            code={`TP.${String(index + 1).padStart(2, "0")}`}
            label={type.label}
            hint={type.summary}
            selected={state.type === type.id}
            onSelect={() => set("type", type.id as ProjectTypeId)}
          />
        ))}
      </div>
      {errors.type ? (
        <p id="brief-type-error" role="alert" className="mt-3 text-sm text-red-400">
          {errors.type}
        </p>
      ) : null}
    </fieldset>
  );
}

/* ── 02 · Ce conține (estimatorul) ──────────────────────────────── */

export function StepComposition({ state, set, toggleIn }: StepProps) {
  const type = PROJECT_TYPES.find((item) => item.id === state.type);

  if (!type || !type.estimable) {
    return (
      <div>
        <Legend>Ce conține proiectul</Legend>
        <p className="mt-4 rounded-md border border-line bg-surface p-5 text-pretty text-muted">
          Pentru un proiect care încă nu are o formă, opțiunile de aici n-ar
          măsura nimic — ar produce doar o cifră care sună a certitudine. Sărim
          peste și ne concentrăm pe problema pe care vrei s-o rezolvi.
        </p>
      </div>
    );
  }

  const features = availableAddons(FEATURES, state.type);
  const integrations = availableAddons(INTEGRATIONS, state.type);

  return (
    <div className="space-y-8">
      <div>
        <Legend>Din ce e făcut?</Legend>
        <p className="mt-2 text-sm text-muted">
          Fiecare răspuns strânge banda din fișa de calibrare. Nimic nu e
          definitiv — bifezi ce știi acum.
        </p>
      </div>

      <Field
        label={`Câte ${type.screenNoun} estimezi`}
        hint={`Sunt incluse ${type.includedScreens} în configurația de bază. O cifră aproximativă e suficientă.`}
      >
        {(props) => (
          <Input
            {...props}
            type="number"
            inputMode="numeric"
            min={1}
            max={200}
            className="max-w-40"
            placeholder={String(type.includedScreens)}
            value={state.screens ?? ""}
            onChange={(event) => {
              const raw = event.target.value;
              if (raw === "") {
                set("screens", null);
                return;
              }
              const parsed = Number.parseInt(raw, 10);
              if (Number.isNaN(parsed)) return;
              set("screens", Math.min(200, Math.max(1, parsed)));
            }}
          />
        )}
      </Field>

      <fieldset>
        <Legend>Funcționalități</Legend>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {features.map((feature, index) => (
            <Option
              key={feature.id}
              type="checkbox"
              name={`feature-${feature.id}`}
              code={`FN.${String(index + 1).padStart(2, "0")}`}
              label={feature.label}
              hint={feature.hint}
              selected={state.features.includes(feature.id)}
              onSelect={() => toggleIn("features", feature.id)}
            />
          ))}
        </div>
      </fieldset>

      <fieldset>
        <Legend>Integrări cu ce ai deja</Legend>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {integrations.map((integration, index) => (
            <Option
              key={integration.id}
              type="checkbox"
              name={`integration-${integration.id}`}
              code={`IN.${String(index + 1).padStart(2, "0")}`}
              label={integration.label}
              hint={integration.hint}
              selected={state.integrations.includes(integration.id)}
              onSelect={() => toggleIn("integrations", integration.id)}
            />
          ))}
        </div>
      </fieldset>

      <div className="grid gap-6 sm:grid-cols-2">
        <Field label="În câte limbi">
          {(props) => (
            <Select
              {...props}
              value={String(state.languages)}
              onChange={(event) =>
                set("languages", Number.parseInt(event.target.value, 10))
              }
            >
              {LANGUAGE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <fieldset className="self-end">
          <Option
            type="checkbox"
            name="maintenance"
            code="MN.01"
            label={MAINTENANCE.label}
            hint={MAINTENANCE.hint}
            selected={state.maintenance}
            onSelect={() => set("maintenance", !state.maintenance)}
          />
        </fieldset>
      </div>
    </div>
  );
}

/* ── 03 · Contextul ─────────────────────────────────────────────── */

export function StepContext({ state, set, errors }: StepProps) {
  return (
    <div>
      <Legend>Ce problemă rezolvăm?</Legend>
      <p className="mt-2 text-sm text-muted">
        Partea asta ne ajută mai mult decât toate bifele de dinainte. Scrie ca
        unui coleg, nu ca într-un caiet de sarcini.
      </p>
      <div className="mt-6">
        <Field
          label="Situația de acum și ce ar trebui să se schimbe"
          required
          error={errors.message}
          hint="Un exemplu bun: „Comenzile vin pe WhatsApp și le trec manual în facturi. Pierdem o oră pe zi și greșim.”"
        >
          {(props) => (
            <Textarea
              {...props}
              rows={7}
              // schema F0 limitează `message` la 5000; la trimitere
              // adăugăm peste text anexa din estimator, deci lăsăm
              // marjă — nu vrem eroare de validare pentru o anexă
              // pe care omul nici n-a scris-o
              maxLength={2500}
              value={state.context}
              onChange={(event) => set("context", event.target.value)}
            />
          )}
        </Field>
      </div>
    </div>
  );
}

/* ── 04 · Buget, termen, finanțare ──────────────────────────────── */

export function StepBudget({ state, set, errors }: StepProps) {
  return (
    <div className="space-y-8">
      <fieldset
        aria-describedby={errors.budget ? "brief-budget-error" : undefined}
      >
        <Legend>Cu ce buget lucrăm?</Legend>
        <p className="mt-2 text-sm text-muted">
          Ne ajută să propunem o soluție realistă. Un proiect gândit pentru
          8.000 € și unul pentru 30.000 € arată diferit din prima zi — nu vrem
          să-ți prezentăm ceva ce nu se potrivește.
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {BUDGETS.map((budget, index) => (
            <Option
              key={budget}
              type="radio"
              name="budget"
              code={`BG.${String(index + 1).padStart(2, "0")}`}
              label={budget}
              selected={state.budget === budget}
              onSelect={() => set("budget", budget)}
            />
          ))}
        </div>
        {errors.budget ? (
          <p
            id="brief-budget-error"
            role="alert"
            className="mt-3 text-sm text-red-400"
          >
            {errors.budget}
          </p>
        ) : null}
      </fieldset>

      <Field label="Când ai nevoie de el" error={errors.timeline}>
        {(props) => (
          <Select
            {...props}
            className="max-w-sm"
            value={state.timeline}
            onChange={(event) => set("timeline", event.target.value)}
          >
            <option value="">Alege un termen</option>
            {TIMELINES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </Select>
        )}
      </Field>

      <fieldset>
        <Option
          type="checkbox"
          name="funded"
          code="FD.01"
          label="Proiectul e finanțat din fonduri"
          hint="Bifează dacă banii vin dintr-un program de finanțare — lucrăm altfel când există termene de decontare."
          selected={state.isFunded}
          onSelect={() => set("isFunded", !state.isFunded)}
        />

        {state.isFunded ? (
          <div className="mt-4 grid gap-6 rounded-md border border-line bg-surface p-5 sm:grid-cols-2">
            <Field
              label="Linia de finanțare"
              hint="Scrie-o cum o știi. Dacă nu ești sigur de denumirea exactă, nu e o problemă."
            >
              {(props) => (
                <Input
                  {...props}
                  value={state.fundingLine}
                  onChange={(event) => set("fundingLine", event.target.value)}
                />
              )}
            </Field>
            <Field
              label="Termen de decontare"
              hint="Data până la care trebuie depuse documentele."
            >
              {(props) => (
                <Input
                  {...props}
                  type="date"
                  value={state.fundingDeadline}
                  onChange={(event) =>
                    set("fundingDeadline", event.target.value)
                  }
                />
              )}
            </Field>
            <p className="text-sm text-muted sm:col-span-2">
              Nu dăm consultanță pe eligibilitate sau pe regulile programului —
              pentru asta ai consultantul tău. Noi ne ocupăm de partea tehnică
              și de documentele care ne revin, la termenele tale.
            </p>
          </div>
        ) : null}
      </fieldset>
    </div>
  );
}

/* ── 05 · Contact ───────────────────────────────────────────────── */

export function StepContact({ state, set, errors }: StepProps) {
  return (
    <div>
      <Legend>Unde îți trimitem propunerea?</Legend>
      <p className="mt-2 text-sm text-muted">
        Răspundem cu o propunere scrisă, nu cu un apel-surpriză. Dacă preferi
        să vorbim întâi, spune-ne în brief.
      </p>
      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <Field label="Nume" required error={errors.name}>
          {(props) => (
            <Input
              {...props}
              autoComplete="name"
              value={state.name}
              onChange={(event) => set("name", event.target.value)}
            />
          )}
        </Field>
        <Field label="Companie" error={errors.company}>
          {(props) => (
            <Input
              {...props}
              autoComplete="organization"
              value={state.company}
              onChange={(event) => set("company", event.target.value)}
            />
          )}
        </Field>
        <Field label="Email" required error={errors.email}>
          {(props) => (
            <Input
              {...props}
              type="email"
              autoComplete="email"
              placeholder="nume@firma.ro"
              value={state.email}
              onChange={(event) => set("email", event.target.value)}
            />
          )}
        </Field>
        <Field
          label="Telefon"
          error={errors.phone}
          hint="Opțional. Îl folosim doar dacă e ceva de lămurit repede."
        >
          {(props) => (
            <Input
              {...props}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="07xx xxx xxx"
              value={state.phone}
              onChange={(event) => set("phone", event.target.value)}
            />
          )}
        </Field>
      </div>
    </div>
  );
}
