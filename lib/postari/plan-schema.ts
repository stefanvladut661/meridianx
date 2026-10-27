import { z } from "zod";
import { PLATFORME, type Platforma } from "./limite";
import { isDay, isTime, isTimeZone } from "./timp";

/**
 * Planul de postări (JSON). Fișier izomorf: îl folosesc editorul (pentru
 * erorile de sintaxă, pe loc) și serverul (verificarea întreagă). Formatul e
 * descris în README → „Planul JSON”.
 *
 * Câmpurile necunoscute sunt erori, nu se ignoră în tăcere: o greșeală de
 * tipar („descrire”) ar pierde o descriere fără să afle nimeni.
 */

export const PLAN_FORMAT = "meridian-postari/1";
export const MAX_POSTS = 200;

const ORA_LOCAL = /^(\d{4}-\d{2}-\d{2})[ T]([01]\d|2[0-3]):([0-5]\d)$/;
const ORA_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;

const sloturiSchema = z.strictObject({
  start: z
    .string()
    .trim()
    .refine(isDay, "„sloturi.start” e o zi, AAAA-LL-ZZ (ex. „2026-11-02”).")
    .optional(),
  ore: z
    .array(z.string().trim().refine(isTime, "Orele sloturilor se scriu HH:MM (ex. „12:30”)."))
    .min(1, "„sloturi.ore” are nevoie de cel puțin o oră.")
    .max(24, "„sloturi.ore”: cel mult 24 de ore pe zi."),
  fus: z.string().trim().refine(isTimeZone, "Fusul orar nu e cunoscut; scrie-l ca „Europe/Bucharest”.").optional(),
});

const instagramSchema = z.strictObject({
  tip: z.enum(["reel", "trial_reel"], "„instagram.tip” e „reel” sau „trial_reel”.").default("reel"),
  /** Doar la trial_reel: „manual” (îl treci tu la urmăritori) sau „automat” (trece singur dacă merge bine). */
  absolvire: z.enum(["manual", "automat"], "„instagram.absolvire” e „manual” sau „automat”.").optional(),
  /** Doar la reel: apare și în feed, nu doar la Reels (implicit da). */
  in_feed: z.boolean("„instagram.in_feed” e true sau false.").optional(),
  /** Cadrul de copertă, în milisecunde de la început. */
  coperta_ms: z.number().int("„instagram.coperta_ms” e un număr întreg de milisecunde.").min(0).max(15 * 60_000).optional(),
});

const tiktokSchema = z.strictObject({
  mod: z.literal("ciorna", "Pe TikTok e construită doar trimiterea în ciorne: „tiktok.mod” e „ciorna”.").default("ciorna"),
});

const postSchema = z.strictObject({
  fisier: z.string().trim().min(1, "Fiecare postare are nevoie de „fisier” (numele clipului din folder).").max(300),
  platforme: z
    .array(z.enum(PLATFORME as unknown as [Platforma, ...Platforma[]], "Platformele sunt „instagram” și „tiktok”."))
    .min(1, "Alege cel puțin o platformă: „instagram”, „tiktok”.")
    .max(2)
    .refine((list) => new Set(list).size === list.length, "O platformă apare de două ori în „platforme”."),
  ora: z
    .string()
    .trim()
    .refine((value) => ORA_LOCAL.test(value) || ORA_ISO.test(value), "„ora” se scrie „AAAA-LL-ZZ HH:MM” (în fusul planului) sau lipsește / e null, ca să ia următorul slot.")
    .nullable()
    .optional(),
  descriere: z.string().max(4000, "Descrierea are peste 4000 de caractere.").default(""),
  hashtaguri: z.array(z.string().trim().min(1).max(100)).max(60, "Prea multe hashtag-uri (Instagram primește 30).").default([]),
  instagram: instagramSchema.optional(),
  tiktok: tiktokSchema.optional(),
});

export const planSchema = z.strictObject({
  format: z.literal(PLAN_FORMAT, `„format” e „${PLAN_FORMAT}” (sau lipsește).`).optional(),
  nume: z.string().trim().max(120, "„nume”: cel mult 120 de caractere.").optional(),
  folder: z.string().trim().min(1, "„folder” e subfolderul de pe Drive, ex. „meridian reclame/lot-1”.").max(500),
  /** Fusul pentru orele fixe, când planul n-are „sloturi”. */
  fus: z.string().trim().refine(isTimeZone, "Fusul orar nu e cunoscut; scrie-l ca „Europe/Bucharest”.").optional(),
  sloturi: sloturiSchema.optional(),
  postari: z.array(postSchema).min(1, "Planul n-are nicio postare.").max(MAX_POSTS, `Un plan are cel mult ${MAX_POSTS} de postări.`),
});

