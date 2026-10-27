import type { Tone } from "./tone";

/** Cheltuielile, cum le văd ecranele (migrarea 19). Fișier izomorf. */

export const CATEGORIE_LABEL = {
  software: "Software și abonamente",
  echipament: "Echipament",
  transport: "Transport",
  reclame: "Reclame",
  altele: "Altele",
} as const;
export type Categorie = keyof typeof CATEGORIE_LABEL;

export type StareCitire = "neinceputa" | "ok" | "eroare" | "sarita";

export interface Cheltuiala {
  id: string;
  luna: string;
  furnizor: string | null;
  furnizorCui: string | null;
  nrDocument: string | null;
  dataDoc: string | null;
  suma: number | null;
  moneda: "RON" | "EUR" | "USD" | "altele";
  categoria: Categorie;
  descriere: string | null;
  fisierNume: string;
  fisierTip: string;
  fisierMarime: number | null;
  citireStare: StareCitire;
  citireMesaj: string | null;
  confirmata: boolean;
  driveLink: string | null;
  driveMesaj: string | null;
  tranzactieId: string | null;
  createdAt: string;
}

/** Ce scrie în coloana „Date”: citite (de verificat), confirmate de tine, de completat. */
export function dataState(expense: Pick<Cheltuiala, "confirmata" | "citireStare" | "suma" | "dataDoc">): { label: string; tone: Tone } {
  if (expense.confirmata) return { label: "Confirmate", tone: "ok" };
  if (expense.suma === null || expense.dataDoc === null) return { label: "De completat", tone: "warn" };
  if (expense.citireStare === "ok") return { label: "Citite — verifică", tone: "accent" };
  return { label: "De verificat", tone: "warn" };
}
