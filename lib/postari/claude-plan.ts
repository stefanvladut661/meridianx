import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import type { Manifest, ManifestClip } from "./manifest";
import { normalizeHashtag } from "./plan-schema";

/**
 * Descrierile și hashtag-urile scrise de Claude din `manifest.json`, prin
 * SDK-ul oficial, la fel ca citirea bonurilor din adminul firmei:
 * `claude-opus-5-5`, răspuns structurat validat cu o schemă zod
 * (`output_config.format`) și `fallbacks: "default"` (dacă cererea e refuzată
 * de filtrele de siguranță, serverul încearcă alt model).
 *
 * Câte un lot mic de clipuri pe cerere, ca un apel să încapă în limita de
 * 60 de secunde a funcțiilor Vercel. Ecranul cere loturile pe rând și îi dă
 * lui Claude descrierile deja scrise, ca să nu se repete.
 *
 * Cheia: ANTHROPIC_API_KEY, aceeași ca la adminul firmei. ANTHROPIC_BASE_URL
 * (citit de SDK) e doar pentru teste.
 */

export const CLAUDE_BATCH = 5;
export const CLAUDE_MISSING = "Claude nu e legat: lipsește ANTHROPIC_API_KEY în Vercel. Planul se poate scrie și de mână, la Plan nou.";

export function isClaudeConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

const OutputSchema = z.object({
  postari: z.array(
    z.object({
      fisier: z.string().describe("numele clipului, exact ca în listă"),
      descriere: z.string().describe("textul postării, în română, fără hashtag-uri"),
      hashtaguri: z.array(z.string()).describe("3–6 hashtag-uri, fără #, fără spații, fără diacritice"),
    })
  ),
});

export interface Caption {
  fisier: string;
  descriere: string;
  hashtaguri: string[];
}

export type CaptionsResult = { ok: true; data: Caption[]; missing: string[] } | { ok: false; message: string };

const SYSTEM = [
  "Scrii descrierile postărilor pentru conturile de Instagram și TikTok ale agenției MERIDIAN, care face reclame video și campanii pentru afaceri locale din România.",
  "Fiecare clip e o reclamă MERIDIAN. Primești pentru fiecare: hookul (ideea de deschidere), CTA-ul (ce să facă omul), vocea și stilul, plus contextul lotului. Aceeași descriere pleacă pe Instagram și se lipește pe TikTok.",
  "",
  "Cum scrii:",
  "- În română, cu diacritice (ș și ț cu virgulă). Verbe active, propoziții scurte. Direct, sigur pe el, puțin obraznic. Specific bate deștept.",
  "- 1–3 propoziții, cel mult 300 de caractere. Deschizi cu ideea hookului (nu e nevoie să-l copiezi cuvânt cu cuvânt) și închei cu CTA-ul clipului.",
  "- Nu inventa nimic: fără prețuri, reduceri, cifre, rezultate, garanții, nume de clienți sau orașe care nu apar în date.",
  "- Fără hashtag-uri și fără emoji în descriere (decât dacă indicațiile omului cer altfel). Fără „soluții inovatoare”, „experiență de neuitat”, „partenerul tău de încredere” sau alte formule de agenție.",
  "- Fiecare descriere sună altfel: nu repeta deschiderea sau structura altei descrieri din lot ori din cele deja scrise.",
  "- Hashtag-uri: 3–6, legate de ce vinde clipul și de publicul lui, cu litere mici, fără #, fără spații și fără diacritice.",
  "- Scrii câte o intrare pentru fiecare clip din listă, cu numele fișierului exact cum e dat.",
].join("\n");

function clipForPrompt(clip: ManifestClip) {
  return {
    fisier: clip.fisier,
    hook: clip.hook ? [clip.hook.cod, clip.hook.text].filter(Boolean).join(": ") || null : null,
    cta: clip.cta ? clip.cta.text ?? clip.cta.cod : null,
    voce: clip.voce,
    stil: clip.stil,
    durata_secunde: clip.durata,
    ...clip.extra,
  };
}

