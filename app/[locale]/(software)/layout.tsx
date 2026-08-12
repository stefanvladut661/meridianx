/**
 * Scope-ul lumii SOFTWARE (FAZA 0 a creat fișierul; FAZA 1 îl deține
 * pentru integrarea shell-ului — header software, linia meridian, footer).
 *
 * data-world="software" fixează tokens-ii semantici pe paleta
 * blueprint (signal/data). Fără Lenis, fără cursor custom aici — vezi
 * CLAUDE.md §2. Nu seta culori brute --v-* aici.
 */
export default function SoftwareWorldLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div data-world="software" className="min-h-dvh bg-bg text-fg">
      {children}
    </div>
  );
}
