import type { Tone } from "./tone";

/**
 * Facturile, cum le văd ecranele (migrarea 17). Fișier izomorf.
 */

export interface RandFactura {
  denumire: string;
  descriere: string | null;
  cantitate: number;
  um: string;
  pretUnitar: number;
}

export type StareFactura = "ciorna" | "in_lucru" | "emisa" | "eroare" | "renuntat";
export type StareEmail = "nepregatit" | "pregatit" | "trimis" | "esuat";
export type StarePas = "ok" | "eroare" | "sarit";
export type NumePas = "emitere" | "efactura" | "drive" | "email";

export interface Pas {
  stare: StarePas;
  la: string;
  mesaj: string | null;
}

export interface Factura {
  id: string;
  clientId: string;
  clientNume: string;
  contractId: string | null;
  felul: "contract" | "manuala";
  luna: string | null;
  starea: StareFactura;
  serie: string | null;
  numar: string | null;
  linkOblio: string | null;
  dataPlanificata: string;
  dataEmiterii: string | null;
  zileScadenta: number;
  scadenta: string | null;
  moneda: "RON" | "EUR";
  randuri: RandFactura[];
  total: number;
  mentiuni: string | null;
  efacturaCod: number | null;
  efacturaText: string | null;
  driveLink: string | null;
  emailStare: StareEmail;
  emailCatre: string | null;
  emailSubiect: string | null;
  emailText: string | null;
  emailTrimisLa: string | null;
  incasat: number;
  incasataLa: string | null;
  pasi: Partial<Record<NumePas, Pas>>;
  aprobataDe: string | null;
  aprobataLa: string | null;
  createdAt: string;
}

export const PAS_LABEL: Record<NumePas, string> = {
  emitere: "Emisă în Oblio",
  efactura: "Trimisă în e-Factura",
  drive: "PDF-ul pe Drive",
  email: "Emailul pregătit",
};

export function lineTotal(row: Pick<RandFactura, "cantitate" | "pretUnitar">): number {
  return Math.round(row.cantitate * row.pretUnitar * 100) / 100;
}

export function invoiceTotal(rows: Pick<RandFactura, "cantitate" | "pretUnitar">[]): number {
  return Math.round(rows.reduce((sum, row) => sum + lineTotal(row), 0) * 100) / 100;
}

/** „FCT 42” sau „Ciornă”. */
export function invoiceName(invoice: Pick<Factura, "serie" | "numar" | "starea">): string {
  if (invoice.numar) return `${invoice.serie ?? ""} ${invoice.numar}`.trim();
  return invoice.starea === "renuntat" ? "Renunțat" : "Ciornă";
}

export type StareAfisata = "ciorna" | "in_lucru" | "eroare" | "emisa" | "efactura" | "incasata" | "intarziata" | "renuntat";

/**
 * Starea din listă: ciornă, emisă, trimisă în e-Factura, încasată, întârziată
 * (emisă, neîncasată integral și cu scadența trecută).
 */
export function displayState(invoice: Pick<Factura, "starea" | "efacturaCod" | "incasat" | "total" | "scadenta">, today: string): StareAfisata {
  if (invoice.starea === "ciorna") return "ciorna";
  if (invoice.starea === "renuntat") return "renuntat";
  if (invoice.starea === "in_lucru") return "in_lucru";
  if (invoice.starea === "eroare") return "eroare";
  if (invoice.total > 0 && invoice.incasat >= invoice.total - 0.005) return "incasata";
  if (invoice.scadenta && invoice.scadenta < today) return "intarziata";
  if (invoice.efacturaCod === 0 || invoice.efacturaCod === 1) return "efactura";
  return "emisa";
}

export const STARE_AFISATA: Record<StareAfisata, { label: string; tone: Tone }> = {
  ciorna: { label: "Ciornă", tone: "neutral" },
  in_lucru: { label: "Se emite…", tone: "accent" },
  eroare: { label: "Emiterea n-a mers", tone: "error" },
  emisa: { label: "Emisă", tone: "accent" },
  efactura: { label: "Trimisă în e-Factura", tone: "accent" },
  incasata: { label: "Încasată", tone: "ok" },
  intarziata: { label: "Întârziată", tone: "error" },
  renuntat: { label: "Renunțat", tone: "muted" },
};

export const EMAIL_LABEL: Record<StareEmail, { label: string; tone: Tone }> = {
  nepregatit: { label: "—", tone: "muted" },
  pregatit: { label: "De trimis", tone: "warn" },
  trimis: { label: "Trimis", tone: "ok" },
  esuat: { label: "N-a plecat", tone: "error" },
};

/** Textul e-Factura după codul Oblio. */
export function einvoiceLabel(code: number | null): string {
  if (code === null || code === undefined) return "netrimisă";
  if (code === 1) return "trimisă cu succes";
  if (code === 0) return "primită de SPV, în procesare";
  if (code === 2) return "respinsă (are erori)";
  return "netrimisă";
}
