/**
 * Marca MERIDIAN, redesenată vectorial după logo.jpeg:
 * inel întrerupt la 12 și 6 + chevron „<" în interior.
 * Sursa rasterizată rămâne în public/brand/meridian-logo.jpeg.
 */
export function Mark({
  className = "",
  size = 28,
}: {
  className?: string;
  size?: number;
}) {
  // Inel cu două goluri, la 12 și la 6.
  // Traseul unui <circle> pleacă de la ora 3 și merge în sens orar, deci
  // ora 6 e la c/4 iar ora 12 la 3c/4. Centrul primului gol din tipar cade
  // la (dash + gap/2); îl aducem peste c/4 prin dashoffset.
  const r = 38;
  const c = 2 * Math.PI * r;
  const gap = 12;
  const dash = c / 2 - gap;
  const offset = dash + gap / 2 - c / 4;

  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label="MERIDIAN"
      fill="none"
    >
      <circle
        cx="50"
        cy="50"
        r={r}
        stroke="currentColor"
        strokeWidth="7.5"
        strokeDasharray={`${dash} ${gap}`}
        strokeDashoffset={offset}
      />
      <path
        d="M67 27 L33.5 50 L67 73"
        stroke="currentColor"
        strokeWidth="8.5"
        strokeLinejoin="miter"
        strokeLinecap="butt"
      />
    </svg>
  );
}

export function Wordmark({
  className = "",
  size = 26,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <Mark size={size} />
      <span
        className="font-md-display text-[0.95em] font-semibold tracking-[0.2em]"
        style={{ letterSpacing: "0.2em" }}
      >
        MERIDIAN
      </span>
    </span>
  );
}
