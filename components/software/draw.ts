import type { CSSProperties } from "react";

/**
 * Eșalonarea trasării diagramelor (FAZA 4).
 *
 * Stă în fișier propriu, FĂRĂ "use client": diagramele SVG sunt componente
 * de server (nu au nevoie de interactivitate), iar o funcție exportată
 * dintr-un modul client devine o referință client și nu poate fi apelată
 * la randare pe server.
 *
 * Se folosește ca `style={drawDelay(80)}` pe elementul desenat; valoarea
 * e citită de `SoftwareMotionStyles` prin `--draw-delay`.
 */
export function drawDelay(ms: number): CSSProperties {
  return { "--draw-delay": `${ms}ms` } as CSSProperties;
}
