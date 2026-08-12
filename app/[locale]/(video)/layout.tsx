/**
 * Scope-ul lumii VIDEO (FAZA 0 a creat fișierul; FAZA 1 îl deține
 * pentru integrarea shell-ului — header video, HUD, footer).
 *
 * data-world="video" remapează tokens-ii semantici (--bg, --accent,
 * --font-display...) la paleta tungsten/daylight. Tot ce se randează
 * înăuntru — inclusiv primitivele din components/ui/ — preia automat
 * lumea video. Nu seta culori brute --s-* aici.
 */
export default function VideoWorldLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div data-world="video" className="min-h-dvh bg-bg text-fg">
      {children}
    </div>
  );
}
