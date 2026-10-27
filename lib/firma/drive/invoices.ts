import type { Factura, Pas } from "../facturi-shared";
import { driveMode } from "./google";
import { NO_ROOT, saveToDrive } from "./index";
import { readSettings } from "../setari";

/**
 * Pasul „PDF-ul pe Drive” al aprobării unei facturi: PDF-ul din Oblio, în
 * folderul lunii emiterii, cu numele în stilul celor descărcate din Oblio
 * („FacturaFCT42-NUME_CLIENT.pdf”). Fără Drive legat sau fără rădăcină, pasul
 * e sărit (cu motivul), iar aprobarea merge mai departe.
 */
export async function saveInvoicePdfToDrive(invoice: Factura, pdf: Buffer | null, actor: string): Promise<{ pas: Pas; fileId: string | null; link: string | null }> {
  const at = new Date().toISOString();
  if (!driveMode()) return { pas: { stare: "sarit", la: at, mesaj: "Drive-ul nu e legat în Vercel." }, fileId: null, link: null };
  const settings = await readSettings();
  if (!settings.ok || !settings.data.driveRadacina) return { pas: { stare: "sarit", la: at, mesaj: NO_ROOT }, fileId: null, link: null };
  if (!invoice.numar || !invoice.dataEmiterii) return { pas: { stare: "eroare", la: at, mesaj: "Factura nu e emisă încă." }, fileId: null, link: null };
  if (!pdf) return { pas: { stare: "eroare", la: at, mesaj: "N-am putut lua PDF-ul din Oblio. Reia pașii peste un minut." }, fileId: null, link: null };

  const client = invoice.clientNume.toUpperCase().replace(/[^A-Z0-9ĂÂÎȘȚ.]+/g, "_").replace(/^_+|_+$/g, "");
  const name = `Factura${invoice.serie ?? ""}${invoice.numar}-${client}.pdf`;
  const saved = await saveToDrive({ month: invoice.dataEmiterii.slice(0, 7), kind: "factura", sourceId: invoice.id, name, bytes: pdf, mimeType: "application/pdf", actor });
  if (!saved.ok) return { pas: { stare: "eroare", la: at, mesaj: saved.message }, fileId: null, link: null };
  return { pas: { stare: "ok", la: at, mesaj: saved.data.existed ? `${name} (era deja pe Drive)` : name }, fileId: saved.data.fileId, link: saved.data.link };
}
