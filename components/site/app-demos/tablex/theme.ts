/* ============================================================
   Tokenii TableX, copiați din src/index.css al aplicației reale,
   după redesignul din 2 oct. 2026 („Cerneală pe hârtie, culoare
   doar în sală”, DESIGN.md).

   Panoul restaurantului e mereu luminos: hârtie caldă, foi albe,
   cerneală aproape neagră pentru acțiunea principală. Culoarea
   saturată înseamnă stare (Traffic Light, sursa rezervării, erori).
   Harta sălii e mereu pe fond de noapte — așa arată și în produs.
   ============================================================ */

/** Panoul (tema luminoasă, `:root` / `.tema-doar-light`). */
export const L = {
  bg: "#f8f8f6",
  fg: "#141413",
  card: "#ffffff",
  border: "#e5e3de",
  /** Conturul câmpurilor: un câmp se caută cu ochiul, un separator are voie să dispară. */
  input: "#d3d0c8",
  muted: "#f1f0ec",
  mutedFg: "#63615b",
  primary: "#141413",
  primaryHover: "#373736",
  primaryFg: "#fafaf8",
  secondary: "#eeede9",
  secondaryHover: "#e3e2de",
  secondaryFg: "#141413",
  accent: "#efeeea",
  accentFg: "#141413",
  destructive: "#c4352b",
  destructiveSoft: "#f9ebea",
  destructiveSoftHover: "#f3d7d5",

  sidebar: "#f2f1ed",
  sidebarFg: "#3d3c38",
  sidebarAccent: "#e8e6e1",
  sidebarAccentFg: "#141413",
  sidebarBorder: "#e3e1db",

  liber: "#1f9d69",
  liberFg: "#03251a",
  liberSoft: "#e2f3ea",
  liberText: "#0b5a3a",
  ocupat: "#c93b31",
  ocupatSoft: "#fae6e3",
  ocupatBorder: "#efc2bd",
  ocupatText: "#a8302a",
  expirare: "#e0950f",
  expirareFg: "#3a2300",
  expirareSoft: "#fcefd5",
  expirareText: "#7a4d00",
  eveniment: "#6f52d9",
  evenimentSoft: "#ece8fb",
  evenimentText: "#553bb8",
  inactiv: "#a19e97",
  inactivSoft: "#efeeea",

  rezervare: "#e2702a",
  rezervareFg: "#8a3a0c",
  rezervareSoft: "#fcebdf",
  walkin: "#1f9d69",
  walkinFg: "#0b5a3a",
  walkinSoft: "#e2f3ea",

  chart1: "#2a78d6",
  chart2: "#eb6834",
  chart3: "#1baf7a",
  chart4: "#eda100",
  chart5: "#77746d",
} as const;

/** Harta sălii, bara orară și scanerul (`.dark` din aplicație). */
export const D = {
  bg: "#0e0e0d",
  fg: "#edece8",
  card: "#161615",
  popover: "#1b1b1a",
  border: "#2a2a27",
  input: "#3d3c38",
  muted: "#1d1d1b",
  mutedFg: "#a19e97",
  secondary: "#23231f",
  /** În tema de noapte cerneala se inversează în „os”. */
  primary: "#edece8",
  primaryFg: "#141413",

  exterior: "#0a0a09",
  canvas: "#161615",
  grid: "#232321",
  perete: "#d9d7d1",
  usa: "#6e6c66",
  bar: "#9c9a93",
  zonaSpeciala: "#2e2d2a",
  planta: "#5bc27f",
  piscina: "#7cc4ea",
  /** Albastrul uneltei: selecția și semnul de mese unite — singurul albastru din sistem. */
  selectie: "#6e9bff",
  scaun: "#8e8b84",
} as const;

/** O singură familie de umbre, colorate cu cerneală (`--umbra-*`). */
export const UMBRA = {
  xs: "0 1px 1px rgba(20,20,19,.06)",
  sm: "0 1px 2px rgba(20,20,19,.06), 0 1px 1px rgba(20,20,19,.04)",
  md: "0 1px 2px rgba(20,20,19,.05), 0 4px 12px -2px rgba(20,20,19,.08)",
  lg: "0 2px 4px rgba(20,20,19,.04), 0 12px 32px -8px rgba(20,20,19,.16)",
  xl: "0 4px 8px rgba(20,20,19,.04), 0 24px 56px -12px rgba(20,20,19,.22)",
  /** Marginea unei foi: inel de cerneală la 7%, nu chenar. */
  inel: "0 0 0 1px rgba(20,20,19,.07)",
} as const;

export type StatusMasa = "liber" | "ocupat" | "expirare" | "eveniment" | "inactiv";

/** Traffic Light pe harta de noapte: umplere `-soft` + contur plin. */
export const STATUS_HARTA: Record<StatusMasa, { fill: string; stroke: string }> = {
  liber: { fill: "#12382a", stroke: "#3dbe86" },
  ocupat: { fill: "#46201c", stroke: "#ee6a60" },
  expirare: { fill: "#43300f", stroke: "#f0ae3c" },
  eveniment: { fill: "#2c2452", stroke: "#9c84f5" },
  inactiv: { fill: "#23231f", stroke: "#5f5d57" },
};

export const ETICHETA_STATUS_MASA: Record<StatusMasa, string> = {
  liber: "Liberă",
  ocupat: "Ocupată",
  expirare: "Se eliberează",
  eveniment: "Eveniment",
  inactiv: "Indisponibilă",
};

export const FONT = {
  sans: "var(--font-tx-sans), ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  display: "var(--font-tx-display), var(--font-tx-sans), ui-sans-serif, system-ui, sans-serif",
  /** Pagina publică: fontul stilului de formular ales de restaurant. */
  oaspete: "var(--font-tx-guest), ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
} as const;

/** Titlurile h1–h4: Display, strânse ca în produs. */
export const TITLU = { fontFamily: FONT.display, letterSpacing: "-0.022em" } as const;
