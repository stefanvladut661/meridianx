/**
 * Citirea textului lipit în portal.
 *
 * Planul vine dintr-o conversație din altă parte, deci ajunge cu ce lasă
 * copierea: blocuri ```json, comentarii `//` (exemplul din documentație e
 * comentat intenționat), virgule rămase la final, uneori ghilimele
 * „tipografice". Primele trei le iertăm fără să întrebăm — nu schimbă
 * sensul. Ghilimelele tipografice NU le înlocuim în tăcere: pot sta
 * legitim în interiorul unui text de reclamă, deci spunem ce e și lăsăm
 * omul să aleagă.
 *
 * Toate curățările păstrează lungimea textului (înlocuiesc cu spații), ca
 * rândul și coloana dintr-o eroare să arate exact unde e problema în ce a
 * lipit omul, nu în ce am curățat noi.
 */

export type PlanTextResult =
  | { ok: true; value: Record<string, unknown> }
  | {
      ok: false;
      message: string;
      line: number | null;
      column: number | null;
      /** Există o reparație sigură pe care interfața o poate oferi cu un clic. */
      fix: "smart_quotes" | null;
    };

/**
 * Ghilimele tipografice în poziție de STRUCTURĂ JSON: lângă `{ , [ :` sau
 * înainte de `: , } ]`. Cele din interiorul unui text românesc („Cere
 * ofertă”) stau lângă litere și spații, deci nu se prind aici.
 */
const Q = "[\\u201C\\u201D\\u201E\\u201F]";
const STRUCTURAL_SMART_QUOTES: ReadonlyArray<[RegExp, string]> = [
  [new RegExp(`([{\\[,]\\s*)${Q}`, "g"), '$1"'],
  [new RegExp(`${Q}(\\s*:)`, "g"), '"$1'],
  [new RegExp(`(:\\s*)${Q}`, "g"), '$1"'],
  [new RegExp(`${Q}(\\s*[,}\\]])`, "g"), '"$1'],
];

function hasStructuralSmartQuotes(text: string): boolean {
  return STRUCTURAL_SMART_QUOTES.some(([pattern]) => {
    pattern.lastIndex = 0;
    return pattern.test(text);
  });
}

/** Înlocuiește cu spații, păstrând rândurile noi — pozițiile rămân aceleași. */
function blank(text: string): string {
  return text.replace(/[^\n]/g, " ");
}

/** ```json … ``` de la începutul și sfârșitul textului, lăsat de chat-uri. */
function stripCodeFence(text: string): string {
  return text
    .replace(/^(\s*)(```[a-zA-Z]*[^\S\n]*)(?=\n|$)/, (_all, lead: string, fence: string) => lead + blank(fence))
    .replace(/(```\s*)$/, (fence: string) => blank(fence));
}

/**
 * Scoate comentariile `//` și `/* *\/` și virgulele de dinainte de `}` / `]`,
 * DOAR în afara șirurilor. Un URL (`https://…`) dintr-un șir rămâne întreg.
 */
function stripJsonc(text: string): string {
  const out = text.split("");
  let inString = false;
  let i = 0;

  while (i < text.length) {
    const char = text[i];

    if (inString) {
      if (char === "\\") {
        i += 2;
        continue;
      }
      if (char === '"') inString = false;
      i += 1;
      continue;
    }

    if (char === '"') {
      inString = true;
      i += 1;
      continue;
    }

    if (char === "/" && text[i + 1] === "/") {
      while (i < text.length && text[i] !== "\n") {
        out[i] = " ";
        i += 1;
      }
      continue;
    }

    if (char === "/" && text[i + 1] === "*") {
      const end = text.indexOf("*/", i + 2);
      const stop = end === -1 ? text.length : end + 2;
      for (; i < stop; i += 1) {
        if (text[i] !== "\n") out[i] = " ";
      }
      continue;
    }

    if (char === ",") {
      // Virgulă finală: următorul caracter semnificativ (după spații și
      // comentarii, deja golite sau nu) închide obiectul sau lista.
      let j = i + 1;
      while (j < text.length) {
        if (/\s/.test(text[j])) {
          j += 1;
        } else if (text[j] === "/" && text[j + 1] === "/") {
          while (j < text.length && text[j] !== "\n") j += 1;
        } else if (text[j] === "/" && text[j + 1] === "*") {
          const end = text.indexOf("*/", j + 2);
          j = end === -1 ? text.length : end + 2;
        } else {
          break;
        }
      }
      if (text[j] === "}" || text[j] === "]") out[i] = " ";
    }

    i += 1;
  }

  return out.join("");
}

