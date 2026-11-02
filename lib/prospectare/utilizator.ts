import { cookies } from "next/headers";
import { COOKIE_UTILIZATOR, isUtilizator } from "./labels";
import type { Utilizator } from "./types";

/**
 * Cine lucrează acum (comutatorul Ștefan / Vlăduț): doar cookie-ul pus de
 * comutator, altfel Ștefan. Aceeași sursă ca în acțiuni, ca un import sau un
 * rezultat să nu ajungă niciodată în lista celuilalt. Doar pe server.
 * Parametrul e ignorat (rămâne pentru apelurile vechi cu `?cine=`).
 */
export async function utilizatorCurent(_cine?: string | string[] | null): Promise<Utilizator> {
  void _cine;
  const jar = await cookies();
  const salvat = jar.get(COOKIE_UTILIZATOR)?.value;
  return isUtilizator(salvat) ? salvat : "stefan";
}
