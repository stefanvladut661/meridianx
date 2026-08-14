"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PROJECT_TYPES, FEATURES, INTEGRATIONS } from "@/lib/estimator-config";
import {
  calculate,
  formatEuro,
  type EstimateStage,
} from "@/components/software/estimator/estimate";
import { CalibrationReadout } from "@/components/software/estimator/calibration-readout";
import { useBriefState } from "./brief-state";
import {
  StepBudget,
  StepComposition,
  StepContact,
  StepContext,
  StepType,
  type StepProps,
} from "./brief-steps";
import { Honeypot } from "./honeypot";
import { useLeadSubmit, type LeadEvent } from "./use-lead-submit";
import type { FieldErrors } from "./validate";

/**
 * Brief-ul multi-step al diviziei SOFTWARE (FAZA 5).
 *
 * Scopul nu e să strângem cât mai multe lead-uri, ci să separăm
 * proiectul de 15.000 € de cel de 300 € fără să jignim pe nimeni.
 * De-aia întrebarea de buget e formulată ca ajutor pentru propunere,
 * nu ca filtru, iar „nu știu încă” e un răspuns valid, nu o fundătură.
 *
 * Starea se persistă în sessionStorage: navigarea înapoi și închiderea
 * tabului nu pierd nimic (vezi `brief-state.ts`).
 */

// i18n: copy RO hardcodat — F7 îl extrage
const STEPS = [
  { code: "ST.01", title: "Tipul proiectului", short: "Tip" },
  { code: "ST.02", title: "Ce conține", short: "Conținut" },
  { code: "ST.03", title: "Contextul", short: "Context" },
  { code: "ST.04", title: "Buget și termen", short: "Buget" },
  { code: "ST.05", title: "Date de contact", short: "Contact" },
] as const;

const TOTAL = STEPS.length;

/**
 * Câmpurile chiar vizibile în ultimul pas. Orice altă problemă de
 * validare (message prea lung, buget, tip) urcă la nivel de formular —
 * altfel eroarea ar ateriza pe un câmp de la pasul 3, invizibil pentru
 * omul care e la pasul 5 și nu înțelege de ce nu pleacă brief-ul.
 */
const CONTACT_FIELDS = ["name", "email", "phone", "company"] as const;

function stageFor(step: number): EstimateStage {
  if (step >= 4) return "context";
  if (step === 3) return "composition";
  return "type";
}

function labelsFor(ids: string[], catalog: typeof FEATURES): string {
  return (
    ids
      .map((id) => catalog.find((item) => item.id === id)?.label)
      .filter((label): label is string => Boolean(label))
      .join(", ") || "—"
  );
}

