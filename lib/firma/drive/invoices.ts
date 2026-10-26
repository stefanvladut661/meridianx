import type { Pas } from "../facturi-shared";

/**
 * Pasul „PDF-ul pe Drive” al aprobării unei facturi. Drive-ul vine în faza 3;
 * până atunci pasul e sărit, cu motivul scris, iar aprobarea merge mai departe.
 */
export async function saveInvoicePdfToDrive(): Promise<{ pas: Pas; fileId: string | null; link: string | null }> {
  return { pas: { stare: "sarit", la: new Date().toISOString(), mesaj: "Drive-ul nu e legat încă." }, fileId: null, link: null };
}
