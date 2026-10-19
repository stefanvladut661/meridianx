/* ------------------------------------------------------------
   SEMNELE DE DISCIPLINĂ — ce facem, fără să scriem.

   Desenate aici, în același limbaj: viewBox 24, contur 1.7, capete
   rotunde. O diafragmă pentru video (obiectiv, deci filmare) și trei
   noduri legate pentru software (sisteme care vorbesc între ele —
   exact pitch-ul de integrare din software-content.ts).

   Coordonatele diafragmei sunt trei coarde la 120° una de alta, la
   3.5 de centru pe un cerc de rază 9: așa rămâne o deschidere
   triunghiulară la mijloc, ca la un obiectiv real. Un triunghi
   înscris ar fi arătat a buton de „record".

   Folosite de toate cărțile de pe masă — color, metal, carton.
   ------------------------------------------------------------ */

export function Aperture({ size }: { size: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      aria-hidden
      className="shrink-0"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M3.71 8.5 H20.29" />
      <path d="M19.18 6.57 L10.89 20.93" />
      <path d="M13.11 20.93 L4.82 6.57" />
    </svg>
  );
}

export function SystemNodes({ size }: { size: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="shrink-0"
    >
      <path d="M12 5.5 L5 18 H19 Z" />
      <circle cx="12" cy="5.5" r="2.4" fill="currentColor" stroke="none" />
      <circle cx="5" cy="18" r="2.4" fill="currentColor" stroke="none" />
      <circle cx="19" cy="18" r="2.4" fill="currentColor" stroke="none" />
    </svg>
  );
}
