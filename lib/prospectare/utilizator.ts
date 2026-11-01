import { cookies } from "next/headers";
import { COOKIE_UTILIZATOR, isUtilizator } from "./labels";
import type { Utilizator } from "./types";

/**
 * Cine lucrează acum (comutatorul Ștefan / Vlăduț): `?cine=` din adresă, apoi
 * cookie-ul, altfel Ștefan. Doar pe server.
 */
export async function utilizatorCurent(cine?: string | string[] | null): Promise<Utilizator> {
  const dinAdresa = Array.isArray(cine) ? cine[0] : cine;
  if (isUtilizator(dinAdresa)) return dinAdresa;
  const jar = await cookies();
  const salvat = jar.get(COOKIE_UTILIZATOR)?.value;
  return isUtilizator(salvat) ? salvat : "stefan";
}