export type PlanInput = z.infer<typeof planSchema>;
export type PostInput = z.infer<typeof postSchema>;

// ---------------------------------------------------------------------------
// Textul lipit
// ---------------------------------------------------------------------------

export type PlanTextResult = { ok: true; value: unknown } | { ok: false; message: string; line: number | null; column: number | null };

/**
 * Curăță ce lasă o copiere din conversație: blocurile ```json, comentariile
 * `//` și `/* *\/`, virgulele de la final. Înlocuiește cu spații, ca rândul și
 * coloana unei erori să arate în textul lipit.
 */
export function cleanPlanText(raw: string): string {
  let text = raw.replace(/^﻿/, "");
  text = text.replace(/^\s*```[a-zA-Z]*\s*$/gm, (match) => " ".repeat(match.length));
  const out = text.split("");
  let inString = false;
  for (let i = 0; i < out.length; i += 1) {
    const ch = text[i];
    if (inString) {
      if (ch === "\\") i += 1;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "/" && text[i + 1] === "/") {
      while (i < text.length && text[i] !== "\n") out[i++] = " ";
      continue;
    }
    if (ch === "/" && text[i + 1] === "*") {
      while (i < text.length && !(text[i] === "*" && text[i + 1] === "/")) {
        if (text[i] !== "\n") out[i] = " ";
        i += 1;
      }
      if (i < text.length) out[i] = out[i + 1] = " ";
      i += 1;
      continue;
    }
    if (ch === ",") {
      let j = i + 1;
      while (j < text.length && /\s/.test(text[j])) j += 1;
      // Comentariile de după virgulă au fost deja golite doar dacă veneau înainte; le sărim și aici.
      if (text[j] === "}" || text[j] === "]") out[i] = " ";
    }
  }
  return out.join("");
}

function position(text: string, index: number): { line: number; column: number } {
  const before = text.slice(0, index);
  const line = before.split("\n").length;
  return { line, column: index - before.lastIndexOf("\n") };
}

export function parsePlanText(raw: string): PlanTextResult {
  if (!raw.trim()) return { ok: false, message: "Lipește planul (JSON) sau încarcă un fișier .json.", line: null, column: null };
  const text = cleanPlanText(raw);
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (error) {
    const message = error instanceof Error ? error.message : "JSON invalid";
    const at = message.match(/position (\d+)/);
    const where = at ? position(text, Number(at[1])) : null;
    const smart = /[“”„]/.test(text) && /[{,\[]\s*[“”„]/.test(text);
    return {
      ok: false,
      message: smart
        ? "Planul are ghilimele „tipografice” în locul celor drepte (\") în jurul cheilor sau al valorilor. Copiază-l din nou ca text simplu."
        : `Planul nu e JSON valid${where ? ` (rândul ${where.line}, coloana ${where.column})` : ""}. Verifică virgulele și ghilimelele.`,
      line: where?.line ?? null,
      column: where?.column ?? null,
    };
  }
}

/** „postari.3.descriere” → „postarea 4 → descriere” (numerotare de la 1, cum o citește omul). */
export function pathLabel(path: PropertyKey[]): string {
  if (path.length === 0) return "planul";
  const parts: string[] = [];
  for (let i = 0; i < path.length; i += 1) {
    const key = path[i];
    if (key === "postari" && typeof path[i + 1] === "number") {
      parts.push(`postarea ${(path[i + 1] as number) + 1}`);
      i += 1;
    } else if (typeof key === "number") parts.push(String(key + 1));
    else parts.push(String(key));
  }
  return parts.join(" → ");
}

export interface SchemaIssue {
  path: string;
  /** Postarea (de la 0), dacă eroarea e a unei postări. */
  post: number | null;
  message: string;
}

const EXPECTED: Record<string, string> = { string: "un text", number: "un număr", boolean: "true sau false", array: "o listă [ … ]", object: "un obiect { … }" };

/** Problemele schemei, în română. Se cer cu `safeParse(value, { reportInput: true })`, ca un câmp lipsă să se deosebească de unul greșit. */
export function schemaIssues(error: z.ZodError): SchemaIssue[] {
  return error.issues.slice(0, 50).map((issue) => {
    const post = issue.path[0] === "postari" && typeof issue.path[1] === "number" ? (issue.path[1] as number) : null;
    const field = String(issue.path[issue.path.length - 1] ?? "planul");
    let message = issue.message;
    if (issue.code === "unrecognized_keys") message = `Câmp necunoscut: ${issue.keys.map((key) => `„${key}”`).join(", ")}. Verifică numele (ex. „descriere”, „hashtaguri”, „platforme”).`;
    else if (issue.code === "invalid_type" && !("input" in issue && issue.input !== undefined)) message = `Lipsește „${field}”.`;
    else if (issue.code === "invalid_type") message = `„${field}” trebuie să fie ${EXPECTED[issue.expected] ?? issue.expected}.`;
    else if (/^(Invalid|Too)/.test(message)) message = `„${field}” nu e bun: ${message}`;
    return { path: pathLabel(issue.path), post, message };
  });
}

export function validatePlan(value: unknown): { ok: true; plan: PlanInput } | { ok: false; issues: SchemaIssue[] } {
  const parsed = planSchema.safeParse(value, { reportInput: true });
  return parsed.success ? { ok: true, plan: parsed.data } : { ok: false, issues: schemaIssues(parsed.error) };
}

// ---------------------------------------------------------------------------
// Descrierea
// ---------------------------------------------------------------------------

const HASHTAG_BODY = /^[\p{L}\p{N}_]+$/u;
const HASHTAG_IN_TEXT = /#[\p{L}\p{N}_]+/gu;
const MENTION_IN_TEXT = /(^|\s)@[\w.]+/g;

/** „#Restaurant”, „restaurant” → „restaurant”; `null` dacă nu e un hashtag valid (spații, semne). */
export function normalizeHashtag(tag: string): string | null {
  const body = tag.trim().replace(/^#+/, "");
  return HASHTAG_BODY.test(body) ? body : null;
}

/** Descrierea + hashtag-urile, cum pleacă (Instagram) sau cum se copiază (TikTok). */
export function buildCaption(descriere: string, hashtaguri: string[]): string {
  const seen = new Set<string>();
  const inText = new Set((descriere.match(HASHTAG_IN_TEXT) ?? []).map((tag) => tag.slice(1).toLowerCase()));
  const tags: string[] = [];
  for (const tag of hashtaguri) {
    const body = normalizeHashtag(tag);
    if (!body || seen.has(body.toLowerCase()) || inText.has(body.toLowerCase())) continue;
    seen.add(body.toLowerCase());
    tags.push(`#${body}`);
  }
  return [descriere.trim(), tags.join(" ")].filter(Boolean).join("\n\n");
}

