import { NextResponse, type NextRequest } from "next/server";
import { leadEventInputSchema } from "@/lib/validations/lead";
import { addLeadEvent } from "@/lib/supabase/leads";
import {
  ERRORS,
  LIMITS,
  apiError,
  clientIp,
  rateLimit,
  rateLimitedResponse,
  readJson,
} from "../../../_lib/api";

/**
 * POST /api/leads/[id]/events — PUBLIC.
 *
 * De ce publică: F5 trimite pașii de brief și folosirea estimatorului
 * pentru un lead deja creat, din browserul clientului. Nu există sesiune.
 *
 * Ce o apără:
 * - id-ul e UUID v4 — nu se ghicește, iar un lead necunoscut dă 404;
 * - rate limit pe IP;
 * - `type` și `payload` sunt validate de schema FAZEI 0, deci nu se poate
 *   umple tabelul cu orice.
 *
 * Ce NU poate face un atacator care are un id valid: să citească ceva, să
 * modifice lead-ul sau statusul. Doar să adauge zgomot în istoricul unui
 * singur lead. Compromisul e asumat — alternativa (token semnat per lead)
 * ar fi cerut un contract nou cu F5, care lucra în paralel.
 */

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const verdict = rateLimit(`event:${clientIp(request)}`, LIMITS.leadEvent);
  if (!verdict.allowed) return rateLimitedResponse(verdict);

  const parsedBody = await readJson(request);
  if (!parsedBody.ok) return apiError(ERRORS.badJson, 400);

  const parsed = leadEventInputSchema.safeParse(parsedBody.body);
  if (!parsed.success) return apiError(ERRORS.invalid, 400);

  const result = await addLeadEvent(id, parsed.data.type, parsed.data.payload);

  if (!result.ok) {
    if (result.reason === "not_found") return apiError(ERRORS.notFound, 404);
    if (result.reason === "unconfigured") {
      // Ca la POST /api/leads: în dev, F5 trebuie să poată testa fluxul
      // fără .env.local. Evenimentele sunt telemetrie, nu date critice.
      if (process.env.NODE_ENV !== "production") {
        console.info(`[events] Supabase neconfigurat — eveniment ignorat: ${parsed.data.type}`);
        return NextResponse.json({ ok: true, id: crypto.randomUUID() }, { status: 201 });
      }
      return apiError(ERRORS.unavailable, 503);
    }
    console.error("[events] insert eșuat:", result.detail);
    return apiError(ERRORS.unavailable, 503);
  }

  return NextResponse.json({ ok: true, id: result.data }, { status: 201 });
}