export function BriefWizard() {
  const t = useTranslations("forms");
  const { state, hydrated, restored, set, toggleIn, clear } = useBriefState();
  const { status, fieldErrors, formError, submit } = useLeadSubmit();

  const [step, setStep] = useState(1);
  const [localErrors, setLocalErrors] = useState<FieldErrors>({});
  const [website, setWebsite] = useState("");
  const [dismissedRestore, setDismissedRestore] = useState(false);

  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);

  const submitting = status === "submitting";

  const estimate = useMemo(
    () =>
      calculate({
        type: state.type,
        screens: state.screens,
        features: state.features,
        integrations: state.integrations,
        languages: state.languages,
        maintenance: state.maintenance,
        stage: stageFor(step),
      }),
    [state, step]
  );

  // focusul urmează pasul, ca navigarea la tastatură să nu se piardă
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [step]);

  const errors: FieldErrors = { ...fieldErrors, ...localErrors };

  function validateStep(current: number): boolean {
    const next: FieldErrors = {};
    if (current === 1 && !state.type) next.type = t("errors.required");
    if (current === 3 && state.context.trim() === "")
      next.message = t("errors.required");
    if (current === 4 && !state.budget) next.budget = t("errors.required");
    if (current === 5) {
      if (!state.name.trim()) next.name = t("errors.required");
      if (!state.email.trim()) next.email = t("errors.required");
    }
    setLocalErrors(next);
    return Object.keys(next).length === 0;
  }

  function goNext() {
    if (!validateStep(step)) return;
    setStep((current) => Math.min(TOTAL, current + 1));
  }

  function goBack() {
    setLocalErrors({});
    setStep((current) => Math.max(1, current - 1));
  }

  function buildMessage(): string {
    const type = PROJECT_TYPES.find((item) => item.id === state.type);
    const lines = [state.context.trim()];

    if (state.isFunded) {
      lines.push(
        "",
        "— Finanțare —",
        `Linia: ${state.fundingLine || "nespecificată"}`,
        `Termen de decontare: ${state.fundingDeadline || "nespecificat"}`
      );
    }

    lines.push(
      "",
      "— Din estimator —",
      `Tip: ${type?.label ?? "nespecificat"}`,
      `${type?.screenNoun ?? "Ecrane"}: ${state.screens ?? "nespecificat"}`,
      `Funcții: ${labelsFor(state.features, FEATURES)}`,
      `Integrări: ${labelsFor(state.integrations, INTEGRATIONS)}`,
      `Limbi: ${state.languages}`,
      `Mentenanță: ${state.maintenance ? "da" : "nu"}`,
      estimate.ok
        ? `Interval afișat: ${formatEuro(estimate.low)} – ${formatEuro(
            estimate.high
          )} (±${Math.round(estimate.uncertainty * 100)}%)`
        : "Interval afișat: neestimabil din formular"
    );

    return lines.join("\n");
  }

  function buildEvents(): LeadEvent[] {
    const type = PROJECT_TYPES.find((item) => item.id === state.type);
    return [
      {
        type: "brief_step",
        payload: { step: 1, key: "project_type", value: type?.label ?? null },
      },
      {
        type: "brief_step",
        payload: {
          step: 2,
          key: "composition",
          screens: state.screens,
          features: state.features,
          integrations: state.integrations,
          languages: state.languages,
          maintenance: state.maintenance,
        },
      },
      {
        type: "brief_step",
        payload: { step: 3, key: "context", length: state.context.length },
      },
      {
        type: "brief_step",
        payload: {
          step: 4,
          key: "budget",
          budget: state.budget,
          timeline: state.timeline,
          isFunded: state.isFunded,
          fundingLine: state.fundingLine || null,
          fundingDeadline: state.fundingDeadline || null,
        },
      },
      {
        type: "estimator_used",
        payload: {
          estimable: estimate.ok,
          low: estimate.low,
          high: estimate.high,
          uncertainty: estimate.uncertainty,
          aboveCeiling: estimate.aboveCeiling,
        },
      },
    ];
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step < TOTAL) {
      goNext();
      return;
    }
    if (!validateStep(TOTAL)) return;

    const type = PROJECT_TYPES.find((item) => item.id === state.type);

    await submit(
      {
        source: "software-brief",
        name: state.name,
        email: state.email,
        phone: state.phone || undefined,
        company: state.company || undefined,
        projectType: type?.label,
        budgetRange: state.budget,
        timeline: state.timeline || undefined,
        message: buildMessage(),
        isFunded: state.isFunded,
        website,
      },
      CONTACT_FIELDS,
      buildEvents()
    );
  }

  // succesul șterge brief-ul persistat: următoarea vizită pleacă curat
  useEffect(() => {
    if (status === "success") clear();
  }, [status, clear]);

  if (status === "success") {
    return <BriefSuccess estimateLabel={
      estimate.ok
        ? `${formatEuro(estimate.low)} – ${formatEuro(estimate.high)}`
        : null
    } />;
  }

  const current = STEPS[step - 1];
  const stepProps: StepProps = { state, set, toggleIn, errors };

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_22rem] lg:items-start lg:gap-10">
      <form onSubmit={handleSubmit} noValidate className="relative order-none">
        {/* indicatorul de pas — instrument, nu bară de progres decorativă */}
        <ol className="flex flex-wrap gap-x-5 gap-y-2 border-b border-line pb-4">
          {STEPS.map((item, index) => {
            const number = index + 1;
            const done = number < step;
            const active = number === step;
            return (
              <li key={item.code} className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className={cn(
                    "inline-block size-1.5 rounded-full transition-colors duration-150",
                    active ? "bg-accent" : done ? "bg-accent/40" : "bg-line"
                  )}
                />
                <span
                  aria-current={active ? "step" : undefined}
                  className={cn(
                    "font-mono text-[11px] tracking-[0.16em] transition-colors duration-150",
                    active ? "text-fg" : "text-muted"
                  )}
                >
                  {String(number).padStart(2, "0")} {item.short.toUpperCase()}
                </span>
              </li>
            );
          })}
        </ol>

        {hydrated && restored && !dismissedRestore ? (
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-md border border-accent/40 bg-accent/5 px-4 py-3">
            <p className="text-sm text-fg">
              Am găsit brief-ul început mai devreme. Am completat răspunsurile
              tale.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  clear();
                  setStep(1);
                  setDismissedRestore(true);
                }}
                className="text-sm text-muted underline-offset-4 transition-colors duration-150 hover:text-fg hover:underline"
              >
                Începe din nou
              </button>
              <button
                type="button"
                onClick={() => setDismissedRestore(true)}
                className="text-sm text-accent underline-offset-4 transition-colors duration-150 hover:underline"
              >
                Continuă
              </button>
            </div>
          </div>
        ) : null}

        <h2
          ref={headingRef}
          tabIndex={-1}
          className="mt-8 font-display text-3xl tracking-tight outline-none sm:text-4xl"
        >
          <span className="font-mono text-sm tracking-[0.2em] text-muted">
            {current.code}
          </span>
          <span className="mt-2 block">{current.title}</span>
        </h2>

        <p aria-live="polite" className="sr-only">
          Pasul {step} din {TOTAL}: {current.title}
        </p>

        <div className="mt-8">
          {step === 1 ? <StepType {...stepProps} /> : null}
          {step === 2 ? <StepComposition {...stepProps} /> : null}
          {step === 3 ? <StepContext {...stepProps} /> : null}
          {step === 4 ? <StepBudget {...stepProps} /> : null}
          {step === 5 ? <StepContact {...stepProps} /> : null}
        </div>

        <Honeypot value={website} onChange={setWebsite} />

        {formError ? (
          <p role="alert" className="mt-6 text-sm text-red-400">
            {formError}
          </p>
        ) : null}

        <div className="mt-10 flex flex-wrap items-center gap-4 border-t border-line pt-6">
          {step > 1 ? (
            <Button type="button" variant="secondary" onClick={goBack}>
              Înapoi
            </Button>
          ) : null}
          <Button type="submit" disabled={submitting}>
            {submitting
              ? t("states.submitting")
              : step === TOTAL
                ? "Trimite brief-ul"
                : "Continuă"}
          </Button>
          <p className="font-mono text-[11px] tracking-[0.16em] text-muted">
            PASUL {String(step).padStart(2, "0")} / {String(TOTAL).padStart(2, "0")}
          </p>
        </div>
      </form>

      <CalibrationReadout
        rows={{
          type: state.type,
          screens: state.screens,
          features: state.features,
          integrations: state.integrations,
          languages: state.languages,
          maintenance: state.maintenance,
        }}
        estimate={estimate}
        step={step}
        totalSteps={TOTAL}
        className="order-first lg:sticky lg:top-24 lg:order-none"
      />
    </div>
  );
}

