import { db, failure, NO_DB, type Result } from "./db";
import { monthEnd, monthStart } from "./format";
import type { Client, Contact, Contract, Pret, StareContract } from "./contracte-shared";
import type { ClientInput, ContactInput, ContractInput } from "./schemas";

/**
 * Clienții firmei, persoanele de contact, contractele și prețurile pe
 * perioade (migrarea 16). Doar pe server, prin cheia de service.
 */

const MIGRATION = "16 (00000000000016_firma_baza.sql)";

type Row = Record<string, unknown>;
const text = (value: unknown) => (typeof value === "string" ? value : null);
const num = (value: unknown) => (value === null || value === undefined ? null : Number(value));

function toPret(row: Row): Pret {
  return { id: String(row.id), deLa: String(row.de_la), panaLa: text(row.pana_la), suma: Number(row.suma), descriere: String(row.descriere) };
}

function toContract(row: Row, prices: Pret[]): Contract {
  return {
    id: String(row.id),
    clientId: String(row.client_id),
    numar: text(row.numar),
    incepe: String(row.incepe),
    seTermina: text(row.se_termina),
    servicii: String(row.servicii),
    moneda: row.moneda === "EUR" ? "EUR" : "RON",
    bugetReclame: num(row.buget_reclame),
    ziEmitere: Number(row.zi_emitere),
    zileScadenta: Number(row.zile_scadenta),
    starea: (row.starea as StareContract) ?? "activ",
    note: text(row.note),
    preturi: prices.sort((a, b) => a.deLa.localeCompare(b.deLa)),
  };
}

function toContact(row: Row): Contact {
  return { id: String(row.id), nume: String(row.nume), rol: text(row.rol), telefon: text(row.telefon), email: text(row.email) };
}

/** Toți clienții (activi întâi), cu persoanele, contractele și prețurile lor. */
export async function listClients(options: { includeArchived?: boolean } = {}): Promise<Result<Client[]>> {
  const admin = db();
  if (!admin) return { ok: false, message: NO_DB };
  let clientsQuery = admin.from("firma_clienti").select("*").order("nume", { ascending: true }).limit(1000);
  if (!options.includeArchived) clientsQuery = clientsQuery.is("arhivat_la", null);
  const [clients, contacts, contracts, prices] = await Promise.all([
    clientsQuery,
    admin.from("firma_contacte").select("*").order("created_at", { ascending: true }).limit(5000),
    admin.from("firma_contracte").select("*").order("incepe", { ascending: false }).limit(5000),
    admin.from("firma_preturi").select("*").limit(10000),
  ]);
  const error = clients.error ?? contacts.error ?? contracts.error ?? prices.error;
  if (error) return failure(error, MIGRATION);

  const pricesByContract = new Map<string, Pret[]>();
  for (const row of (prices.data ?? []) as Row[]) {
    const list = pricesByContract.get(String(row.contract_id)) ?? [];
    list.push(toPret(row));
    pricesByContract.set(String(row.contract_id), list);
  }
  const contractsByClient = new Map<string, Contract[]>();
  for (const row of (contracts.data ?? []) as Row[]) {
    const list = contractsByClient.get(String(row.client_id)) ?? [];
    list.push(toContract(row, pricesByContract.get(String(row.id)) ?? []));
    contractsByClient.set(String(row.client_id), list);
  }
  const contactsByClient = new Map<string, Contact[]>();
  for (const row of (contacts.data ?? []) as Row[]) {
    const list = contactsByClient.get(String(row.client_id)) ?? [];
    list.push(toContact(row));
    contactsByClient.set(String(row.client_id), list);
  }

  return {
    ok: true,
    data: ((clients.data ?? []) as Row[]).map((row) => ({
      id: String(row.id),
      nume: String(row.nume),
      cui: text(row.cui),
      regCom: text(row.reg_com),
      adresa: text(row.adresa),
      oras: text(row.oras),
      judet: text(row.judet),
      tara: text(row.tara) ?? "România",
      emailFacturare: text(row.email_facturare),
      adsClientId: text(row.ads_client_id),
      note: text(row.note),
      oblioImportatLa: text(row.oblio_importat_la),
      arhivatLa: text(row.arhivat_la),
      contacte: contactsByClient.get(String(row.id)) ?? [],
      contracte: contractsByClient.get(String(row.id)) ?? [],
    })),
  };
}

export async function clientById(id: string): Promise<Result<Client | null>> {
  const all = await listClients({ includeArchived: true });
  if (!all.ok) return all;
  return { ok: true, data: all.data.find((client) => client.id === id) ?? null };
}

function clientRow(input: ClientInput) {
  return {
    nume: input.nume,
    cui: input.cui,
    reg_com: input.regCom,
    adresa: input.adresa,
    oras: input.oras,
    judet: input.judet,
    tara: input.tara,
    email_facturare: input.emailFacturare,
    note: input.note,
  };
}

