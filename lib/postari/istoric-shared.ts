/** Zonele istoricului (și filtrele ecranului „Istoric”). Aceeași listă ca în migrarea 24. */
export const ZONE = ["drive", "plan", "coada", "instagram", "tiktok", "conturi", "setari", "sistem"] as const;
export type Zona = (typeof ZONE)[number];

export const ZONA_LABEL: Record<Zona, string> = {
  drive: "Drive",
  plan: "Planuri",
  coada: "Coada",
  instagram: "Instagram",
  tiktok: "TikTok",
  conturi: "Conturi",
  setari: "Setări",
  sistem: "Sistem",
};

export function isZona(value: unknown): value is Zona {
  return typeof value === "string" && (ZONE as readonly string[]).includes(value);
}