function BriefSuccess({ estimateLabel }: { estimateLabel: string | null }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="status"
      aria-live="polite"
      className="rounded-md border border-accent bg-surface p-6 outline-none sm:p-8"
    >
      <p className="font-mono text-[11px] tracking-[0.24em] text-accent">
        ■ BRIEF ÎNREGISTRAT
      </p>
      <h2 className="mt-4 font-display text-3xl tracking-tight sm:text-4xl">
        Brief trimis.
      </h2>
      {estimateLabel ? (
        <p className="mt-3 text-muted">
          Intervalul pe care l-ai văzut ({estimateLabel}) a plecat împreună cu
          brief-ul. Îl recalibrăm cu tine, nu îl folosim ca ofertă.
        </p>
      ) : null}
      <ol className="mt-7 space-y-4">
        {[
          "Îl citim în aceeași zi lucrătoare. Dacă ceva e neclar, primești o singură rundă de întrebări — nu un chestionar nou.",
          "În maximum 2 zile lucrătoare primești propunerea scrisă: soluția, etapele, intervalul de preț și termenul realist.",
          "Dacă proiectul nu e pentru noi, îți spunem direct și îți recomandăm pe cineva. E mai ieftin pentru amândoi decât un proiect prost potrivit.",
        ].map((line, index) => (
          <li key={line} className="flex gap-4 text-fg/85">
            <span
              aria-hidden="true"
              className="mt-0.5 font-mono text-xs tracking-[0.18em] text-accent-2"
            >
              {String(index + 1).padStart(2, "0")}
            </span>
            <span className="text-pretty">{line}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