function locate(text: string, position: number): { line: number; column: number } {
  const before = text.slice(0, position);
  const lines = before.split("\n");
  return { line: lines.length, column: lines[lines.length - 1].length + 1 };
}

/** Poziția din mesajul motorului JS. Formatele diferă între V8, Firefox și Safari. */
function errorPosition(error: unknown, text: string): number | null {
  const message = error instanceof Error ? error.message : String(error);

  const lineColumn = /line (\d+) column (\d+)/i.exec(message);
  if (lineColumn) {
    const line = Number(lineColumn[1]);
    const column = Number(lineColumn[2]);
    const lines = text.split("\n");
    let position = 0;
    for (let index = 0; index < line - 1 && index < lines.length; index += 1) {
      position += lines[index].length + 1;
    }
    return position + column - 1;
  }

  const offset = /position (\d+)/i.exec(message);
  if (offset) return Number(offset[1]);

  return null;
}

/** O propoziție despre CE e greșit, după caracterul de la poziția erorii. */
function hintAt(text: string, position: number): string {
  const char = text[position];
  let previous = position - 1;
  while (previous >= 0 && /\s/.test(text[previous])) previous -= 1;
  const before = previous >= 0 ? text[previous] : "";

  if (char === "'") return "JSON cere ghilimele duble (\"), nu apostrof (').";
  if (char === '"' && /["}\]\d]|e|l/.test(before)) {
    return "Probabil lipsește o virgulă la finalul rândului de dinainte.";
  }
  if (char !== undefined && /[A-Za-z_]/.test(char) && (before === "{" || before === ",")) {
    return "Numele câmpurilor trebuie puse între ghilimele duble: \"nume\": …";
  }
  if (char === "}" || char === "]") {
    return "O paranteză se închide unde nu trebuie — verifică perechile { } și [ ].";
  }
  return "Verifică virgulele și ghilimelele din jurul acestui loc.";
}

export function parsePlanText(raw: string): PlanTextResult {
  if (raw.trim() === "") {
    return {
      ok: false,
      message: "Câmpul e gol. Lipește aici planul primit, sau încarcă exemplul.",
      line: null,
      column: null,
      fix: null,
    };
  }

  const text = stripJsonc(stripCodeFence(raw.replace(/^﻿/, " ")));

  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (error) {
    if (hasStructuralSmartQuotes(text)) {
      return {
        ok: false,
        message:
          "Planul are ghilimele tipografice (“ ”) în loc de ghilimele drepte (\"). Se întâmplă când copiezi dintr-un chat sau dintr-un document. Înlocuiește-le și verifică din nou.",
        line: null,
        column: null,
        fix: "smart_quotes",
      };
    }

    const position = errorPosition(error, text);
    const message = error instanceof Error ? error.message : "";

    // Eroarea cade pe ultimul caracter sau după el: textul s-a oprit la jumătate.
    const atEnd = position !== null && position >= text.trimEnd().length - 1;
    if (atEnd || /end of (JSON )?(input|data)|unterminated|unexpected EOF/i.test(message)) {
      return {
        ok: false,
        message:
          "JSON-ul se termină brusc. Lipsește o acoladă } sau o paranteză ] la final — sau planul s-a copiat doar pe jumătate.",
        line: null,
        column: null,
        fix: null,
      };
    }

    if (position === null) {
      return {
        ok: false,
        message: "JSON-ul nu se poate citi. Verifică virgulele, ghilimelele și perechile de paranteze.",
        line: null,
        column: null,
        fix: null,
      };
    }

    const { line, column } = locate(text, position);
    return {
      ok: false,
      message: `JSON-ul nu se poate citi la rândul ${line}, coloana ${column}. ${hintAt(text, position)}`,
      line,
      column,
      fix: null,
    };
  }

  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return {
      ok: false,
      message: Array.isArray(value)
        ? "Planul e o listă [ … ]. Portalul primește O campanie odată, ca obiect { … }."
        : "Planul trebuie să fie un obiect JSON { … }.",
      line: null,
      column: null,
      fix: null,
    };
  }

  return { ok: true, value: value as Record<string, unknown> };
}

/**
 * Reparația oferită la eroarea `smart_quotes`: doar ghilimelele din poziții
 * de structură. Ghilimelele românești din interiorul textelor rămân.
 */
export function replaceSmartQuotes(text: string): string {
  return STRUCTURAL_SMART_QUOTES.reduce(
    (current, [pattern, replacement]) => current.replace(pattern, replacement),
    text
  );
}
