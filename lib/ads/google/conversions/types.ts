import type { LeadKind, SendTo } from "./standard";

/**
 * Ce ajunge în browser pe `/admin/ads/conversii` (faza 13). Izomorf, doar tipuri.
 */

export interface ConversionActionInfo {
  id: string;
  name: string;
  /** AD_CALL, CLICK_TO_CALL, WEBPAGE… — cum le dă Google. */
  type: string;
  category: string;
  /** ENABLED, HIDDEN (cele REMOVED nu se citesc). */
  status: string;
  primary: boolean;
  counting: string | null;
  clickWindowDays: number | null;
  viewWindowDays: number | null;
  callSeconds: number | null;
  /** AW-…/eticheta, din fragmentele de cod ale acțiunii; null la apeluri și la cele fără cod. */
  sendTo: SendTo | null;
}

/** Cine gestionează conversiile contului (`customer.conversion_tracking_setting`). */
export type ConversionOwner = "self" | "manager" | "none" | "unknown";

export interface ConversionSetup {
  /** Id-ul de urmărire folosit de etichete (AW-…): al managerului, dacă urmărirea e între conturi. */
  trackingId: string | null;
  owner: ConversionOwner;
  /** Contul în care se creează conversiile, dacă nu e chiar acesta (10 cifre). */
  conversionAccount: string | null;
  /** `customer.call_reporting_setting` — se schimbă doar în Google Ads. */
  callReporting: { enabled: boolean; conversions: boolean };
  actions: ConversionActionInfo[];
}

export interface ConversionsPreviewRow {
  kind: LeadKind;
  name: string;
  /** „Apel din anunț · Apel telefonic · principală · 30 de zile după clic · 60 s” */
  facts: string[];
  /** Ce s-ar dubla în cont (avertisment). */
  similar: string | null;
}

export interface ConversionsPreview {
  ok: boolean;
  fingerprint: string;
  rows: ConversionsPreviewRow[];
  operations: number;
  /** Pe câmpurile formularului (`actions.0.name`) sau generale (`path: ""`). */
  errors: Array<{ path: string; message: string }>;
  warnings: string[];
}

export type ConversionsPreviewResponse = { ok: true; preview: ConversionsPreview } | { ok: false; message: string };

export interface CreatedConversion {
  id: string;
  name: string;
  kind: LeadKind;
  type: string;
  sendTo: SendTo | null;
}

export type ConversionsCreateResponse =
  | { ok: true; created: CreatedConversion[]; journalWarning: string | null }
  | { ok: false; message: string; recheck?: boolean };
