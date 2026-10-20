"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createAdminClient, getAdminUser } from "@/lib/supabase/clients";
import type { VideoUploadType } from "@/lib/ads/constants";
import { createMaterialUpload, materialSize, validateUpload } from "@/lib/ads/staging";
import { archiveMaterialRecord, createMaterialRecord, markMaterialReady, materialById, renameMaterialRecord } from "@/lib/ads/materials";
import { MATERIAL_NAME_MAX } from "@/lib/ads/materials-shared";
import { clientById } from "@/lib/ads/model/store";

/**
 * Materialele: urcarea în biblioteca portalului (browser → bucket-ul privat,
 * printr-un URL semnat pentru UN fișier), confirmarea ei, redenumirea și
 * scoaterea din listă. Nimic de aici nu ajunge la o platformă — trimiterea
 * într-un cont se face din „Creează”, la verificare.
 */

const SESSION_EXPIRED = "Sesiunea a expirat. Reîncarcă pagina și intră din nou în panou.";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Failure = { ok: false; message: string };

function cleanName(name: string): string {
  return name.replace(/[\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim().slice(0, MATERIAL_NAME_MAX);
}

const finiteOrNull = (value: unknown, max: number) => (typeof value === "number" && Number.isFinite(value) && value > 0 && value <= max ? value : null);

export async function prepareMaterialUpload(input: {
  name: string;
  clientId: string | null;
  file: { size: number; type: string };
  video: { duration: number | null; width: number | null; height: number | null };
}): Promise<{ ok: true; id: string; uploadUrl: string } | Failure> {
  const user = await getAdminUser();
  if (!user) return { ok: false, message: SESSION_EXPIRED };
  const invalid = validateUpload(input.file);
  if (invalid) return { ok: false, message: invalid };
  const name = cleanName(input.name);
  if (!name) return { ok: false, message: "Dă-i materialului un nume — cel după care îl recunoști în listă." };

  const admin = createAdminClient();
  if (!admin) return { ok: false, message: "Supabase nu e configurat pe server." };
  if (input.clientId !== null) {
    if (!UUID.test(input.clientId) || !(await clientById(admin, input.clientId))) return { ok: false, message: "Clientul ales nu mai există. Reîncarcă pagina." };
  }

  const id = randomUUID();
  const record = await createMaterialRecord(admin, {
    id,
    clientId: input.clientId,
    name,
    contentType: input.file.type as VideoUploadType,
    sizeBytes: input.file.size,
    durationSeconds: finiteOrNull(input.video.duration, 3600),
    width: finiteOrNull(input.video.width, 10_000),
    height: finiteOrNull(input.video.height, 10_000),
    createdBy: { id: user.id, email: user.email ?? null },
  });
  if (!record.ok) return record;
  const upload = await createMaterialUpload(record.data.path);
  if (!upload.ok) return upload;
  return { ok: true, id, uploadUrl: upload.data.uploadUrl };
}

/** Browserul a terminat urcarea: fișierul e în stocare? Abia atunci materialul apare ca gata. */
export async function finishMaterialUpload(input: { id: string }): Promise<{ ok: true } | Failure> {
  const user = await getAdminUser();
  if (!user) return { ok: false, message: SESSION_EXPIRED };
  if (!UUID.test(input.id)) return { ok: false, message: "Materialul nu există." };
  const admin = createAdminClient();
  if (!admin) return { ok: false, message: "Supabase nu e configurat pe server." };
  const material = await materialById(admin, input.id);
  if (!material.ok) return material;
  if (!material.data) return { ok: false, message: "Materialul nu există." };
  const size = await materialSize(material.data.storage_path);
  if (size === null) return { ok: false, message: "Fișierul nu a ajuns în stocare. Urcă-l din nou." };
  const ready = await markMaterialReady(admin, input.id, size);
  if (!ready.ok) return ready;
  revalidatePath("/admin/ads/materiale");
  return { ok: true };
}

export async function renameMaterial(input: { id: string; name: string }): Promise<{ ok: true } | Failure> {
  const user = await getAdminUser();
  if (!user) return { ok: false, message: SESSION_EXPIRED };
  if (!UUID.test(input.id)) return { ok: false, message: "Materialul nu există." };
  const name = cleanName(input.name);
  if (!name) return { ok: false, message: "Numele nu poate fi gol." };
  const admin = createAdminClient();
  if (!admin) return { ok: false, message: "Supabase nu e configurat pe server." };
  const renamed = await renameMaterialRecord(admin, input.id, name);
  if (!renamed.ok) return renamed;
  revalidatePath("/admin/ads/materiale");
  return { ok: true };
}

export async function archiveMaterial(input: { id: string }): Promise<{ ok: true } | Failure> {
  const user = await getAdminUser();
  if (!user) return { ok: false, message: SESSION_EXPIRED };
  if (!UUID.test(input.id)) return { ok: false, message: "Materialul nu există." };
  const admin = createAdminClient();
  if (!admin) return { ok: false, message: "Supabase nu e configurat pe server." };
  const archived = await archiveMaterialRecord(admin, input.id);
  if (!archived.ok) return archived;
  revalidatePath("/admin/ads/materiale");
  return { ok: true };
}
