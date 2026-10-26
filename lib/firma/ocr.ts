import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { isDay } from "./format";

/**
 * Citirea unui bon sau a unei facturi de la furnizor (poză sau PDF) cu Claude,
 * prin SDK-ul oficial: `claude-opus-5-5`, efort `low` (e o extragere, nu un
 * raționament), răspuns structurat validat cu o schemă zod
 * (`output_config.format`). `fallbacks: "default"` (server-side fallback) lasă
 * serverul să încerce alt model dacă cererea e refuzată de filtrele de siguranță.
 *
 * Cheia: ANTHROPIC_API_KEY, doar în Vercel. Fără ea, citirea e sărită și
 * datele se completează de mână. ANTHROPIC_BASE_URL (citit de SDK) e doar
 * pentru teste.
 */

export const CATEGORII = ["software", "echipament", "transport", "reclame", "altele"] as const;
export type Categorie = (typeof CATEGORII)[number];

const ExtractSchema = z.object({
  lizibil: z.boolean().describe("false dacă documentul nu se poate citi sau nu e un bon / o factură"),
  furnizor: z.string().nullable().describe("numele firmei care a emis documentul (vânzătorul), fără cumpărător"),
  cui_furnizor: z.string().nullable().describe("CUI-ul vânzătorului, doar cifrele, cu RO în față dacă apare așa"),
  data: z.string().nullable().describe("data documentului, AAAA-LL-ZZ"),
  suma: z.number().nullable().describe("totalul de plată, cu TVA inclus dacă există"),
  moneda: z.enum(["RON", "EUR", "USD", "altele"]).nullable(),
  numar_document: z.string().nullable().describe("seria și numărul facturii sau al bonului"),
  descriere: z.string().nullable().describe("ce s-a cumpărat, în cel mult 8 cuvinte, în română"),
  categorie: z.enum(CATEGORII),
});

export type Extracted = z.infer<typeof ExtractSchema>;

export function isOcrConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export const OCR_MISSING = "Citirea automată nu e legată (lipsește ANTHROPIC_API_KEY în Vercel): completează datele de mână.";

const PROMPT = (ourCui: string | null) =>
  [
    "Documentul atașat e un bon fiscal sau o factură primită de o firmă din România (o cheltuială).",
    "Extrage datele vânzătorului (cel care a emis documentul), nu ale cumpărătorului.",
    ourCui ? `CUI-ul cumpărătorului (firma noastră) este ${ourCui}: nu îl pune la furnizor.` : null,
    "Suma e totalul de plată de pe document. Data e data emiterii.",
    "Categoria: software (abonamente, licențe, hosting, domenii, aplicații), echipament (aparatură, calculatoare, accesorii, mobilier), transport (combustibil, taxi, parcare, rovinietă, bilete), reclame (Meta, Google Ads, TikTok, alte reclame plătite), altele.",
    "Un câmp care nu se vede clar rămâne null — nu ghici.",
  ]
    .filter(Boolean)
    .join("\n");

export type OcrResult = { ok: true; data: Extracted } | { ok: false; skipped: boolean; message: string };

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
type ImageType = (typeof IMAGE_TYPES)[number];

export async function readDocument(bytes: Buffer, mimeType: string): Promise<OcrResult> {
  if (!isOcrConfigured()) return { ok: false, skipped: true, message: OCR_MISSING };
  const isPdf = mimeType === "application/pdf";
  const isImage = (IMAGE_TYPES as readonly string[]).includes(mimeType);
  if (!isPdf && !isImage) return { ok: false, skipped: true, message: "Formatul ăsta (ex. HEIC) nu se poate citi automat: completează de mână sau urcă o poză JPEG." };

  const client = new Anthropic({ timeout: 90_000, maxRetries: 2 });
  const data = bytes.toString("base64");
  try {
    const response = await client.beta.messages.parse({
      model: "claude-opus-5-5",
      max_tokens: 2048,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low", format: betaZodOutputFormat(ExtractSchema) },
      messages: [
        {
          role: "user",
          content: [
            isPdf
              ? { type: "document", source: { type: "base64", media_type: "application/pdf", data } }
              : { type: "image", source: { type: "base64", media_type: mimeType as ImageType, data } },
            { type: "text", text: PROMPT(process.env.OBLIO_CIF?.trim() || null) },
          ],
        },
      ],
    });
    if (response.stop_reason === "refusal") return { ok: false, skipped: false, message: "Documentul n-a putut fi citit automat. Completează datele de mână." };
    const parsed = response.parsed_output;
    if (!parsed) return { ok: false, skipped: false, message: "Citirea n-a dat un rezultat întreg. Completează de mână sau citește din nou." };
    if (!parsed.lizibil) return { ok: false, skipped: false, message: "Documentul nu se vede destul de clar. Fă altă poză sau completează de mână." };
    return { ok: true, data: { ...parsed, data: parsed.data && isDay(parsed.data) ? parsed.data : null, suma: parsed.suma !== null && parsed.suma >= 0 ? Math.round(parsed.suma * 100) / 100 : null } };
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) return { ok: false, skipped: false, message: "Citirea e ocupată (limita de cereri). Apasă „Citește din nou” peste un minut." };
    if (error instanceof Anthropic.AuthenticationError) return { ok: false, skipped: false, message: "Cheia ANTHROPIC_API_KEY din Vercel nu e validă." };
    if (error instanceof Anthropic.BadRequestError) return { ok: false, skipped: false, message: `Fișierul n-a fost acceptat pentru citire: ${error.message.slice(0, 200)}` };
    if (error instanceof Anthropic.APIConnectionError) return { ok: false, skipped: false, message: "Citirea n-a răspuns. Apasă „Citește din nou”." };
    if (error instanceof Anthropic.APIError) return { ok: false, skipped: false, message: `Citirea a dat eroare (${error.status ?? "?"}). Apasă „Citește din nou”.` };
    console.error("[firma] citirea documentului a aruncat:", error instanceof Error ? error.message : error);
    return { ok: false, skipped: false, message: "Citirea n-a mers. Completează de mână sau încearcă din nou." };
  }
}
