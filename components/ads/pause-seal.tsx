import { cn } from "@/lib/utils";

/**
 * Semnul portalului: pauza.
 *
 * Regula care nu se negociază — portalul creează campanii DOAR oprite —
 * e singurul lucru de pe ecran care trebuie să se vadă de la un metru.
 * Restul interfeței stă cuminte; aici se cheltuie îndrăzneala paginii.
 *
 * Glifa: cele două bare ale pauzei, într-un arc de meridian deschis —
 * firul comun al mărcii, rupt acolo unde ar începe mișcarea.
 */
export function PauseGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden className={className}>
      <path
        d="M52.5 17.5A24 24 0 1 0 56 32"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.45"
      />
      <rect x="23" y="20" width="6" height="24" rx="1.5" fill="currentColor" />
      <rect x="35" y="20" width="6" height="24" rx="1.5" fill="currentColor" />
    </svg>
  );
}

export function PauseSeal({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative flex items-center gap-4 overflow-hidden rounded-panel-lg border border-hair-strong bg-char px-5 py-5 sm:gap-6 sm:px-7",
        className
      )}
    >
      <PauseGlyph className="h-14 w-14 shrink-0 text-bone sm:h-[4.5rem] sm:w-[4.5rem]" />
      <div className="min-w-0">
        <p className="font-md-display text-[1.75rem] font-semibold leading-none tracking-tight text-bone sm:text-[2.25rem]">
          Se creează oprită.
        </p>
        <p className="mt-2 text-[14px] leading-snug text-bone/70">
          Portalul nu are niciun buton care pornește o campanie. O activezi tu, din Ads Manager,
          după ce o verifici acolo.
        </p>
      </div>
      <span
        aria-hidden
        className="absolute right-4 top-3 hidden font-md-mono text-[10.5px] tracking-[0.22em] text-dim sm:block"
      >
        STATUS · PAUSED
      </span>
    </div>
  );
}
