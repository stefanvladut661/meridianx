import { z } from "zod";

/**
 * `manifest.json` — ce pune terminalul de reclame lângă clipuri, în același
 * subfolder de pe Drive. Formatul e descris în README („Pentru terminalul de
 * reclame”). Citirea e iertătoare: cheile se compară fără diacritice și fără
 * litere mari (`fișier` = `fisier`), durata merge ca număr de secunde sau ca
 * text („27,4 s”, „0:27”), hookul și CTA-ul ca obiect `{ cod, text }` sau ca
 * text simplu. Câmpurile necunoscute se păstrează și ajung la Claude ca
 * context.
 */

export const MANIFEST_VERSION = 1;

export interface ManifestPart {
  cod: string | null;
  text: string | null;
}

export interface ManifestClip {
  fisier: string;
  voce: string | null;
  hook: ManifestPart | null;
  cta: ManifestPart | null;
  stil: string | null;
  format: string | null;
  /** Secunde. */
  durata: number | null;
  /** Restul câmpurilor, așa cum au venit. */
  extra: Record<string, unknown>;
}

export interface Manifest {
  versiune: number | null;
  clipuri: ManifestClip[];
  /** Câmpuri de pe primul nivel în afara listei (ex. „lot”, „produs”). */
  context: Record<string, unknown>;
}

export type ManifestResult = { ok: true; data: Manifest; warnings: string[] } | { ok: false; message: string };

function normKey(key: string): string {
  return key
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function normalizeKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalizeKeys);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, inner] of Object.entries(value as Record<string, unknown>)) out[normKey(key)] = normalizeKeys(inner);
    return out;
  }
  return value;
}

const text = z
  .union([z.string(), z.number()])
  .transform((value) => String(value).trim())
  .transform((value) => (value === "" ? null : value));

const part = z.union([
  z
    .object({ cod: text.nullish(), text: text.nullish() })
    .passthrough()
    .transform((value) => ({ cod: value.cod ?? null, text: value.text ?? null })),
  text.transform((value) => ({ cod: null, text: value })),
]);

/** „27.4”, „27,4 s”, „0:27”, 27.4 → secunde. */
export function parseSeconds(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) && value > 0 ? value : null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toLowerCase();
  const clock = trimmed.match(/^(\d+):(\d{1,2})(?:[.,](\d+))?$/);
  if (clock) return Number(clock[1]) * 60 + Number(clock[2]) + (clock[3] ? Number(`0.${clock[3]}`) : 0);
  const plain = trimmed.replace(/\s*(s|sec|secunde)$/, "").replace(",", ".");
  const number = Number(plain);
  return Number.isFinite(number) && number > 0 ? number : null;
}

const KNOWN = new Set(["fisier", "file", "nume", "voce", "hook", "cta", "stil", "format", "durata", "durata_s", "durata_sec"]);

const clipSchema = z
  .object({
    fisier: text.nullish(),
    file: text.nullish(),
    nume: text.nullish(),
    voce: text.nullish(),
    hook: part.nullish(),
    cta: part.nullish(),
    stil: text.nullish(),
    format: text.nullish(),
    durata: z.unknown().optional(),
    durata_s: z.unknown().optional(),
    durata_sec: z.unknown().optional(),
  })
  .passthrough();

/** Textul fișierului → manifestul, sau ce nu merge, spus pe înțeles. */
export function parseManifest(raw: string): ManifestResult {
  let json: unknown;
  try {
    json = JSON.parse(raw.replace(/^﻿/, ""));
  } catch (error) {
    return { ok: false, message: `manifest.json nu e JSON valid: ${error instanceof Error ? error.message : "nu se poate citi"}.` };
  }
  const value = normalizeKeys(json);
  const root = Array.isArray(value) ? { clipuri: value } : (value as Record<string, unknown> | null);
  if (!root || typeof root !== "object") return { ok: false, message: "manifest.json trebuie să fie un obiect cu lista „clipuri” (sau direct lista)." };
  const list = root.clipuri ?? root.clips;
  if (!Array.isArray(list)) return { ok: false, message: "manifest.json n-are lista „clipuri”." };
  if (list.length === 0) return { ok: false, message: "Lista „clipuri” din manifest.json e goală." };

  const warnings: string[] = [];
  const clipuri: ManifestClip[] = [];
  const seen = new Set<string>();
  list.forEach((item, index) => {
    const parsed = clipSchema.safeParse(item);
    if (!parsed.success) {
      warnings.push(`Clipul ${index + 1} din manifest nu se poate citi și e sărit.`);
      return;
    }
    const data = parsed.data as Record<string, unknown> & z.infer<typeof clipSchema>;
    const fisier = data.fisier ?? data.file ?? data.nume ?? null;
    if (!fisier) {
      warnings.push(`Clipul ${index + 1} din manifest n-are „fisier” și e sărit.`);
      return;
    }
    if (seen.has(fisier)) {
      warnings.push(`„${fisier}” apare de două ori în manifest; a doua oară e sărită.`);
      return;
    }
    seen.add(fisier);
    const extra: Record<string, unknown> = {};
    for (const [key, inner] of Object.entries(data)) if (!KNOWN.has(key)) extra[key] = inner;
    clipuri.push({
      fisier,
      voce: data.voce ?? null,
      hook: data.hook ?? null,
      cta: data.cta ?? null,
      stil: data.stil ?? null,
      format: data.format ?? null,
      durata: parseSeconds(data.durata ?? data.durata_s ?? data.durata_sec),
      extra,
    });
  });
  if (clipuri.length === 0) return { ok: false, message: "Niciun clip din manifest.json nu se poate citi." };

  const context: Record<string, unknown> = {};
  for (const [key, inner] of Object.entries(root)) if (key !== "clipuri" && key !== "clips" && key !== "versiune") context[key] = inner;
  const versiune = typeof root.versiune === "number" ? root.versiune : null;
  if (versiune !== null && versiune > MANIFEST_VERSION) warnings.push(`Manifestul e la versiunea ${versiune}; adminul știe versiunea ${MANIFEST_VERSION}. Câmpurile noi sunt trimise ca atare.`);
  return { ok: true, data: { versiune, clipuri, context }, warnings };
}

/** „9x16”, „9:16”, „1080x1920” → raportul lățime/înălțime, dacă se poate citi. */
export function formatRatio(format: string | null): number | null {
  if (!format) return null;
  const match = format.match(/(\d+(?:[.,]\d+)?)\s*[x×:/]\s*(\d+(?:[.,]\d+)?)/i);
  if (!match) return null;
  const w = Number(match[1].replace(",", "."));
  const h = Number(match[2].replace(",", "."));
  return w > 0 && h > 0 ? w / h : null;
}