export function captionStats(caption: string): { chars: number; hashtags: number; mentions: number } {
  return {
    // Instagram și TikTok numără caractere (unități UTF-16, „UTF-16 runes” la TikTok).
    chars: caption.length,
    hashtags: (caption.match(HASHTAG_IN_TEXT) ?? []).length,
    mentions: (caption.match(MENTION_IN_TEXT) ?? []).length,
  };
}

/** Ora scrisă de om → ziua și ora locale, sau momentul absolut (ISO cu fus). */
export function readOra(value: string): { kind: "local"; day: string; time: string } | { kind: "absolute"; date: Date } | null {
  const local = value.match(ORA_LOCAL);
  if (local) return isDay(local[1]) ? { kind: "local", day: local[1], time: `${local[2]}:${local[3]}` } : null;
  if (ORA_ISO.test(value)) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : { kind: "absolute", date };
  }
  return null;
}

/** Un exemplu complet, pornit din setări (folderul și orele). */
export function examplePlan(folderName: string | null, ore: string[], fus: string, start: string): string {
  const folder = `${folderName ?? "meridian reclame"}/lot-1`;
  return JSON.stringify(
    {
      format: PLAN_FORMAT,
      nume: "Lot 1 — restaurante",
      folder,
      sloturi: { start, ore, fus },
      postari: [
        {
          fisier: "333f_h3-c2_9x16_larven.mp4",
          platforme: ["instagram", "tiktok"],
          ora: null,
          descriere: "Ai mese goale marțea seara? Un clip scurt, filmat la tine în restaurant, le arată oamenilor din cartier de ce merită să vină. Scrie-ne pe WhatsApp.",
          hashtaguri: ["restaurant", "bucuresti", "meniu"],
          instagram: { tip: "trial_reel", absolvire: "automat" },
          tiktok: { mod: "ciorna" },
        },
        {
          fisier: "mihai_h1-c1_9x16_shopify.mp4",
          platforme: ["instagram"],
          ora: `${start} 19:00`,
          descriere: "Clienții tăi te caută pe telefon. Hai să te găsească. Cere o ofertă.",
          hashtaguri: ["marketingrestaurant", "reclamevideo"],
          instagram: { tip: "reel" },
        },
      ],
    },
    null,
    2
  );
}
