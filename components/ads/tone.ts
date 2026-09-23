/**
 * Vocabularul vizual al portalului de reclame.
 *
 * Portalul stă în scope-ul neutru al panoului (`data-scope="gate"`): e o
 * unealtă a agenției, nu a unei lumi. Culorile de aici au UN sens fiecare:
 *
 *   roșu      — blochează crearea (eroare)
 *   chihlimbar — nu blochează, dar citește (avertisment) și banii clienților
 *   verde     — gata de creat
 *
 * Chihlimbarul apare și pe spațiile „Clienți" intenționat: e aceeași
 * instrucțiune — atenție, nu sunt banii noștri.
 */

/** Câmpurile de formular — aceeași formă ca în panoul de lead-uri. */
export const FIELD =
  "block w-full rounded-panel-sm border border-hair bg-ink/60 px-3.5 text-[15px] text-bone placeholder:text-dim transition-colors duration-150 focus:border-hair-strong";

export const FIELD_INVALID = "!border-[#ff6b6b]/70 bg-[#ff6b6b]/[0.06]";

export const ERROR_TEXT = "text-[#ff8a8a]";
export const WARNING_TEXT = "text-[#f5c451]";
export const OK_TEXT = "text-[#4fd6a5]";

export const ERROR_DOT = "bg-[#ff6b6b]";
export const WARNING_DOT = "bg-[#f0b429]";
export const OK_DOT = "bg-[#1fb583]";

/** Eticheta mono mică de deasupra unui câmp. */
export const LABEL = "eyebrow !text-[11.5px] !tracking-[0.18em]";
