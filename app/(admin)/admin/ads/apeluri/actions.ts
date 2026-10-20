"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient, getAdminUser } from "@/lib/supabase/clients";
import { todayInBucharest } from "@/lib/ads/metrics";
import { clientById } from "@/lib/ads/model/store";
import { campaignOfClient, deleteCallRecord, insertCallRecord } from "@/lib/ads/model/calls";
import { UNKNOWN_CHANNEL, callDayProblem, callFormSchema, type CallFormInput } from "@/lib/ads/model/calls-shared";

/**
 * „Notează apelul” și „Șterge nota”. Doar baza portalului: nimic de aici nu
 * ajunge la Meta, Google sau TikTok. Fiecare acțiune își reverifică sesiunea.
 */

const SESSION_EXPIRED = "Sesiunea a expirat. Reîncarcă pagina și intră din nou în panou.";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Failure = { ok: false; message: string; field?: string };

export async function addCallAction(input: CallFormInput): Promise<{ ok: true; id: string } | Failure> {
  const user = await getAdminUser();
  if (!user) return { ok: false, message: SESSION_EXPIRED };
  const parsed = callFormSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, message: issue?.message ?? "Apelul nu e complet.", field: issue?.path[0]?.toString() };
  }
  const call = parsed.data;
  const dayProblem = callDayProblem(call.calledOn, todayInBucharest());
  if (dayProblem) return { ok: false, message: dayProblem, field: "calledOn" };

  const admin = createAdminClient();
  if (!admin) return { ok: false, message: "Supabase nu e configurat pe server." };
  const client = await clientById(admin, call.clientId);
  if (!client) return { ok: false, message: "Clientul nu mai există. Reîncarcă pagina.", field: "clientId" };

  let platform = call.channel === UNKNOWN_CHANNEL ? null : call.channel;
  if (call.entityId) {
    const campaign = await campaignOfClient(admin, call.entityId, call.clientId);
    if (!campaign.ok) return campaign;
    if (!campaign.data) return { ok: false, message: "Campania aleasă nu e a clientului ăstuia. Alege-o din nou.", field: "entityId" };
    if (platform && campaign.data.platform !== platform) return { ok: false, message: "Campania aleasă e pe alt canal decât cel bifat.", field: "entityId" };
    // Campania își știe canalul.
    platform = campaign.data.platform;
  }

  const saved = await insertCallRecord(admin, {
    clientId: call.clientId,
    platform,
    entityId: call.entityId,
    calledOn: call.calledOn,
    result: call.result,
    note: call.note,
    createdBy: { id: user.id, email: user.email ?? null },
  });
  if (!saved.ok) return saved;
  revalidatePath("/admin/ads", "layout");
  return { ok: true, id: saved.data.id };
}

export async function deleteCallAction(input: { id: string }): Promise<{ ok: true } | Failure> {
  const user = await getAdminUser();
  if (!user) return { ok: false, message: SESSION_EXPIRED };
  if (!UUID.test(input.id)) return { ok: false, message: "Nota nu există." };
  const admin = createAdminClient();
  if (!admin) return { ok: false, message: "Supabase nu e configurat pe server." };
  const removed = await deleteCallRecord(admin, input.id);
  if (!removed.ok) return removed;
  revalidatePath("/admin/ads", "layout");
  return { ok: true };
}
