"use server";

import { revalidatePath } from "next/cache";
import { getAdminUser } from "@/lib/supabase/clients";
import { updateLead } from "@/lib/supabase/leads";
import { LEAD_STATUSES, type LeadStatus } from "@/lib/validations/lead";

/**
 * Acțiunile din panoul de detaliu (FAZA 6).
 *
 * Fiecare își reverifică sesiunea. Garda din layout protejează randarea,
 * nu și acțiunile: o acțiune de server e un endpoint POST care poate fi
 * apelat direct, deci autorizarea se face aici, nu se presupune.
 */

export interface PanelState {
  error: string | null;
  ok: string | null;
}

function isStatus(value: unknown): value is LeadStatus {
  return typeof value === "string" && LEAD_STATUSES.includes(value as LeadStatus);
}

export async function changeStatus(
  _previous: PanelState,
  formData: FormData
): Promise<PanelState> {
  const user = await getAdminUser();
  if (!user) return { error: "Sesiunea a expirat. Reautentifică-te.", ok: null };

  const id = String(formData.get("id") ?? "");
  /* Statusul vine pe două căi: câmpul ascuns pe care îl setează clicul
     (cu JavaScript) și butonul apăsat (name/value, când browserul îl
     trimite ca submitter). Ultimul câștigă — fără JavaScript, butonul
     e cel care spune ce a ales omul. Așa nu mai depindem de faptul că
     runtime-ul pune sau nu submitter-ul în FormData. */
  const status = formData.getAll("status").at(-1);

  if (!id || !isStatus(status)) {
    return { error: "Status invalid.", ok: null };
  }

  const result = await updateLead(id, { status }, user.email);
  if (!result.ok) {
    if (result.reason === "not_found") {
      return { error: "Lead-ul nu mai există.", ok: null };
    }
    return { error: "Nu s-a putut salva. Încearcă din nou.", ok: null };
  }

  revalidatePath("/admin");
  return { error: null, ok: "Status actualizat." };
}

export async function saveNotes(
  _previous: PanelState,
  formData: FormData
): Promise<PanelState> {
  const user = await getAdminUser();
  if (!user) return { error: "Sesiunea a expirat. Reautentifică-te.", ok: null };

  const id = String(formData.get("id") ?? "");
  const notes = String(formData.get("notes") ?? "");

  if (!id) return { error: "Lead lipsă.", ok: null };
  if (notes.length > 10_000) {
    return { error: "Notele depășesc 10.000 de caractere.", ok: null };
  }

  const result = await updateLead(id, { notes }, user.email);
  if (!result.ok) {
    if (result.reason === "not_found") {
      return { error: "Lead-ul nu mai există.", ok: null };
    }
    return { error: "Nu s-au putut salva notele. Încearcă din nou.", ok: null };
  }

  revalidatePath("/admin");
  return { error: null, ok: "Note salvate." };
}
