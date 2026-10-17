import { NextResponse, after, type NextRequest } from "next/server";
import { z } from "zod";
import { leadInputSchema } from "@/lib/validations/lead";
import { addLeadEvent, createLead } from "@/lib/supabase/leads";
import { sendQuestionnaireEmail } from "@/lib/email/questionnaire";
import {
  answersAsText,
  cleanAnswer,
  getQuestionnaire,
} from "@/components/site/questionnaire/registry";
import {
  ERRORS,
  LIMITS,
  apiError,
  clientIp,
  isHoneypotTripped,
  rateLimit,
  rateLimitedResponse,
  readJson,
} from "../_lib/api";

/**
 * POST /api/chestionar — public. Răspunsurile unui chestionar de
 * descoperire (/chestionar/<slug>).
 *
 * De ce nu direct /api/leads: răspunsurile depășesc ușor plafonul de
 * 5.000 de caractere al câmpului `message` din contractul înghețat. Ruta
 * face deci două lucruri:
 *   1. salvează lead-ul prin `createLead`, cu începutul textului în
 *      `message` și răspunsurile complete într-un `lead_event`, ca omul
 *      să apară în dashboard ca orice altă cerere;
 *   2. trimite pe email TOATE răspunsurile, fără plafon.
 * Dacă baza nu e disponibilă, emailul rămâne singura cale și îl
 * așteptăm înainte să răspundem; dacă nu pleacă nici el, 503.
 */

const bodySchema = z.object({
  slug: z.string().min(1).max(60),
  name: z.string().trim().min(2).max(120),
  email: z.union([z.email().max(254), z.literal("")]).optional(),
  answers: z.record(z.string().max(60), z.string().max(12000)),
  website: z.string().max(200).optional(),
});

/** Plafonul câmpului `message` din `lib/validations/lead.ts`. */
const MESSAGE_LIMIT = 5000;

export async function POST(request: NextRequest) {
  const parsedBody = await readJson(request);
  if (!parsedBody.ok) return apiError(ERRORS.badJson, 400);

  // Honeypot înaintea validării, ca la /api/leads: botul crede că a reușit.
  if (isHoneypotTripped(parsedBody.body)) {
    return NextResponse.json({ ok: true, id: "" }, { status: 200 });
  }

  const verdict = rateLimit(`chestionar:${clientIp(request)}`, LIMITS.leadCreate);
  if (!verdict.allowed) return rateLimitedResponse(verdict);

  const parsed = bodySchema.safeParse(parsedBody.body);
  if (!parsed.success) return apiError(ERRORS.invalid, 400);

  const config = getQuestionnaire(parsed.data.slug);
  if (!config) return apiError("Chestionarul nu există.", 404);

  // Doar întrebările cunoscute, curățate de rândurile goale cu liniuță.
  const answers: Record<string, string> = {};
  for (const question of config.questions) {
    const answer = cleanAnswer(parsed.data.answers[question.id] ?? "");
    if (answer) answers[question.id] = answer;
  }
  if (Object.keys(answers).length === 0) {
    return apiError("Nu a sosit niciun răspuns.", 400);
  }

  const name = parsed.data.name;
  const email = parsed.data.email?.trim() || null;
  const text = answersAsText(config, answers);
  const message =
    text.length > MESSAGE_LIMIT
      ? `${text.slice(0, MESSAGE_LIMIT - 80).trimEnd()}\n\n[…continuarea e în emailul cu răspunsuri și în istoricul lead-ului]`
      : text;

  let leadId: string | null = null;
  const leadInput = leadInputSchema.safeParse({
    division: "software",
    source: `chestionar-${config.slug}`,
    locale: "ro",
    name,
    email: email ?? undefined,
    company: config.clientCompany,
    projectType: "Chestionar de descoperire",
    message,
    isFunded: false,
  });

  if (leadInput.success) {
    const result = await createLead(leadInput.data);
    if (result.ok) {
      leadId = result.data.id;
      const event = await addLeadEvent(leadId, "questionnaire_answers", {
        slug: config.slug,
        answers,
      });
      if (!event.ok) {
        console.error("[chestionar] lead salvat, răspunsurile complete nu:", event.detail);
      }
    } else if (result.reason !== "unconfigured") {
      console.error("[chestionar] lead-ul nu s-a salvat:", result.detail);
    }
  }

  if (leadId) {
    // Lead-ul e în bază; emailul nu mai blochează răspunsul (`after`
    // ține funcția vie pe Vercel până pleacă, ca la /api/leads).
    const id = leadId;
    after(() => sendQuestionnaireEmail({ config, name, email, answers, leadId: id }));
    return NextResponse.json({ ok: true, id }, { status: 201 });
  }

  // Fără bază, emailul e singura copie: îl așteptăm.
  const sent = await sendQuestionnaireEmail({ config, name, email, answers, leadId: null });
  if (sent === "sent") {
    return NextResponse.json({ ok: true, id: "" }, { status: 201 });
  }

  if (process.env.NODE_ENV !== "production") {
    console.info(`[chestionar] fără bază și fără email — răspunsurile lui ${name}:\n${text}`);
    return NextResponse.json({ ok: true, id: crypto.randomUUID() }, { status: 201 });
  }

  console.error("[chestionar] nici baza, nici emailul — răspunsuri pierdute pentru", name);
  return apiError(ERRORS.unavailable, 503);
}
