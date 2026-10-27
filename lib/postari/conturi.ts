import { decryptToken, encryptToken } from "./cripto";
import { db, failure, NO_DB, type Result } from "./db";
import type { Platforma } from "./limite";

/**
 * Conturile Instagram și TikTok (`postari_conturi`, migrarea 27). Tokenurile
 * se scriu doar criptate și se decriptează doar pe server, în momentul în care
 * coada are nevoie de ele. Ecranele primesc doar starea (`ContView`).
 */

const MIGRATION = "27 (00000000000027_postari_conturi.sql)";

export interface ContView {
  platforma: Platforma;
  contId: string;
  nume: string | null;
  tokenExpiraLa: string | null;
  refreshExpiraLa: string | null;
  reinnoitLa: string | null;
  stare: "activ" | "expirat" | "eroare";
  eroare: string | null;
  conectatLa: string;
  conectatDe: string;
}

export interface Cont extends ContView {
  token: string | null;
  refresh: string | null;
}

const str = (value: unknown): string | null => (typeof value === "string" ? value : null);

function toView(row: Record<string, unknown>): ContView {
  return {
    platforma: row.platforma as Platforma,
    contId: String(row.cont_id),
    nume: str(row.nume),
    tokenExpiraLa: str(row.token_expira_la),
    refreshExpiraLa: str(row.refresh_expira_la),
    reinnoitLa: str(row.reinnoit_la),
    stare: (row.stare as ContView["stare"]) ?? "activ",
    eroare: str(row.eroare),
    conectatLa: String(row.conectat_la),
    conectatDe: String(row.conectat_de),
  };
}

export async function listAccounts(): Promise<Result<ContView[]>> {
  const admin = db();
  if (!admin) return { ok: false, message: NO_DB };
  const { data, error } = await admin.from("postari_conturi").select("platforma, cont_id, nume, token_expira_la, refresh_expira_la, reinnoit_la, stare, eroare, conectat_la, conectat_de");
  if (error) return failure(error, MIGRATION);
  return { ok: true, data: (data ?? []).map((row) => toView(row as Record<string, unknown>)) };
}

/** Contul cu tokenurile decriptate (doar pentru coadă și conectare). `token: null` = nu se poate decripta. */
export async function readAccount(platform: Platforma): Promise<Result<Cont | null>> {
  const admin = db();
  if (!admin) return { ok: false, message: NO_DB };
  const { data, error } = await admin.from("postari_conturi").select("*").eq("platforma", platform).maybeSingle();
  if (error) return failure(error, MIGRATION);
  if (!data) return { ok: true, data: null };
  const row = data as Record<string, unknown>;
  return {
    ok: true,
    data: {
      ...toView(row),
      token: typeof row.token_criptat === "string" ? decryptToken(row.token_criptat, platform, "access") : null,
      refresh: typeof row.refresh_criptat === "string" ? decryptToken(row.refresh_criptat, platform, "refresh") : null,
    },
  };
}

export interface SaveAccount {
  platforma: Platforma;
  contId: string;
  nume: string | null;
  token: string;
  tokenExpiraLa: string | null;
  refresh?: string | null;
  refreshExpiraLa?: string | null;
  scope?: string | null;
  actor: string;
}

/** Conectarea (sau reconectarea) unui cont: rândul se înlocuiește, starea redevine „activ”. */
export async function saveAccount(input: SaveAccount): Promise<Result<null>> {
  const admin = db();
  if (!admin) return { ok: false, message: NO_DB };
  const now = new Date().toISOString();
  const { error } = await admin.from("postari_conturi").upsert(
    {
      platforma: input.platforma,
      cont_id: input.contId.slice(0, 200),
      nume: input.nume?.slice(0, 200) ?? null,
      token_criptat: encryptToken(input.token, input.platforma, "access"),
      token_expira_la: input.tokenExpiraLa,
      refresh_criptat: input.refresh ? encryptToken(input.refresh, input.platforma, "refresh") : null,
      refresh_expira_la: input.refreshExpiraLa ?? null,
      scope: input.scope?.slice(0, 500) ?? null,
      reinnoit_la: now,
      stare: "activ",
      eroare: null,
      conectat_la: now,
      conectat_de: input.actor.slice(0, 200),
      updated_at: now,
    },
    { onConflict: "platforma" }
  );
  if (error) return failure(error, MIGRATION);
  return { ok: true, data: null };
}

/** Tokenul reînnoit: doar tokenurile și termenele se schimbă. */
export async function saveRefreshed(platform: Platforma, input: { token: string; tokenExpiraLa: string | null; refresh?: string | null; refreshExpiraLa?: string | null }): Promise<Result<null>> {
  const admin = db();
  if (!admin) return { ok: false, message: NO_DB };
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { token_criptat: encryptToken(input.token, platform, "access"), token_expira_la: input.tokenExpiraLa, reinnoit_la: now, stare: "activ", eroare: null, updated_at: now };
  if (input.refresh) {
    patch.refresh_criptat = encryptToken(input.refresh, platform, "refresh");
    patch.refresh_expira_la = input.refreshExpiraLa ?? null;
  }
  const { error } = await admin.from("postari_conturi").update(patch).eq("platforma", platform);
  if (error) return failure(error, MIGRATION);
  return { ok: true, data: null };
}

export async function markAccount(platform: Platforma, stare: "expirat" | "eroare" | "activ", eroare: string | null): Promise<void> {
  const admin = db();
  if (!admin) return;
  await admin.from("postari_conturi").update({ stare, eroare: eroare?.slice(0, 1000) ?? null, updated_at: new Date().toISOString() }).eq("platforma", platform);
}

export async function deleteAccount(platform: Platforma): Promise<Result<null>> {
  const admin = db();
  if (!admin) return { ok: false, message: NO_DB };
  const { error } = await admin.from("postari_conturi").delete().eq("platforma", platform);
  if (error) return failure(error, MIGRATION);
  return { ok: true, data: null };
}
