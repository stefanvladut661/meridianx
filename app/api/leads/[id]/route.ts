import { NextResponse, type NextRequest } from "next/server";
import { leadPatchSchema } from "@/lib/validations/lead";
import { deleteLead, getLead, updateLead } from "@/lib/supabase/leads";
import { getAdminUser } from "@/lib/supabase/clients";
import { ERRORS, apiError, readJson } from "../../_lib/api";

/**
 * GET    /api/leads/[id]  — protejat. Lead + istoric de evenimente.
 * PATCH  /api/leads/[id]  — protejat. Status și note, cu eveniment în istoric.
 * DELETE /api/leads/[id]  — protejat. Ștergere definitivă, cu istoric cu tot.
 *
 * GET nu era în contractul FAZEI 0, dar nu îl contrazice: dashboard-ul
 * citește direct prin stratul de date, iar ruta e utilă pentru integrări
 * ulterioare (iterația 2 — CRM). Formele de răspuns urmează același tipar.
 */

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAdminUser();
  if (!user) return apiError(ERRORS.unauthorized, 401);

  const { id } = await params;
  const result = await getLead(id);

  if (!result.ok) {
    if (result.reason === "not_found") return apiError(ERRORS.notFound, 404);
    if (result.reason === "unconfigured") return apiError(ERRORS.unavailable, 503);
    console.error("[leads] citire eșuată:", result.detail);
    return apiError(ERRORS.unavailable, 503);
  }

  return NextResponse.json({ ok: true, ...result.data });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAdminUser();
  if (!user) return apiError(ERRORS.unauthorized, 401);

  const { id } = await params;

  const parsedBody = await readJson(request);
  if (!parsedBody.ok) return apiError(ERRORS.badJson, 400);

  const parsed = leadPatchSchema.safeParse(parsedBody.body);
  if (!parsed.success) return apiError(ERRORS.invalid, 400);

  const result = await updateLead(id, parsed.data, user.email);

  if (!result.ok) {
    if (result.reason === "not_found") return apiError(ERRORS.notFound, 404);
    if (result.reason === "unconfigured") return apiError(ERRORS.unavailable, 503);
    console.error("[leads] update eșuat:", result.detail);
    return apiError(ERRORS.unavailable, 503);
  }

  return NextResponse.json({ ok: true, id: result.data.id });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAdminUser();
  if (!user) return apiError(ERRORS.unauthorized, 401);

  const { id } = await params;
  const result = await deleteLead(id);

  if (!result.ok) {
    if (result.reason === "not_found") return apiError(ERRORS.notFound, 404);
    if (result.reason === "unconfigured") return apiError(ERRORS.unavailable, 503);
    console.error("[leads] ștergere eșuată:", result.detail);
    return apiError(ERRORS.unavailable, 503);
  }

  console.info(`[leads] lead ${id} șters de ${user.email ?? "admin"}`);
  return NextResponse.json({ ok: true, id });
}
