import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { Reveal } from "@/components/ui/reveal";
import { cn } from "@/lib/utils";

/**
 * CTA-urile diviziei SOFTWARE (FAZA 4).
 *
 * DE CE NU folosim `buttonClasses({ variant: "primary" })` aici:
 * pe paleta software, `--accent-contrast` e alb pe `--s-signal` (#4C7DFF),
 * ceea ce dă 3.69:1 — sub AA pentru text normal. Cu `--s-ink` pe signal
 * urcăm la 5.36:1. `components/ui/button.tsx` e înghețat, deci nu-l atingem;
 * cererea de corectare a tokenului e depusă în PLAN.md (F7).
 * Când tokenul se repară, clasele astea rămân valide.
 */

const ctaBase =
  "inline-flex items-center justify-center gap-2 rounded-md font-body font-semibold " +
  "transition-[background-color,border-color,color] duration-150 select-none";

const ctaSizes = {
  sm: "h-9 px-3.5 text-sm",
  md: "h-11 px-5 text-base",
  lg: "h-12 px-6 text-base",
} as const;

export function softwareCtaClasses({
  variant = "primary",
  size = "md",
  className,
}: {
  variant?: "primary" | "secondary";
  size?: keyof typeof ctaSizes;
  className?: string;
} = {}) {
  return cn(
    ctaBase,
    ctaSizes[size],
    variant === "primary"
      ? "bg-s-signal text-s-ink hover:bg-[#6b93ff] active:bg-[#3f6ce6]"
      : "border border-line bg-transparent text-fg hover:border-muted hover:bg-surface",
    className
  );
}

export interface CtaAction {
  label: string;
  href: string;
}

/**
 * Banda de final de pagină. Panou de instrument: chenar, citire mono,
 * două căi de acțiune. Fără gradient, fără ilustrație — clientul de
 * software vrea următorul pas, nu o poză.
 */
export function CtaPanel({
  code,
  title,
  lead,
  primary,
  secondary,
  aside,
  id,
}: {
  code: string;
  title: string;
  lead: string;
  primary: CtaAction;
  secondary?: CtaAction;
  /** Rând de informație utilă sub butoane (termen de răspuns etc.). */
  aside?: ReactNode;
  id?: string;
}) {
  return (
    <Section id={id} spacing="md">
      <Container>
        <Reveal duration={320}>
          <div className="relative overflow-hidden rounded-lg border border-line bg-surface">
            {/* colțarele de cadru — motivul de instrument, nu ornament */}
            <span
              aria-hidden="true"
              className="absolute left-0 top-0 size-3 border-l-2 border-t-2 border-accent"
            />
            <span
              aria-hidden="true"
              className="absolute bottom-0 right-0 size-3 border-b-2 border-r-2 border-accent"
            />

            <div className="grid gap-8 p-8 sm:p-12 lg:grid-cols-[1.4fr_1fr] lg:items-end lg:gap-12">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-accent-2">
                  {code}
                </p>
                <p className="mt-4 text-balance font-display text-3xl font-semibold tracking-tight sm:text-4xl">
                  {title}
                </p>
                <p className="mt-4 max-w-xl text-pretty text-fg/75">{lead}</p>
              </div>

              <div className="flex flex-col gap-3">
                <Link
                  href={primary.href}
                  className={softwareCtaClasses({ size: "lg" })}
                >
                  {primary.label}
                </Link>
                {secondary ? (
                  <Link
                    href={secondary.href}
                    className={softwareCtaClasses({
                      variant: "secondary",
                      size: "lg",
                    })}
                  >
                    {secondary.label}
                  </Link>
                ) : null}
                {aside ? (
                  <p className="mt-1 font-mono text-[11px] leading-relaxed tracking-wide text-muted">
                    {aside}
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        </Reveal>
      </Container>
    </Section>
  );
}
