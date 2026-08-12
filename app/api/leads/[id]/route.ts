import { NextResponse, type NextRequest } from "next/server";
import { leadPatchSchema } from "@/lib/validations/lead";

/**
 * STUB FAZA 0 — implementarea reală e FAZA 6 (auth + update Supabase
 * + lead_event 'status_changed'/'note_added').
 *
 * Contract:
 *  PATCH /api/leads/[id]
 *    body:   LeadPatch { status?, notes? }
 *    200 →   { ok: true, id: string }
 *    400 →   { ok: false, error: string }
 *    404 →   { ok: false, error: string }  (F6)
 */

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Corpul cererii nu e JSON valid." },
      { status: 400 }
    );
  }

  const parsed = leadPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Datele trimise nu sunt valide." },
      { status: 400 }
    );
  }

  // F6 înlocuiește cu update real + verificare de existență.
  return NextResponse.json({ ok: true, id });
}
