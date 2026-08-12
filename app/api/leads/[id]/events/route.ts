import { NextResponse, type NextRequest } from "next/server";
import { leadEventInputSchema } from "@/lib/validations/lead";

/**
 * STUB FAZA 0 — implementarea reală e FAZA 6 (insert în lead_events).
 *
 * Contract:
 *  POST /api/leads/[id]/events
 *    body:   LeadEventInput { type, payload }
 *    201 →   { ok: true, id: string }   (id-ul evenimentului)
 *    400 →   { ok: false, error: string }
 *    404 →   { ok: false, error: string }  (F6)
 */

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await params; // id-ul lead-ului — folosit real în F6

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Corpul cererii nu e JSON valid." },
      { status: 400 }
    );
  }

  const parsed = leadEventInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Datele trimise nu sunt valide." },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true, id: crypto.randomUUID() }, { status: 201 });
}
