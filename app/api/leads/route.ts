import { NextResponse, after, type NextRequest } from "next/server";
import {
  leadInputSchema,
  leadListQuerySchema,
  type LeadCreatedResponse,
} from "@/lib/validations/lead";
import { createLead, listLeads } from "@/lib/supabase/leads";
import { getAdminUser } from "@/lib/supabase/clients";
import { sendLeadEmails } from "@/lib/email/send";
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
 * POST /api/leads  — public. Intrarea tuturor formularelor (F3, F5).
 * GET  /api/leads  — protejat. Listarea din dashboard.
 *
 * Semnăturile și formele de răspuns sunt EXACT cele din contractul FAZEI 0
 * (vezi PLAN.md). F3 tratează 429 distinct și orice alt non-2xx ca eșec
 * generic, deci codurile contează.
 */

export async function POST(request: NextRequest) {
  const parsedBody = await readJson(request);
  if (!parsedBody.ok) return apiError(ERRORS.badJson, 400);

  // 1. Honeypot ÎNAINTE de validare — vezi comentariul din _lib/api.ts.
  //    Botul primește un succes credibil; nimic nu se persistă.
  if (isHoneypotTripped(parsedBody.body)) {
    const response: LeadCreatedResponse = { ok: true, id: "" };
    return NextResponse.json(response, { status: 200 });
  }

  // 2. Rate limit pe IP, înaintea oricărei atingeri de bază de date.
  const verdict = rateLimit(`lead:${clientIp(request)}`, LIMITS.leadCreate);
  if (!verdict.allowed) return rateLimitedResponse(verdict);

  // 3. Validare cu schema partajată — aceeași pe care o rulează clientul.
  const parsed = leadInputSchema.safeParse(parsedBody.body);
  if (!parsed.success) return apiError(ERRORS.invalid, 400);

  const result = await createLead(parsed.data);

  if (!result.ok) {
    if (result.reason === "unconfigured") {
      // În dezvoltare, formularele celorlalte faze trebuie să rămână
      // testabile fără .env.local — logăm și confirmăm cu un id sintetic.
      if (process.env.NODE_ENV !== "production") {
        console.info(
          "[leads] Supabase neconfigurat — lead-ul NU a fost salvat:",
          JSON.stringify(parsed.data, null, 2)
        );
        const response: LeadCreatedResponse = { ok: true, id: crypto.randomUUID() };
        return NextResponse.json(response, { status: 201 });
      }
      // În producție, tăcerea ar însemna lead-uri pierdute fără urmă.
      console.error("[leads] Supabase neconfigurat în producție — lead pierdut.");
      return apiError(ERRORS.unavailable, 503);
    }

    console.error("[leads] insert eșuat:", result.detail);
    return apiError(ERRORS.unavailable, 503);
  }

  // 4. Emailurile nu blochează răspunsul: lead-ul e deja salvat, iar
  //    utilizatorul nu are de ce să aștepte după Resend.
  //    Pe un duplicat (dublu-click, refresh) nu se retrimit: omul a primit
  //    deja confirmarea, iar noi am primit deja notificarea.
  //
  //    `after`, nu `void`: pe Vercel funcția e înghețată în clipa în care
  //    răspunsul a plecat, iar o promisiune lăsată în aer nu se mai
  //    termină. Lead-urile ajungeau în bază, notificarea nu ajungea la
  //    nimeni. `after` ține funcția în viață până se termină trimiterea.
  if (result.data.duplicate) {
    console.info(`[leads] trimitere duplicată în fereastra de 5 min — lead ${result.data.id}`);
  } else {
    after(() => sendLeadEmails(result.data));
  }

  const response: LeadCreatedResponse = { ok: true, id: result.data.id };
  return NextResponse.json(response, { status: 201 });
}

export async function GET(request: NextRequest) {
  const user = await getAdminUser();
  if (!user) return apiError(ERRORS.unauthorized, 401);

  const params = Object.fromEntries(request.nextUrl.searchParams);
  const parsed = leadListQuerySchema.safeParse(params);
  if (!parsed.success) return apiError(ERRORS.invalidQuery, 400);

  const result = await listLeads(parsed.data);
  if (!result.ok) {
    if (result.reason === "unconfigured") return apiError(ERRORS.unavailable, 503);
    console.error("[leads] listare eșuată:", result.detail);
    return apiError(ERRORS.unavailable, 503);
  }

  return NextResponse.json({ ok: true, ...result.data });
}
