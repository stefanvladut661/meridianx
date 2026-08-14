"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Honeypot } from "./honeypot";
import { useLeadSubmit } from "./use-lead-submit";

/**
 * Lead magnet: ghidul în PDF, deschis cu un email (FAZA 5).
 *
 * PDF-ul din `public/software/` e PLACEHOLDER — fișier real, valid, ca
 * să nu existe link mort, dar conținutul se scrie înainte de lansare
 * (CLAUDE.md §5). Marcajul e vizibil pentru vizitator, nu ascuns în cod.
 *
 * Gate-ul cere un singur câmp. Orice câmp în plus pe un lead magnet e
 * un motiv în plus să nu-l completeze.
 */

const GUIDE_URL = "/software/ghid-modernizare-placeholder.pdf";

export function GatedGuide({ className }: { className?: string }) {
  const t = useTranslations("forms");
  const { status, fieldErrors, formError, submit } = useLeadSubmit();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");
  const [localErrors, setLocalErrors] = useState<Record<string, string>>({});

  const submitting = status === "submitting";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const next: Record<string, string> = {};
    if (!name.trim()) next.name = t("errors.required");
    if (!email.trim()) next.email = t("errors.required");
    setLocalErrors(next);
    if (Object.keys(next).length > 0) return;

    await submit(
      {
        source: "software-ghid",
        name,
        email,
        projectType: "Descărcare ghid modernizare",
        website,
      },
      ["name", "email"]
    );
  }

  const errorFor = (field: string) => localErrors[field] ?? fieldErrors[field];

  return (
    <div
      className={cn(
        "flex flex-col rounded-md border border-line bg-surface p-6 sm:p-7",
        className
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <p className="font-mono text-[11px] tracking-[0.24em] text-accent">
          {/* i18n: (tot copy-ul din fișier) */}
          GHID · PDF
        </p>
        <span className="rounded-xs border border-accent-2/40 px-2 py-0.5 font-mono text-[10px] tracking-[0.18em] text-accent-2">
          PLACEHOLDER
        </span>
      </div>

      <h3 className="mt-4 font-display text-2xl tracking-tight">
        Ghid de modernizare digitală
      </h3>
      <p className="mt-3 flex-1 text-pretty text-sm text-muted">
        Ce măsori înainte să cumperi software, ce se automatizează primul, cum
        arată un buget realist pe fiecare tip de proiect și ce ține de furnizor
        când proiectul e finanțat.
      </p>

      {status === "success" ? (
        <div role="status" aria-live="polite" className="mt-6">
          <p className="font-mono text-[11px] tracking-[0.24em] text-accent">
            ■ GHID DEBLOCAT
          </p>
          <p className="mt-3 text-sm text-fg">
            Îl găsești și în email, ca să nu-l pierzi când închizi pagina.
          </p>
          <a
            href={GUIDE_URL}
            download
            className="mt-4 inline-flex items-center gap-2 text-accent underline-offset-4 hover:underline"
          >
            Descarcă ghidul (PDF)
            <span aria-hidden="true">↓</span>
          </a>
          <p className="mt-3 text-xs text-muted">
            Versiunea de acum e un schelet marcat ca atare — conținutul complet
            se publică înainte de lansare. Nu-ți trimitem un fișier gol fără să
            îți spunem.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate className="relative mt-6 space-y-4">
          <Field label="Nume" required error={errorFor("name")}>
            {(props) => (
              <Input
                {...props}
                autoComplete="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            )}
          </Field>
          <Field label="Email" required error={errorFor("email")}>
            {(props) => (
              <Input
                {...props}
                type="email"
                autoComplete="email"
                placeholder="nume@firma.ro"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            )}
          </Field>

          <Honeypot value={website} onChange={setWebsite} id="ms-website-guide" />

          {formError ? (
            <p role="alert" className="text-sm text-red-400">
              {formError}
            </p>
          ) : null}

          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? t("states.submitting") : "Trimite-mi ghidul"}
          </Button>
          <p className="text-xs text-muted">
            Un email cu ghidul. Fără serie de mesaje de vânzare după.
          </p>
        </form>
      )}
    </div>
  );
}
