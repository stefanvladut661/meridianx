import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createReadOnlySessionClient } from "@/lib/supabase/clients";
import type { Platform, VideoUploadType } from "./constants";
import { createMaterialLinks, materialPath } from "./staging";
import type { MaterialRow, MaterialUploadRow } from "./materials-shared";

/**
 * Materialele (migrarea 15) — singurul loc care atinge `ads_materials` și
 * `ads_material_uploads`. Citirile prin sesiune (RLS, `is_lead_admin()`),
 * scrierile prin service role, după ce acțiunea a verificat sesiunea.
 *
 * Un material e un fișier video al agenției, în bucket-ul privat `ads-uploads`,
 * sub `materiale/`. Nu ajunge la nicio platformă până nu e ales într-o campanie:
 * atunci se trimite în contul ales (o singură dată pe cont) și id-ul din
 * biblioteca contului intră în plan.
 */

export const MATERIALS_MIGRATION_MISSING =
  "Tabelele materialelor lipsesc: aplică migrarea 15 (supabase/migrations/00000000000015_ads_materials.sql) în Supabase → SQL Editor.";

type Result<T> = { ok: true; data: T } | { ok: false; message: string };

function failure(error: { code?: string; message?: string } | null | undefined): { ok: false; message: string } {
  const code = error?.code ?? "";
  if (code === "42P01" || code === "PGRST205" || /ads_material/.test(error?.message ?? "")) return { ok: false, message: MATERIALS_MIGRATION_MISSING };
  return { ok: false, message: `Baza de date n-a răspuns cum trebuie. ${error?.message ?? ""}`.trim() };
}

interface MaterialDbRow {
  id: string;
  client_id: string | null;
  name: string;
  storage_path: string;
  content_type: VideoUploadType;
  size_bytes: number | string | null;
  duration_seconds: number | string | null;
  width: number | null;
  height: number | null;
  status: "uploading" | "ready";
  archived_at: string | null;
  created_at: string;
  created_by_email: string | null;
}

interface UploadDbRow {
  id: string;
  material_id: string;
  platform: Platform;
  workspace: string;
  ad_account: string;
  upload_id: string;
  platform_video_id: string | null;
  status: "sent" | "ready" | "failed";
  message: string | null;
  updated_at: string;
}

const MATERIAL_COLUMNS = "id, client_id, name, storage_path, content_type, size_bytes, duration_seconds, width, height, status, archived_at, created_at, created_by_email";
const UPLOAD_COLUMNS = "id, material_id, platform, workspace, ad_account, upload_id, platform_video_id, status, message, updated_at";

const num = (value: number | string | null): number | null => (value === null || value === undefined ? null : Number(value));

function toUpload(row: UploadDbRow): MaterialUploadRow {
  return {
    platform: row.platform,
    workspace: row.workspace,
    adAccount: row.ad_account,
    uploadId: row.upload_id,
    videoId: row.platform_video_id,
    status: row.status,
    message: row.message,
    updatedAt: row.updated_at,
  };
}

/**
 * Materialele active (nearhivate), cele mai noi întâi, cu unde au fost trimise și
 * un link de previzualizare semnat (o oră). `withPreview: false` sare peste linkuri.
 */
export async function listMaterials(options: { withPreview?: boolean } = {}): Promise<Result<MaterialRow[]>> {
  const supabase = await createReadOnlySessionClient();
  if (!supabase) return { ok: false, message: "Supabase nu e configurat pe server." };
  const { data, error } = await supabase.from("ads_materials").select(MATERIAL_COLUMNS).is("archived_at", null).order("created_at", { ascending: false }).limit(300);
  if (error) return failure(error);
  const rows = (data ?? []) as MaterialDbRow[];
  const ids = rows.map((row) => row.id);
  const uploads = new Map<string, MaterialUploadRow[]>();
  if (ids.length > 0) {
    const { data: sent, error: sentError } = await supabase.from("ads_material_uploads").select(UPLOAD_COLUMNS).in("material_id", ids);
    if (sentError) return failure(sentError);
    for (const row of (sent ?? []) as UploadDbRow[]) uploads.set(row.material_id, [...(uploads.get(row.material_id) ?? []), toUpload(row)]);
  }
  const links = options.withPreview === false ? new Map<string, string>() : await createMaterialLinks(rows.filter((row) => row.status === "ready").map((row) => row.storage_path), 60 * 60);
  return {
    ok: true,
    data: rows.map((row) => ({
      id: row.id,
      clientId: row.client_id,
      name: row.name,
      contentType: row.content_type,
      sizeBytes: num(row.size_bytes),
      durationSeconds: num(row.duration_seconds),
      width: row.width,
      height: row.height,
      status: row.status,
      createdAt: row.created_at,
      createdByEmail: row.created_by_email,
      previewUrl: links.get(row.storage_path) ?? null,
      uploads: uploads.get(row.id) ?? [],
    })),
  };
}