export async function insertClient(input: ClientInput, actor: string, fromOblio: boolean): Promise<Result<{ id: string }>> {
  const admin = db();
  if (!admin) return { ok: false, message: NO_DB };
  const { data, error } = await admin
    .from("firma_clienti")
    .insert({ ...clientRow(input), created_by: actor, oblio_importat_la: fromOblio ? new Date().toISOString() : null })
    .select("id")
    .single();
  if (error || !data) return failure(error, MIGRATION);
  return { ok: true, data: { id: String(data.id) } };
}

export async function updateClient(id: string, input: ClientInput, fromOblio: boolean): Promise<Result<null>> {
  const admin = db();
  if (!admin) return { ok: false, message: NO_DB };
  const patch: Record<string, unknown> = clientRow(input);
  if (fromOblio) patch.oblio_importat_la = new Date().toISOString();
  const { error } = await admin.from("firma_clienti").update(patch).eq("id", id);
  if (error) return failure(error, MIGRATION);
  return { ok: true, data: null };
}

export async function setClientArchived(id: string, archived: boolean): Promise<Result<null>> {
  const admin = db();
  if (!admin) return { ok: false, message: NO_DB };
  const { error } = await admin.from("firma_clienti").update({ arhivat_la: archived ? new Date().toISOString() : null }).eq("id", id);
  if (error) return failure(error, MIGRATION);
  return { ok: true, data: null };
}

export async function setAdsLink(id: string, adsClientId: string | null): Promise<Result<null>> {
  const admin = db();
  if (!admin) return { ok: false, message: NO_DB };
  const { error } = await admin.from("firma_clienti").update({ ads_client_id: adsClientId }).eq("id", id);
  if (error) return failure(error, MIGRATION);
  return { ok: true, data: null };
}

export async function insertContact(clientId: string, input: ContactInput): Promise<Result<{ id: string }>> {
  const admin = db();
  if (!admin) return { ok: false, message: NO_DB };
  const { data, error } = await admin
    .from("firma_contacte")
    .insert({ client_id: clientId, nume: input.nume, rol: input.rol, telefon: input.telefon, email: input.email })
    .select("id")
    .single();
  if (error || !data) return failure(error, MIGRATION);
  return { ok: true, data: { id: String(data.id) } };
}

export async function deleteContact(id: string): Promise<Result<null>> {
  const admin = db();
  if (!admin) return { ok: false, message: NO_DB };
  const { error } = await admin.from("firma_contacte").delete().eq("id", id);
  if (error) return failure(error, MIGRATION);
  return { ok: true, data: null };
}

function contractRow(input: ContractInput) {
  return {
    numar: input.numar,
    incepe: input.incepe,
    se_termina: input.seTermina === "" ? null : input.seTermina,
    servicii: input.servicii,
    moneda: input.moneda,
    buget_reclame: input.bugetReclame,
    zi_emitere: input.ziEmitere,
    zile_scadenta: input.zileScadenta,
    starea: input.starea,
    note: input.note,
  };
}

/**
 * Contractul și prețurile lui. Prețurile se înlocuiesc ca set (perioadele sunt
 * luni întregi). Fără tranzacție în PostgREST: întâi contractul, apoi prețurile
 * noi, apoi se șterg cele vechi — o întrerupere lasă prețuri în plus, nu zero.
 */
export async function saveContract(clientId: string, contractId: string | null, input: ContractInput): Promise<Result<{ id: string }>> {
  const admin = db();
  if (!admin) return { ok: false, message: NO_DB };
  let id = contractId;
  if (id) {
    const { error } = await admin.from("firma_contracte").update(contractRow(input)).eq("id", id).eq("client_id", clientId);
    if (error) return failure(error, MIGRATION);
  } else {
    const { data, error } = await admin.from("firma_contracte").insert({ ...contractRow(input), client_id: clientId }).select("id").single();
    if (error || !data) return failure(error, MIGRATION);
    id = String(data.id);
  }

  const { data: old, error: oldError } = await admin.from("firma_preturi").select("id").eq("contract_id", id);
  if (oldError) return failure(oldError, MIGRATION);
  const rows = input.preturi.map((price) => ({
    contract_id: id,
    de_la: monthStart(price.deLa),
    pana_la: price.panaLa === "" ? null : monthEnd(price.panaLa),
    suma: price.suma,
    descriere: price.descriere,
  }));
  const { error: insertError } = await admin.from("firma_preturi").insert(rows);
  if (insertError) return failure(insertError, MIGRATION);
  const oldIds = (old ?? []).map((row) => String(row.id));
  if (oldIds.length > 0) {
    const { error: deleteError } = await admin.from("firma_preturi").delete().in("id", oldIds);
    if (deleteError) return failure(deleteError, MIGRATION);
  }
  return { ok: true, data: { id } };
}
