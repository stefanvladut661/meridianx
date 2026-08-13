"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Honeypot } from "./honeypot";
import { FormSuccess } from "./form-success";
import { useLeadSubmit } from "./use-lead-submit";

/**
 * Lead magnet-ul paginii de reclame (FAZA 3): auditul gratuit.
 *
 * Patru câmpuri, dintre care trei obligatorii — atât cât să putem
 * deschide conturile și să spunem ceva util la telefon. Orice câmp în
 * plus e un motiv în plus să nu-l completeze.
 */

// i18n: tot copy-ul din acest fișier e RO hardcodat — F7 îl extrage
const PLATFORMS = [
  { id: "meta", label: "Meta (Facebook + Instagram)" },
  { id: "google", label: "Google (Search, YouTube, Demand Gen)" },
  { id: "tiktok", label: "TikTok" },
  { id: "linkedin", label: "LinkedIn" },
  { id: "niciuna", label: "Nu rulez nimic acum" },
] as const;

const BUDGETS = [
  "Sub 1.000 € pe lună",
  "1.000–3.000 € pe lună",
  "3.000–10.000 € pe lună",
  "Peste 10.000 € pe lună",
  "Încă nu am buget alocat",
] as const;

const VISIBLE_FIELDS = ["name", "phone", "projectType", "budgetRange"] as const;

export function AuditForm({ className }: { className?: string }) {
  const t = useTranslations("forms");
  const { status, fieldErrors, formError, submit } = useLeadSubmit();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [budget, setBudget] = useState("");
  const [website, setWebsite] = useState("");
  const [localErrors, setLocalErrors] = useState<Record<string, string>>({});

  const submitting = status === "submitting";

  function togglePlatform(id: string) {
    setPlatforms((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    // Obligatoriile le verificăm aici, ca mesajul să cadă pe câmpul
    // corect; formatele le validează schema FAZEI 0 prin hook.
    const errors: Record<string, string> = {};
    if (!name.trim()) errors.name = t("errors.required");
    if (!phone.trim()) errors.phone = t("errors.required");
    if (platforms.length === 0) errors.platforms = t("errors.required");
    setLocalErrors(errors);
    if (Object.keys(errors).length > 0) return;

    const selected = PLATFORMS.filter((platform) =>
      platforms.includes(platform.id)
    )
      .map((platform) => platform.label.split(" (")[0])
      .join(", ");

    await submit(
      {
        source: "video-audit",
        name,
        phone,
        projectType: `Audit campanii · ${selected}`.slice(0, 80),
        budgetRange: budget || undefined,
        website,
      },
      VISIBLE_FIELDS
    );
  }

  if (status === "success") {
    return (
      <FormSuccess
        className={className}
        context="audit"
        title="Audit cerut."
        steps={[
          "Ne uiți conturile pe care le-ai bifat și scoatem cifrele care contează: cost per rezultat, frecvență, vechimea creativelor.",
          "Te sunăm în maximum 24 de ore lucrătoare, la numărul lăsat. Durează 20 de minute și nu e un call de vânzare deghizat.",
          "Primești în scris ce am găsit — inclusiv părțile în care nu avem ce îmbunătăți. Dacă tot ce faci e în regulă, îți spunem asta.",
        ]}
      />
    );
  }

  const errorFor = (field: string) => localErrors[field] ?? fieldErrors[field];

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className={cn(
        "relative rounded-md border border-line bg-surface/60 p-6 sm:p-8",
        className
      )}
    >
      <p className="font-mono text-[11px] tracking-[0.28em] text-accent-2">
        FIȘĂ DE AUDIT · 4 CÂMPURI
      </p>
      <h3 className="mt-4 font-display text-3xl tracking-tight sm:text-4xl">
        Îți citim campaniile. Gratuit.
      </h3>
      <p className="mt-3 text-pretty text-fg/70">
        Ne uităm la ce rulezi acum și îți spunem unde se duc banii degeaba. Fără
        obligații și fără prezentare de 40 de slide-uri.
      </p>

      <div className="mt-8 space-y-6">
        <Field label="Nume" required error={errorFor("name")}>
          {(props) => (
            <Input
              {...props}
              name="name"
              autoComplete="name"
              placeholder="Cum te strigăm la telefon"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          )}
        </Field>

        <Field
          label="Telefon"
          required
          error={errorFor("phone")}
          hint="Te sunăm, nu te înscriem la newsletter."
        >
          {(props) => (
            <Input
              {...props}
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="07xx xxx xxx"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
            />
          )}
        </Field>

        <fieldset
          aria-describedby={
            errorFor("platforms") ? "mv-platforms-error" : undefined
          }
        >
          <legend className="text-sm font-medium text-fg">
            Ce rulezi acum
            <span aria-hidden="true" className="ml-0.5 text-accent">
              *
            </span>
          </legend>
          <div className="mt-3 flex flex-wrap gap-2">
            {PLATFORMS.map((platform) => {
              const checked = platforms.includes(platform.id);
              return (
                <label
                  key={platform.id}
                  className={cn(
                    "cursor-pointer rounded-xs border px-3 py-2 text-sm transition-colors duration-150",
                    // checkbox-ul e sr-only, deci inelul de focus trebuie
                    // mutat pe etichetă — altfel navigarea la tastatură
                    // trece prin chip-uri fără să se vadă unde ești
                    "has-[:focus-visible]:[outline:2px_solid_var(--focus-ring)] has-[:focus-visible]:[outline-offset:2px]",
                    checked
                      ? "border-accent bg-accent text-accent-contrast"
                      : "border-line text-fg/80 hover:border-muted"
                  )}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={checked}
                    onChange={() => togglePlatform(platform.id)}
                  />
                  {platform.label}
                </label>
              );
            })}
          </div>
          {errorFor("platforms") ? (
            <p
              id="mv-platforms-error"
              role="alert"
              className="mt-2 text-sm text-red-400"
            >
              {errorFor("platforms")}
            </p>
          ) : null}
        </fieldset>

        <Field label="Buget lunar de media" error={errorFor("budgetRange")}>
          {(props) => (
            <Select
              {...props}
              name="budgetRange"
              value={budget}
              onChange={(event) => setBudget(event.target.value)}
            >
              <option value="">Alege un interval</option>
              {BUDGETS.map((range) => (
                <option key={range} value={range}>
                  {range}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>

      <Honeypot value={website} onChange={setWebsite} />

      {formError ? (
        <p role="alert" className="mt-6 text-sm text-red-400">
          {formError}
        </p>
      ) : null}

      <div className="mt-8 flex flex-wrap items-center gap-4">
        <Button type="submit" size="lg" disabled={submitting}>
          {submitting ? t("states.submitting") : "Cere auditul"}
        </Button>
        <p className="text-sm text-fg/60">
          Răspundem în maximum 24 de ore lucrătoare.
        </p>
      </div>

      <p aria-live="polite" className="sr-only">
        {submitting ? t("states.submitting") : ""}
      </p>
    </form>
  );
}
