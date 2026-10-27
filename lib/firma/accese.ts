import { z } from "zod";
import { db, failure, NO_DB, type Result } from "./db";
import { isDay } from "./format";
import { looksLikeSecret, STARTER_ACCOUNTS, type CategorieCont, type ContFirma } from "./accese-shared";

/** Lista conturilor firmei (migrarea 22). Parolele nu stau aici — doar unde sunt. */

const MIGRATION = "22 (00000000000022_firma_accese.sql)";
type Row = Record<string, unknown>;
const text = (value: unknown) => (typeof value === "string" && value !== "" ? value : null);

const noSecret = (label: string, max: number) =>
  z
    .string()
    .trim()
    .max(max, `${label}: cel mult ${max} caractere.`)
    .refine((value) => !looksLikeSecret(value), `${label}: pare o parolă sau o cheie. Parolele stau în managerul de parole; aici scrii doar unde sunt (ex. „managerul de parole → seiful Firmă”).`)
    .transform((value) => (value === "" ? null : value));

export const accountSchema = z.object({
  nume: z.string().trim().min(1, "Scrie numele contului.").max(120),
  categoria: z.enum(["platforma", "banca", "facturare", "google", "meta", "tiktok", "vercel", "supabase", "github", "domeniu", "altele"]),
  adresa: z
    .string()
    .trim()
    .max(300)
    .refine((value) => value === "" || /^https?:\/\/\S+$/.test(value), "Adresa începe cu https://.")
    .transform((value) => (value === "" ? null : value)),
  cont: noSecret("Contul", 200),
  cineAreAcces: noSecret("Cine are acces", 500),
  doiFa: z.enum(["da", "nu", "necunoscut"]),
  undeEParola: noSecret("Unde e parola", 200),
  abonament: z.number().min(0).max(1_000_000).nullable(),
  moneda: z.enum(["RON", "EUR", "USD"]),
  ciclu: z.enum(["lunar", "anual"]).nullable(),
  reinnoire: z
    .string()
    .refine((value) => value === "" || isDay(value), "Alege data reînnoirii.")
    .transform((value) => (value === "" ? null : value)),
  note: noSecret("Notele", 1000),
});
export type AccountInput = z.output<typeof accountSchema>;

function toCont(row: Row): ContFirma {
  return {
    id: String(row.id),
    nume: String(row.nume),
    categoria: (row.categoria as CategorieCont) ?? "altele",
    adresa: text(row.adresa),
    cont: text(row.cont),
    cineAreAcces: text(row.cine_are_acces),
    doiFa: (row.doi_fa as ContFirma["doiFa"]) ?? "necunoscut",
    undeEParola: text(row.unde_e_parola),
    abonament: row.abonament === null || row.abonament === undefined ? null : Number(row.abonament),
    moneda: (row.moneda as ContFirma["moneda"]) ?? "RON",
    ciclu: (row.ciclu as ContFirma["ciclu"]) ?? null,
    reinnoire: text(row.reinnoire),
    note: text(row.note),
    updatedAt: String(row.updated_at ?? row.created_at),
  };
}

export async function listAccounts(): Promise<Result<ContFirma[]>> {
  const admin = db();
  if (!admin) return { ok: false, message: NO_DB };
  const { data, error } = await admin.from("firma_conturi").select("*").order("nume", { ascending: true }).limit(1000);
  if (error) return failure(error, MIGRATION);
  return { ok: true, data: ((data ?? []) as Row[]).map(toCont) };
}

const toRow = (input: AccountInput, actor: string) => ({
  nume: input.nume,
  categoria: input.categoria,
  adresa: input.adresa,
  cont: input.cont,
  cine_are_acces: input.cineAreAcces,
  doi_fa: input.doiFa,
  unde_e_parola: input.undeEParola,
  abonament: input.abonament,
  moneda: input.moneda,
  ciclu: input.ciclu,
  reinnoire: input.reinnoire,
  note: input.note,
  updated_by: actor,
});

export async function saveAccount(id: string | null, input: AccountInput, actor: string): Promise<Result<{ id: string }>> {
  const admin = db();
  if (!admin) return { ok: false, message: NO_DB };
  if (id) {
    const { error } = await admin.from("firma_conturi").update(toRow(input, actor)).eq("id", id);
    if (error) return failure(error, MIGRATION);
    return { ok: true, data: { id } };
  }
  const { data, error } = await admin.from("firma_conturi").insert(toRow(input, actor)).select("id").single();
  if (error || !data) return failure(error, MIGRATION);
  return { ok: true, data: { id: String(data.id) } };
}

export async function deleteAccount(id: string): Promise<Result<null>> {
  const admin = db();
  if (!admin) return { ok: false, message: NO_DB };
  const { error } = await admin.from("firma_conturi").delete().eq("id", id);
  if (error) return failure(error, MIGRATION);
  return { ok: true, data: null };
}

/** Lista de bază, doar cu ce lipsește (după nume). */
export async function addStarterAccounts(actor: string): Promise<Result<{ added: number }>> {
  const admin = db();
  if (!admin) return { ok: false, message: NO_DB };
  const existing = await listAccounts();
  if (!existing.ok) return existing;
  const names = new Set(existing.data.map((account) => account.nume.toLowerCase()));
  const rows = STARTER_ACCOUNTS.filter((item) => !names.has(item.nume.toLowerCase())).map((item) => ({ nume: item.nume, categoria: item.categoria, adresa: item.adresa || null, updated_by: actor }));
  if (rows.length === 0) return { ok: true, data: { added: 0 } };
  const { error } = await admin.from("firma_conturi").insert(rows);
  if (error) return failure(error, MIGRATION);
  return { ok: true, data: { added: rows.length } };
}
