import { monthEnd, monthStart } from "./format";

/**
 * Clienții, contractele și prețurile, cum le văd ecranele. Fișier izomorf.
 */

export interface Contact {
  id: string;
  nume: string;
  rol: string | null;
  telefon: string | null;
  email: string | null;
}

export interface Pret {
  id: string;
  /** Prima zi a lunii de început. */
  deLa: string;
  /** Ultima zi a lunii de sfârșit; `null` = fără sfârșit. */
  panaLa: string | null;
  suma: number;
  descriere: string;
}

export type StareContract = "activ" | "suspendat" | "incheiat";

export interface Contract {
  id: string;
  clientId: string;
  numar: string | null;
  incepe: string;
  seTermina: string | null;
  servicii: string;
  moneda: "RON" | "EUR";
  bugetReclame: number | null;
  ziEmitere: number;
  zileScadenta: number;
  starea: StareContract;
  note: string | null;
  preturi: Pret[];
}

export interface Client {
  id: string;
  nume: string;
  cui: string | null;
  regCom: string | null;
  adresa: string | null;
  oras: string | null;
  judet: string | null;
  tara: string;
  emailFacturare: string | null;
  adsClientId: string | null;
  note: string | null;
  oblioImportatLa: string | null;
  arhivatLa: string | null;
  contacte: Contact[];
  contracte: Contract[];
}

export const STARE_CONTRACT_LABEL: Record<StareContract, string> = {
  activ: "Activ",
  suspendat: "Suspendat",
  incheiat: "Încheiat",
};

/** Contractul acoperă luna (măcar o zi din ea) și e activ. */
export function contractInMonth(contract: Pick<Contract, "incepe" | "seTermina" | "starea">, month: string): boolean {
  if (contract.starea !== "activ") return false;
  return contract.incepe <= monthEnd(month) && (contract.seTermina === null || contract.seTermina >= monthStart(month));
}

/** Prețul care acoperă prima zi a lunii, sau `null` dacă nu e niciunul. */
export function priceForMonth(prices: Pret[], month: string): Pret | null {
  const day = monthStart(month);
  return prices.find((price) => price.deLa <= day && (price.panaLa === null || price.panaLa >= day)) ?? null;
}

/** Perioade care se suprapun (două prețuri pentru aceeași lună) — eroare de introducere. */
export function overlappingPrices(prices: Pick<Pret, "deLa" | "panaLa">[]): boolean {
  const sorted = [...prices].sort((a, b) => a.deLa.localeCompare(b.deLa));
  for (let i = 1; i < sorted.length; i++) {
    const previous = sorted[i - 1];
    if (previous.panaLa === null || previous.panaLa >= sorted[i].deLa) return true;
  }
  return false;
}

/** Contractul care se termină în următoarele `days` zile (pentru alerte). */
export function endsWithin(contract: Pick<Contract, "seTermina" | "starea">, today: string, days: number): boolean {
  if (contract.starea !== "activ" || !contract.seTermina) return false;
  const limit = new Date(`${today}T00:00:00Z`);
  limit.setUTCDate(limit.getUTCDate() + days);
  return contract.seTermina >= today && contract.seTermina <= limit.toISOString().slice(0, 10);
}
