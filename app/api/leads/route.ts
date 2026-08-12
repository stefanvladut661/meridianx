import { NextResponse, type NextRequest } from "next/server";
import {
  leadInputSchema,
  leadListQuerySchema,
  type LeadCreatedResponse,
} from "@/lib/validations/lead";

/**
 * STUB FAZA 0 — implementarea reală (Supabase insert, email Resend,
 * rate limiting pe IP, auth pe GET) e livrabilul FAZEI 6, care
 * păstrează EXACT aceste semnături și forme de răspuns.
 *
 * Contract:
 *  POST /api/leads
 *    body:    LeadInput (lib/validations/lead.ts)
 *    201  →   { ok: true, id: string }
 *    400  →   { ok: false, error: string }        (validare eșuată)
 *    429  →   { ok: false, error: string }        (rate limit — F6)
 *    Honeypot non-gol → 200 { ok: true, id: "" }  (răspuns fals, fără insert)
 *
 *  GET /api/leads?division=&status=&q=&from=&to=&page=&perPage=
 *    protejat (doar admin autentificat — F6)
 *    200  →   { ok: true, items: Lead[], total: number, page: number, perPage: number }
 */

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Corpul cererii nu e JSON valid." },
      { status: 400 }
    );
  }

  const parsed = leadInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Datele trimise nu sunt valide." },
      { status: 400 }
    );
  }

  // Honeypot completat → răspuns fals de succes, fără persistare.
  if (parsed.data.website) {
    return NextResponse.json({ ok: true, id: "" }, { status: 200 });
  }

  // F6 înlocuiește cu: insert Supabase (service role) + lead_event 'created'
  // + notificare email + rate limiting. Până atunci: id sintetic.
  const response: LeadCreatedResponse = { ok: true, id: crypto.randomUUID() };
  return NextResponse.json(response, { status: 201 });
}

export async function GET(request: NextRequest) {
  const params = Object.fromEntries(request.nextUrl.searchParams);
  const parsed = leadListQuerySchema.safeParse(params);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Parametrii de filtrare nu sunt valizi." },
      { status: 400 }
    );
  }

  // F6 adaugă autentificarea și interogarea reală.
  return NextResponse.json({
    ok: true,
    items: [],
    total: 0,
    page: parsed.data.page,
    perPage: parsed.data.perPage,
  });
}