/** Taie la 300 de caractere, la ultimul cuvânt întreg. */
function trimCaption(text: string): string {
  const clean = text.replace(/\s+\n/g, "\n").trim();
  if (clean.length <= 300) return clean;
  const cut = clean.slice(0, 300);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), 200)).trimEnd()}…`;
}

export async function writeCaptions(input: { manifest: Manifest; clips: ManifestClip[]; indicatii: string; deja: string[] }): Promise<CaptionsResult> {
  if (!isClaudeConfigured()) return { ok: false, message: CLAUDE_MISSING };
  if (input.clips.length === 0) return { ok: true, data: [], missing: [] };
  const payload = {
    context_lot: input.manifest.context,
    clipuri: input.clips.map(clipForPrompt),
    descrieri_deja_scrise: input.deja.slice(-30),
  };
  const prompt = [
    "Datele lotului (JSON):",
    "```json",
    JSON.stringify(payload, null, 2),
    "```",
    input.indicatii.trim() ? `Indicațiile omului pentru lotul ăsta (au prioritate față de stil, nu față de regula „nu inventa”):\n${input.indicatii.trim()}` : null,
    `Scrie descrierile pentru cele ${input.clips.length} clipuri.`,
  ]
    .filter(Boolean)
    .join("\n\n");

  // Un singur apel pe lot, fără reîncercări în SDK: ecranul reîncearcă lotul, iar funcția are 60 de secunde.
  const client = new Anthropic({ timeout: 50_000, maxRetries: 0 });
  try {
    const response = await client.beta.messages.parse({
      model: "claude-opus-5-5",
      max_tokens: 8000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low", format: betaZodOutputFormat(OutputSchema) },
      system: SYSTEM,
      messages: [{ role: "user", content: prompt }],
    });
    if (response.stop_reason === "refusal") return { ok: false, message: "Claude n-a scris descrierile pentru lotul ăsta. Scrie-le de mână în plan sau schimbă indicațiile." };
    if (response.stop_reason === "max_tokens") return { ok: false, message: "Răspunsul lui Claude s-a tăiat. Reîncearcă." };
    const parsed = response.parsed_output;
    if (!parsed) return { ok: false, message: "Claude n-a dat un răspuns întreg. Reîncearcă." };
    const wanted = new Set(input.clips.map((clip) => clip.fisier));
    const data: Caption[] = [];
    for (const item of parsed.postari) {
      if (!wanted.has(item.fisier) || data.some((done) => done.fisier === item.fisier)) continue;
      const hashtaguri = [...new Set(item.hashtaguri.map((tag) => normalizeHashtag(tag)?.toLowerCase()).filter((tag): tag is string => Boolean(tag)))].slice(0, 8);
      data.push({ fisier: item.fisier, descriere: trimCaption(item.descriere), hashtaguri });
    }
    const missing = input.clips.map((clip) => clip.fisier).filter((name) => !data.some((done) => done.fisier === name));
    return { ok: true, data, missing };
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) return { ok: false, message: "Claude e ocupat (limita de cereri). Apasă „Continuă” peste un minut." };
    if (error instanceof Anthropic.AuthenticationError) return { ok: false, message: "Cheia ANTHROPIC_API_KEY din Vercel nu e validă." };
    if (error instanceof Anthropic.BadRequestError) return { ok: false, message: `Claude a refuzat cererea: ${error.message.slice(0, 200)}` };
    if (error instanceof Anthropic.APIConnectionError) return { ok: false, message: "Claude n-a răspuns la timp. Apasă „Continuă”." };
    if (error instanceof Anthropic.APIError) return { ok: false, message: `Claude a dat eroare (${error.status ?? "?"}). Apasă „Continuă”.` };
    console.error("[postari] descrierile Claude au aruncat:", error instanceof Error ? error.message : error);
    return { ok: false, message: "Descrierile n-au putut fi scrise. Apasă „Continuă”." };
  }
}