export interface NewMaterial {
  id: string;
  clientId: string | null;
  name: string;
  contentType: VideoUploadType;
  sizeBytes: number;
  durationSeconds: number | null;
  width: number | null;
  height: number | null;
  createdBy: { id: string; email: string | null };
}

export async function createMaterialRecord(admin: SupabaseClient, material: NewMaterial): Promise<Result<{ path: string }>> {
  const path = materialPath(material.id, material.contentType);
  const { error } = await admin.from("ads_materials").insert({
    id: material.id,
    client_id: material.clientId,
    name: material.name,
    storage_path: path,
    content_type: material.contentType,
    size_bytes: material.sizeBytes,
    duration_seconds: material.durationSeconds,
    width: material.width,
    height: material.height,
    status: "uploading",
    created_by: material.createdBy.id,
    created_by_email: material.createdBy.email,
  });
  if (error) return failure(error);
  return { ok: true, data: { path } };
}

export async function materialById(admin: SupabaseClient, id: string): Promise<Result<(MaterialDbRow & { storage_path: string }) | null>> {
  const { data, error } = await admin.from("ads_materials").select(MATERIAL_COLUMNS).eq("id", id).maybeSingle();
  if (error) return failure(error);
  return { ok: true, data: (data as MaterialDbRow | null) ?? null };
}

export async function markMaterialReady(admin: SupabaseClient, id: string, sizeBytes: number): Promise<Result<null>> {
  const { error } = await admin.from("ads_materials").update({ status: "ready", size_bytes: sizeBytes }).eq("id", id);
  if (error) return failure(error);
  return { ok: true, data: null };
}

/** Scoate materialul din listă. Fișierul și trimiterile rămân: campaniile făcute cu el nu se ating. */
export async function archiveMaterialRecord(admin: SupabaseClient, id: string): Promise<Result<null>> {
  const { error } = await admin.from("ads_materials").update({ archived_at: new Date().toISOString() }).eq("id", id);
  if (error) return failure(error);
  return { ok: true, data: null };
}

export async function renameMaterialRecord(admin: SupabaseClient, id: string, name: string): Promise<Result<null>> {
  const { error } = await admin.from("ads_materials").update({ name }).eq("id", id);
  if (error) return failure(error);
  return { ok: true, data: null };
}

export async function uploadOf(admin: SupabaseClient, materialId: string, platform: Platform, adAccount: string): Promise<Result<MaterialUploadRow | null>> {
  const { data, error } = await admin
    .from("ads_material_uploads")
    .select(UPLOAD_COLUMNS)
    .eq("material_id", materialId)
    .eq("platform", platform)
    .eq("ad_account", adAccount)
    .maybeSingle();
  if (error) return failure(error);
  return { ok: true, data: data ? toUpload(data as UploadDbRow) : null };
}

/** Trimiterea într-un cont: una pe (material, platformă, cont); o reîncercare după eșec o înlocuiește. */
export async function saveUpload(
  admin: SupabaseClient,
  input: { materialId: string; platform: Platform; workspace: string; adAccount: string; uploadId: string; videoId: string | null; status: "sent" | "ready" | "failed"; message: string | null }
): Promise<Result<null>> {
  const { error } = await admin.from("ads_material_uploads").upsert(
    {
      material_id: input.materialId,
      platform: input.platform,
      workspace: input.workspace,
      ad_account: input.adAccount,
      upload_id: input.uploadId,
      platform_video_id: input.videoId,
      status: input.status,
      message: input.message,
    },
    { onConflict: "material_id,platform,ad_account" }
  );
  if (error) return failure(error);
  return { ok: true, data: null };
}
