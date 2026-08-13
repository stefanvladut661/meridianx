/**
 * Honeypot-ul comun (FAZA 3) — contractul FAZEI 0: câmpul se numește
 * `website` și trebuie să rămână gol.
 *
 * Nu folosim `display:none` pe input: boturile îl ignoră. Îl scoatem
 * din cadru cu poziționare, îl ascundem de cititoarele de ecran cu
 * aria-hidden și îl scoatem din ordinea de tab.
 */
export function Honeypot({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute -left-[9999px] top-0 h-px w-px overflow-hidden opacity-0"
    >
      <label htmlFor="mv-website">Site web</label>
      <input
        id="mv-website"
        name="website"
        type="text"
        tabIndex={-1}
        autoComplete="off"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
