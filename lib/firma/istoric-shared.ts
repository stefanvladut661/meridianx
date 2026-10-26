/** Zonele istoricului, cu numele din interfață. Fișier izomorf. */
export const ZONE = ["clienti", "facturi", "drive", "cheltuieli", "incasari", "contabil", "accese", "panou", "setari", "sistem"] as const;
export type Zona = (typeof ZONE)[number];

export const ZONA_LABEL: Record<Zona, string> = {
  clienti: "Clienți",
  facturi: "Facturi",
  drive: "Drive",
  cheltuieli: "Cheltuieli",
  incasari: "Încasări",
  contabil: "Contabil",
  accese: "Accese",
  panou: "Panou",
  setari: "Setări",
  sistem: "Sistem",
};

export function isZona(value: string | null | undefined): value is Zona {
  return Boolean(value) && (ZONE as readonly string[]).includes(value as string);
}
