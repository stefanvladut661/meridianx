/* ============================================================
   Tokenii TableX, copiați din src/index.css al aplicației reale.

   Panoul restaurantului e mereu luminos (60-30-10: slate 50,
   sidebar navy, accent albastru royal). Harta sălii e mereu pe
   tema închisă — așa arată și în produs: planul se citește de la
   distanță, în sală, iar tableta nu aruncă lumină albă.
   ============================================================ */

/** Panoul (tema luminoasă). */
export const L = {
  bg: "#f8fafc",
  fg: "#0f172a",
  card: "#ffffff",
  border: "#e2e8f0",
  muted: "#f1f5f9",
  mutedFg: "#475569",
  primary: "#1d4ed8",
  primaryHover: "#1e40af",
  primaryFg: "#ffffff",
  secondary: "#e2e8f0",
  secondaryFg: "#1e293b",
  accent: "#eff6ff",
  accentFg: "#1e40af",
  destructive: "#ef4444",
  destructiveText: "#b91c1c",

  sidebar: "#1e293b",
  sidebarFg: "#e2e8f0",
  sidebarPrimary: "#60a5fa",
  sidebarAccent: "#334155",
  sidebarAccentFg: "#f8fafc",
  sidebarBorder: "#334155",

  liber: "#10b981",
  liberFg: "#052e1f",
  liberSoft: "#d1fae5",
  liberText: "#047857",
  ocupat: "#ef4444",
  ocupatSoft: "#fee2e2",
  ocupatText: "#b91c1c",
  expirare: "#f59e0b",
  expirareFg: "#451a03",
  expirareSoft: "#fef3c7",
  expirareText: "#92400e",
  eveniment: "#8b5cf6",
  evenimentSoft: "#ede9fe",
  evenimentText: "#6d28d9",
  inactiv: "#94a3b8",
  inactivSoft: "#f1f5f9",

  rezervare: "#f97316",
  rezervareFg: "#9a3412",
  rezervareSoft: "#ffedd5",
  walkin: "#10b981",
  walkinFg: "#065f46",
  walkinSoft: "#d1fae5",

  chart1: "#2a78d6",
  chart2: "#eb6834",
  chart3: "#1baf7a",
  chart4: "#eda100",
  chart5: "#64748b",
} as const;

/** Harta sălii și bara orară (tema închisă, `.dark` din aplicație). */
export const D = {
  bg: "#090d16",
  fg: "#f8fafc",
  card: "#0f172a",
  border: "#1e293b",
  muted: "#1e293b",
  mutedFg: "#94a3b8",
  primary: "#60a5fa",
  primaryFg: "#0c1e3a",

  exterior: "#05080f",
  canvas: "#0f172a",
  grid: "#1e293b",
  perete: "#cbd5e1",
  usa: "#64748b",
  bar: "#94a3b8",
  zonaSpeciala: "#334155",
  planta: "#4ade80",
  piscina: "#7dd3fc",
  selectie: "#60a5fa",
  scaun: "#94a3b8",
} as const;

export type StatusMasa = "liber" | "ocupat" | "expirare" | "eveniment" | "inactiv";

/** Traffic Light pe harta închisă: umplere soft + contur saturat. */
export const STATUS_HARTA: Record<StatusMasa, { fill: string; stroke: string }> = {
  liber: { fill: "#064e3b", stroke: "#10b981" },
  ocupat: { fill: "#7f1d1d", stroke: "#ef4444" },
  expirare: { fill: "#78350f", stroke: "#f59e0b" },
  eveniment: { fill: "#4c1d95", stroke: "#8b5cf6" },
  inactiv: { fill: "#1e293b", stroke: "#475569" },
};

export const ETICHETA_STATUS_MASA: Record<StatusMasa, string> = {
  liber: "Liberă",
  ocupat: "Ocupată",
  expirare: "Se eliberează",
  eveniment: "Eveniment",
  inactiv: "Indisponibilă",
};

export const FONT = {
  sans: "var(--font-switzer), 'Inter', ui-sans-serif, system-ui, sans-serif",
  display: "var(--font-satoshi), var(--font-switzer), ui-sans-serif, system-ui, sans-serif",
  mono: "var(--font-plexmono), ui-monospace, SFMono-Regular, Menlo, monospace",
} as const;
