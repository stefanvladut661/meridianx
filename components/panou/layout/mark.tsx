/** Marca din prototip: un „M” stilizat, în lavandă, într-un pătrat cu colțuri rotunjite. Fără stare, deci merge și în pagini de server. */
export function PanouMark({ size = "md" }: { size?: "sm" | "md" }) {
  const box = size === "sm" ? "h-8 w-8 rounded-[10px]" : "h-9 w-9 rounded-[11px]";
  const icon = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";
  return (
    <span className={`flex items-center justify-center border border-lav/25 bg-lav/10 ${box}`}>
      <svg viewBox="0 0 24 24" className={icon} aria-hidden="true">
        <path d="M5 18V7l7 7 7-7v11" fill="none" stroke="#C6B5FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}
