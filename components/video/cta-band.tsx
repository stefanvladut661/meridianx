import { Link } from "@/i18n/navigation";
import { buttonClasses } from "@/components/ui/button";
import { Container } from "@/components/ui/container";

/**
 * Banda de CTA final a paginilor video (FAZA 2). Un singur gest:
 * titlu mare, un buton primar, opțional o rută secundară în mono.
 * Glow-urile tungsten/daylight din colțuri țin banda în lumea video
 * fără să concureze cu signature-ul paginii.
 */
export interface CtaBandProps {
  /** Marcajul mono de deasupra titlului (ex. „CADRUL URMĂTOR”). */
  slate: string;
  title: string;
  lead?: string;
  cta: { label: string; href: string };
  secondary?: { label: string; href: string };
}

export function CtaBand({ slate, title, lead, cta, secondary }: CtaBandProps) {
  return (
    <section className="relative overflow-hidden border-t border-line">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(60%_120%_at_10%_100%,rgba(255,140,59,0.14),transparent_60%),radial-gradient(50%_120%_at_90%_0%,rgba(67,201,224,0.11),transparent_60%)]"
      />
      <Container className="relative py-20 sm:py-28">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-fg/60">
          {slate}
        </p>
        <h2 className="mt-5 max-w-3xl text-balance font-display text-4xl tracking-tight sm:text-6xl">
          {title}
        </h2>
        {lead ? (
          <p className="mt-5 max-w-2xl text-pretty text-lg text-fg/70">{lead}</p>
        ) : null}
        <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-4">
          <Link href={cta.href} className={buttonClasses({ size: "lg" })}>
            {cta.label}
          </Link>
          {secondary ? (
            <Link
              href={secondary.href}
              className="font-mono text-sm tracking-wider text-fg/70 underline-offset-4 transition-colors hover:text-fg hover:underline"
            >
              {secondary.label} →
            </Link>
          ) : null}
        </div>
      </Container>
    </section>
  );
}
