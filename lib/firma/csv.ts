import { isDay, parseAmount } from "./format";

/**
 * Citirea unui export de extras (CSV). Fișier izomorf, fără dependențe.
 * Formatul exact (rândul antetului, coloanele) îl alege omul la primul
 * import; aici doar se citește fișierul și se aplică alegerea lui.
 */

export type Delimiter = "," | ";" | "tab" | "|";
export type Encoding = "utf-8" | "windows-1250";

export const DELIMITER_CHAR: Record<Delimiter, string> = { ",": ",", ";": ";", tab: "\t", "|": "|" };

/** UTF-8 dacă e valid, altfel Windows-1250 (exporturile românești mai vechi). Fără BOM. */
export function decodeBytes(bytes: Uint8Array, forced?: Encoding): { text: string; encoding: Encoding } {
  const strip = (text: string) => text.replace(/^﻿/, "");
  if (forced) return { text: strip(new TextDecoder(forced).decode(bytes)), encoding: forced };
  try {
    return { text: strip(new TextDecoder("utf-8", { fatal: true }).decode(bytes)), encoding: "utf-8" };
  } catch {
    return { text: strip(new TextDecoder("windows-1250").decode(bytes)), encoding: "windows-1250" };
  }
}

/** RFC 4180: câmpuri între ghilimele, ghilimele dublate, rânduri noi în câmp. */
export function parseCsv(text: string, delimiter: Delimiter): string[][] {
  const sep = DELIMITER_CHAR[delimiter];
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += char;
      continue;
    }
    if (char === '"' && cell === "") quoted = true;
    else if (char === sep) {
      row.push(cell.trim());
      cell = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(cell.trim());
      if (row.some((value) => value !== "")) rows.push(row);
      row = [];
      cell = "";
    } else cell += char;
  }
  row.push(cell.trim());
  if (row.some((value) => value !== "")) rows.push(row);
  return rows;
}

/** Separatorul care împarte cel mai consecvent primele rânduri. */
export function detectDelimiter(text: string): Delimiter {
  const lines = text.split(/\r?\n/).filter((line) => line.trim()).slice(0, 15);
  let best: { delimiter: Delimiter; score: number } = { delimiter: ",", score: -1 };
  for (const delimiter of [";", ",", "tab", "|"] as Delimiter[]) {
    const counts = parseCsv(lines.join("\n"), delimiter).map((row) => row.length);
    if (counts.length === 0) continue;
    const common = counts.sort((a, b) => counts.filter((c) => c === b).length - counts.filter((c) => c === a).length)[0];
    const score = common > 1 ? counts.filter((c) => c === common).length * common : 0;
    if (score > best.score) best = { delimiter, score };
  }
  return best.delimiter;
}

/** Primul rând cu măcar trei celule pline și fără sume în el (antetul). */
export function guessHeaderRow(rows: string[][]): number {
  const index = rows.findIndex((row) => row.filter(Boolean).length >= 3 && row.every((cell) => parseAmount(cell) === null || cell === ""));
  return index >= 0 ? index : 0;
}

export const norm = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Antetul, normalizat: după el se recunoaște un format salvat. */
export function headerSignature(header: string[]): string {
  return header.map(norm).join("|").slice(0, 200);
}

/** „28.09.2026”, „28/09/2026”, „28-09-26”, „2026-09-28”, cu sau fără oră → „2026-09-28”. */
export function parseBankDate(raw: string): string | null {
  const value = raw.trim().split(/[ T]/)[0];
  let match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(value);
  let iso: string | null = null;
  if (match) iso = `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
  match = /^(\d{1,2})[./-](\d{1,2})[./-](\d{2}|\d{4})$/.exec(value);
  if (match) iso = `${match[3].length === 2 ? `20${match[3]}` : match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
  return iso && isDay(iso) ? iso : null;
}

export interface ColumnMap {
  data: number;
  /** O singură coloană cu semn… */
  suma: number | null;
  /** …sau două: debit (plăți) și credit (încasări). */
  debit: number | null;
  credit: number | null;
  detalii: number;
  contrapartida: number | null;
  referinta: number | null;
  moneda: number | null;
}

export interface BankLine {
  row: number;
  data: string;
  suma: number;
  moneda: string;
  detalii: string;
  contrapartida: string | null;
  referinta: string | null;
}

/** „(1.234,50)” sau „-1.234,50” → -1234.5. */
function signedAmount(raw: string): number | null {
  const text = raw.trim();
  if (!text) return null;
  const negative = /^\(.*\)$/.test(text) || text.startsWith("-");
  const amount = parseAmount(text.replace(/[()]/g, "").replace(/^-/, ""));
  return amount === null ? null : negative ? -amount : amount;
}

/** Rândurile de după antet, cu alegerea omului aplicată; rândurile care nu se pot citi sunt raportate. */
export function normalizeRows(rows: string[][], headerRow: number, map: ColumnMap): { lines: BankLine[]; skipped: { row: number; reason: string }[] } {
  const lines: BankLine[] = [];
  const skipped: { row: number; reason: string }[] = [];
  const cell = (row: string[], index: number | null) => (index === null || index === undefined ? "" : (row[index] ?? "").trim());
  rows.slice(headerRow + 1).forEach((row, offset) => {
    const number = headerRow + 2 + offset;
    const date = parseBankDate(cell(row, map.data));
    if (!date) {
      // Rânduri de total sau sold la sfârșit: fără dată, nu sunt tranzacții.
      if (row.filter(Boolean).length > 0) skipped.push({ row: number, reason: `data „${cell(row, map.data) || "goală"}” nu se poate citi` });
      return;
    }
    let amount: number | null = null;
    if (map.suma !== null) amount = signedAmount(cell(row, map.suma));
    else {
      const credit = signedAmount(cell(row, map.credit));
      const debit = signedAmount(cell(row, map.debit));
      if (credit) amount = Math.abs(credit);
      else if (debit) amount = -Math.abs(debit);
    }
    if (amount === null || amount === 0) {
      skipped.push({ row: number, reason: "fără sumă" });
      return;
    }
    lines.push({
      row: number,
      data: date,
      suma: Math.round(amount * 100) / 100,
      moneda: (cell(row, map.moneda) || "RON").toUpperCase().slice(0, 10),
      detalii: cell(row, map.detalii).slice(0, 1000),
      contrapartida: cell(row, map.contrapartida).slice(0, 300) || null,
      referinta: cell(row, map.referinta).slice(0, 120) || null,
    });
  });
  return { lines, skipped };
}

/** Propuneri de coloane după numele din antet — doar ca punct de plecare; omul confirmă. */
export function suggestColumns(header: string[]): ColumnMap {
  const find = (...words: string[]) => {
    const index = header.findIndex((cell) => words.some((word) => norm(cell).includes(word)));
    return index >= 0 ? index : null;
  };
  const debit = find("debit");
  const credit = find("credit");
  return {
    data: find("data tranzactie", "data operatiune", "data inregistrare", "data") ?? 0,
    suma: debit !== null && credit !== null ? null : find("suma", "valoare", "amount"),
    debit: debit !== null && credit !== null ? debit : null,
    credit: debit !== null && credit !== null ? credit : null,
    detalii: find("detalii", "descriere", "explicatie", "mentiuni", "details") ?? 1,
    contrapartida: find("beneficiar", "platitor", "ordonator", "contrapartida", "nume"),
    referinta: find("referinta", "reference", "nr document"),
    moneda: find("moneda", "valuta", "currency"),
  };
}
