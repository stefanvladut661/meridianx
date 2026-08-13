import { cn } from "@/lib/utils";
import {
  phoneDisplay,
  phoneHref,
  whatsappHref,
  type ContactContext,
} from "./channels";

/**
 * Cele două canale de voce, la greutate maximă (FAZA 3, divizia VIDEO).
 *
 * Regula din CLAUDE.md §8: pe video, telefonul și WhatsApp-ul stau la
 * fel de proeminent ca formularul. Aici sunt două blocuri mari, nu două
 * linkuri într-un subsol.
 *
 * Canalele neconfigurate în env dispar — nu afișăm href="#".
 */
export interface VoiceCtaProps {
  context: ContactContext;
  /** Mesaj WhatsApp propriu, dacă pagina are unul mai bun decât cel de context. */
  whatsappMessage?: string;
  className?: string;
}

export function VoiceCta({
  context,
  whatsappMessage,
  className,
}: VoiceCtaProps) {
  const wa = whatsappHref(context, whatsappMessage);
  const tel = phoneHref();
  const telLabel = phoneDisplay();

  if (!wa && !tel) {
    if (process.env.NODE_ENV !== "production") {
      return (
        <p className={cn("font-mono text-xs text-accent-2", className)}>
          DEV · setează NEXT_PUBLIC_WHATSAPP_NUMBER și NEXT_PUBLIC_PHONE ca să
          apară canalele de voce.
        </p>
      );
    }
    return null;
  }

  return (
    <div className={cn("grid gap-4 sm:grid-cols-2", className)}>
      {wa ? (
        <a
          href={wa}
          target="_blank"
          rel="noopener noreferrer"
          className="group relative flex flex-col justify-between overflow-hidden rounded-md bg-accent p-6 text-accent-contrast transition-[filter] duration-150 hover:brightness-110 sm:p-7"
        >
          <span className="font-mono text-[11px] tracking-[0.28em] opacity-80">
            {/* i18n: */}
            CH.01 · WHATSAPP · RĂSPUNS ÎN MINUTE
          </span>
          <span className="mt-8 font-display text-3xl tracking-tight sm:text-4xl">
            {/* i18n: */}
            Scrie-ne acum
          </span>
          <span className="mt-2 text-sm opacity-80">
            {/* i18n: */}
            Mesajul e deja scris. Apeși, trimiți, vorbim.
            <span className="sr-only"> (se deschide în filă nouă)</span>
          </span>
          <span
            aria-hidden="true"
            className="mt-6 inline-block font-mono text-sm transition-transform duration-200 group-hover:translate-x-1"
          >
            →
          </span>
        </a>
      ) : null}

      {tel ? (
        <a
          href={tel}
          className="group relative flex flex-col justify-between overflow-hidden rounded-md border border-line bg-surface p-6 text-fg transition-colors duration-150 hover:border-accent-2 sm:p-7"
        >
          <span className="font-mono text-[11px] tracking-[0.28em] text-accent-2">
            {/* i18n: */}
            CH.02 · TELEFON · L–V 09:00–19:00
          </span>
          <span className="mt-8 font-display text-3xl tracking-tight sm:text-4xl">
            {/* i18n: */}
            Sună direct
          </span>
          <span className="mt-2 text-sm text-fg/70">
            {telLabel ? (
              <span className="font-mono tracking-wider">{telLabel}</span>
            ) : (
              /* i18n: */ "Un apel de trei minute lămurește cât zece emailuri."
            )}
          </span>
          <span
            aria-hidden="true"
            className="mt-6 inline-block font-mono text-sm text-fg/60 transition-transform duration-200 group-hover:translate-x-1"
          >
            →
          </span>
        </a>
      ) : null}
    </div>
  );
}
