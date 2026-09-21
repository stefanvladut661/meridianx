/**
 * Inelul de chei — semnătura vault-ului (feat/vault, faza 2).
 *
 * Aceeași geometrie ca arcul de meridian de pe poartă și din admin:
 * cercul, cele două geodezice (albastru video, verde software) și
 * punctele de la poli. Aici punctul de la polul nord DESCRIE cercul cât
 * timp rulează ceva greu — Argon2id, în principal. Nu e un spinner
 * lipit peste un formular: e firul comun al agenției, pus la treabă.
 *
 * Sub `prefers-reduced-motion`, plasa globală din globals.css oprește
 * animația; rămâne inelul static, iar contorul de secunde de sub el
 * spune tot ce spunea mișcarea.
 */

const ARC_LEFT = "M160 10 C 62 72, 62 248, 160 310";
const ARC_RIGHT = "M160 10 C 258 72, 258 248, 160 310";

export function KeyRing({
  spinning,
  className = "",
}: {
  spinning: boolean;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 320 320"
      className={className}
      fill="none"
      aria-hidden
      role="presentation"
    >
      <circle cx="160" cy="160" r="150" stroke="currentColor" strokeOpacity="0.16" strokeWidth="1" />
      <path d={ARC_LEFT} stroke="#2f5bff" strokeOpacity="0.85" strokeWidth="1.5" />
      <path d={ARC_RIGHT} stroke="#1fb583" strokeOpacity="0.85" strokeWidth="1.5" />
      <line x1="10" y1="160" x2="310" y2="160" stroke="currentColor" strokeOpacity="0.1" strokeWidth="1" />
      <circle cx="160" cy="310" r="3" fill="currentColor" fillOpacity="0.9" />

      {/* Punctul care circulă: grupul se rotește în jurul centrului;
          punctul stă pe cerc, la polul nord. */}
      <g
        className={spinning ? "animate-spin" : ""}
        style={{ transformOrigin: "50% 50%", transformBox: "view-box", animationDuration: "2.4s" }}
      >
        <circle cx="160" cy="10" r="3" fill="currentColor" fillOpacity="0.9" />
        {spinning ? (
          <circle cx="160" cy="10" r="8" fill="currentColor" fillOpacity="0.14" />
        ) : null}
      </g>
    </svg>
  );
}
