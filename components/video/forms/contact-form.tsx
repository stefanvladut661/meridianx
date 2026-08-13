"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { VideoSegment } from "@/content/types";
import { SEGMENT_LABELS, VIDEO_SEGMENTS } from "@/components/video/segments";
import { Honeypot } from "./honeypot";
import { FormSuccess } from "./form-success";
import { useLeadSubmit } from "./use-lead-submit";

/**
 * Formularul de ofertă al diviziei VIDEO (FAZA 3).
 *
 * Două câmpuri obligatorii, restul opționale: clientul de video decide
 * repede și abandonează formularele lungi. Tipurile de proiect sunt
 * exact segmentele din portofoliu (`components/video/segments.ts`), ca
 * omul să regăsească vocabularul cu care a intrat pe site.
 */

// i18n: copy RO hardcodat — F7 îl extrage
const OTHER_TYPES = [
  { id: "reclame", label: "Campanii și reclame" },
  { id: "altceva", label: "Altceva / încă nu știu" },
] as const;

const BUDGETS = [
  "Sub 3.000 €",
  "3.000–6.000 €",
  "6.000–10.000 €",
  "Peste 10.000 €",
  "Nu știu încă — ajutați-mă să estimez",
] as const;

const TIMELINES = [
  "Am nevoie în mai puțin de o lună",
  "În una–două luni",
  "În trimestrul următor",
  "Planific pentru mai târziu",
] as const;

const VISIBLE_FIELDS = [
  "name",
  "phone",
  "email",
  "projectType",
  "budgetRange",
  "timeline",
  "message",
] as const;

export interface ContactFormProps {
  /** Preselectează tipul de proiect (ex. venit din portofoliu cu ?tip=). */
  defaultSegment?: VideoSegment;
  className?: string;
}

export function ContactForm({ defaultSegment, className }: ContactFormProps) {
  const t = useTranslations("forms");
  const { status, fieldErrors, formError, submit } = useLeadSubmit();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [projectType, setProjectType] = useState<string>(
    defaultSegment ? SEGMENT_LABELS[defaultSegment] : ""
  );
  const [budget, setBudget] = useState("");
  const [timeline, setTimeline] = useState("");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState("");
  const [localErrors, setLocalErrors] = useState<Record<string, string>>({});

  const submitting = status === "submitting";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const errors: Record<string, string> = {};
    if (!name.trim()) errors.name = t("errors.required");
    if (!phone.trim()) errors.phone = t("errors.required");
    if (!projectType) errors.projectType = t("errors.required");
    setLocalErrors(errors);
    if (Object.keys(errors).length > 0) return;

    await submit(
      {
        source: "video-contact",
        name,
        phone,
        email: email || undefined,
        projectType,
        budgetRange: budget || undefined,
        timeline: timeline || undefined,
        message: message || undefined,
        website,
      },
      VISIBLE_FIELDS
    );
  }

  if (status === "success") {
    return (
      <FormSuccess
        className={className}
        context="contact"
        title="Ofertă cerută."
        steps={[
          "Citim ce ne-ai scris și pregătim întrebările care lipsesc — de obicei sunt trei.",
          "Te sunăm în maximum 2 ore lucrătoare. Dacă trimiți seara, dimineața ești primul pe listă.",
          "Primești oferta scrisă în 48 de ore de la call: livrabile, termene și preț fix, nu „de la”.",
        ]}
      />
    );
  }

  const errorFor = (field: string) => localErrors[field] ?? fieldErrors[field];

  return (
    <form
      id="formular"
      onSubmit={handleSubmit}
      noValidate
      className={cn(
        "relative rounded-md border border-line bg-surface/60 p-6 sm:p-8",
        className
      )}
    >
      <p className="font-mono text-[11px] tracking-[0.28em] text-accent-2">
        CERERE DE OFERTĂ · 2 CÂMPURI OBLIGATORII
      </p>
      <h3 className="mt-4 font-display text-3xl tracking-tight sm:text-4xl">
        Spune-ne ce filmăm.
      </h3>
      <p className="mt-3 text-pretty text-fg/70">
        Nu ai nevoie de un brief scris. Ai nevoie de un nume, un număr și o idee
        despre ce vrei să obții.
      </p>

      <div className="mt-8 grid gap-6 sm:grid-cols-2">
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

        <Field label="Telefon" required error={errorFor("phone")}>
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

        <Field
          label="Email"
          error={errorFor("email")}
          hint="Doar dacă preferi oferta în scris înainte de call."
        >
          {(props) => (
            <Input
              {...props}
              name="email"
              type="email"
              autoComplete="email"
              placeholder="nume@firma.ro"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          )}
        </Field>

        <Field label="Tip de proiect" required error={errorFor("projectType")}>
          {(props) => (
            <Select
              {...props}
              name="projectType"
              value={projectType}
              onChange={(event) => setProjectType(event.target.value)}
            >
              <option value="">Alege</option>
              {VIDEO_SEGMENTS.map((segment) => (
                <option key={segment} value={SEGMENT_LABELS[segment]}>
                  {SEGMENT_LABELS[segment]}
                </option>
              ))}
              {OTHER_TYPES.map((type) => (
                <option key={type.id} value={type.label}>
                  {type.label}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <Field label="Buget orientativ" error={errorFor("budgetRange")}>
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

        <Field label="Când ai nevoie de el" error={errorFor("timeline")}>
          {(props) => (
            <Select
              {...props}
              name="timeline"
              value={timeline}
              onChange={(event) => setTimeline(event.target.value)}
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

        <Field
          className="sm:col-span-2"
          label="Ce vrei să obții"
          error={errorFor("message")}
          hint="O propoziție e suficientă. „Vreau să vând mai repede apartamentele din blocul nou” ne spune mai mult decât un brief de trei pagini."
        >
          {(props) => (
            <Textarea
              {...props}
              name="message"
              rows={4}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
            />
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
          {submitting ? t("states.submitting") : "Cere ofertă"}
        </Button>
        <p className="text-sm text-fg/60">
          Te sunăm în maximum 2 ore lucrătoare.
        </p>
      </div>

      <p aria-live="polite" className="sr-only">
        {submitting ? t("states.submitting") : ""}
      </p>
    </form>
  );
}
