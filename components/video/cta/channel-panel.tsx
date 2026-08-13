import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { calHref, instagramHref } from "./channels";

/**
 * Panoul de canale secundare (FAZA 3, divizia VIDEO).
 *
 * Vocabularul e cel al platoului: fiecare canal e o linie de patch cu
 * cod, latență reală și motivul pentru care ai alege-o. Eticheta spune
 * ceva adevărat („răspuns în minute”, „~2 ore”) — nu decorează.
 */

interface ChannelRow {
  code: string;
  label: string;
  latency: string;
  when: string;
  href: string;
  external: boolean;
}

export interface ChannelPanelProps {
  /** Ancora către formularul din pagină (ex. „#formular”). */
  formHref?: string;
  className?: string;
}

export function ChannelPanel({ formHref, className }: ChannelPanelProps) {
  const rows: ChannelRow[] = [];

  if (formHref) {
    rows.push({
      code: "CH.03",
      // i18n: (tot copy-ul din acest fișier)
      label: "Formular",
      latency: "RĂSPUNS ÎN ~2 ORE LUCRĂTOARE",
      when: "Ai deja detaliile proiectului și vrei o ofertă scrisă.",
      href: formHref,
      external: false,
    });
  }

  const cal = calHref();
  if (cal) {
    rows.push({
      code: "CH.04",
      label: "Call de descoperire",
      latency: "20 MIN · ÎN CALENDAR",
      when: "Vrei să vorbești cu un om înainte să ceri o ofertă.",
      href: cal,
      external: true,
    });
  }

  const instagram = instagramHref();
  if (instagram) {
    rows.push({
      code: "CH.05",
      label: "Instagram DM",
      latency: "RĂSPUNS ÎN CÂTEVA ORE",
      when: "Ai văzut un cadru la noi și vrei exact aia, pentru tine.",
      href: instagram,
      external: true,
    });
  }

  if (rows.length === 0) return null;

  return (
    <ul className={cn("divide-y divide-line border-y border-line", className)}>
      {rows.map((row) => {
        const content = (
          <>
            <span className="font-mono text-[11px] tracking-[0.28em] text-fg/60 sm:w-16 sm:shrink-0">
              {row.code}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-display text-2xl tracking-tight">
                {row.label}
                {row.external ? (
                  <span className="sr-only"> (se deschide în filă nouă)</span>
                ) : null}
              </span>
              <span className="mt-1 block text-sm text-fg/70">{row.when}</span>
            </span>
            <span className="font-mono text-[11px] tracking-[0.22em] text-accent-2 sm:w-64 sm:shrink-0 sm:text-right">
              {row.latency}
            </span>
            <span
              aria-hidden="true"
              className="hidden font-mono text-fg/60 transition-transform duration-200 group-hover:translate-x-1 sm:block"
            >
              →
            </span>
          </>
        );

        const rowClass =
          "group flex flex-col gap-2 py-6 transition-colors duration-150 hover:bg-surface/60 sm:flex-row sm:items-center sm:gap-6 sm:px-2";

        return (
          <li key={row.code}>
            {row.external ? (
              <a
                href={row.href}
                target="_blank"
                rel="noopener noreferrer"
                className={rowClass}
              >
                {content}
              </a>
            ) : row.href.startsWith("#") ? (
              <a href={row.href} className={rowClass}>
                {content}
              </a>
            ) : (
              <Link href={row.href} className={rowClass}>
                {content}
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );
}
