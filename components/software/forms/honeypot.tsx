/**
 * Honeypot-ul diviziei software (FAZA 5) — contractul FAZEI 0: câmpul
 * se numește `website` și trebuie să rămână gol.
 *
 * Nu `display:none` (boturile îl ignoră): îl scoatem din cadru prin
 * poziționare, din arborele de accesibilitate prin aria-hidden și din
 * ordinea de tab prin tabIndex.
 *
 * Duplicat conștient al celui din `components/video/forms/` — id
 * diferit, ca cele două formulare să poată coexista pe o pagină.
 * Candidat de deduplicare la F7.
 */
export function Honeypot({
  value,
  onChange,
  id = "ms-website",
}: {
  value: string;
  onChange: (value: string) => void;
  id?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute -left-[9999px] top-0 h-px w-px overflow-hidden opacity-0"
    >
      <label htmlFor={id}>Site web</label>
      <input
        id={id}
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
