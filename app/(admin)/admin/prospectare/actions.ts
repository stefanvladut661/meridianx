"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAdminUser } from "@/lib/supabase/clients";
import { db, failure, NO_DB, rpc, SESSION_EXPIRED } from "@/lib/prospectare/db";
import { COOKIE_UTILIZATOR, isUtilizator, UTILIZATORI } from "@/lib/prospectare/labels";
import { hashToken, newRobotToken } from "@/lib/prospectare/tokens";
import type { Utilizator } from "@/lib/prospectare/types";

/**
 * Acțiunile paginilor Prospectare. Fiecare verifică întâi sesiunea de admin
 * (Google + ADMIN_EMAILS), validează intrarea, apoi cheamă funcțiile din bază,
 * care impun regulile (un singur canal, „Nu contacta”, activitatea).
 * Autorul din activitate e omul ales în comutatorul Ștefan / Vlăduț.
 */

export type ActionResult<T = undefined> = { ok: true; message: string; data?: T } | { ok: false; message: string };

async function cine(): Promise<{ email: string; utilizator: Utilizator; nume: string } | null> {
  const user = await getAdminUser();
  if (!user) return null;
  const jar = await cookies();
  const ales = jar.get(COOKIE_UTILIZATOR)?.value;
  const utilizator: Utilizator = isUtilizator(ales) ? ales : "stefan";
  return { email: user.email ?? user.id, utilizator, nume: UTILIZATORI[utilizator] };
}

function gata(): void {
  revalidatePath("/admin/prospectare", "layout");
}

const invalid = (error: z.ZodError): ActionResult<never> => ({ ok: false, message: error.issues[0]?.message ?? "Date invalide." });

// ---------------------------------------------------------------------------
// Comutatorul Ștefan / Vlăduț
// ---------------------------------------------------------------------------

export async function alegeUtilizator(utilizator: string): Promise<ActionResult> {
  if (!(await getAdminUser())) return { ok: false, message: SESSION_EXPIRED };
  if (!isUtilizator(utilizator)) return { ok: false, message: "Alege Ștefan sau Vlăduț." };
  const jar = await cookies();
  jar.set(COOKIE_UTILIZATOR, utilizator, { path: "/admin/prospectare", httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 24 * 365 });
  gata();
  return { ok: true, message: `Acum lucrezi ca ${UTILIZATORI[utilizator]}.` };
}

// ---------------------------------------------------------------------------
// Listele zilei
// ---------------------------------------------------------------------------

const filtreSchema = z.object({
  nisa: z.string().trim().max(200).optional().default(""),
  oras: z.string().trim().max(120).optional().default(""),
  judet: z.string().trim().max(60).optional().default(""),
  scorMin: z.union([z.literal(""), z.coerce.number().int().min(0).max(1000)]).optional().default(""),
  doarMobil: z.boolean().optional().default(false),
});

const importSchema = z.object({
  canal: z.enum(["telefon", "whatsapp"]),
  numar: z.coerce.number().int("Câte firme: un număr întreg.").min(1, "Alege cel puțin o firmă.").max(500, "Cel mult 500 de firme odată."),
  cont: z.coerce.number().int().min(1).max(9).nullable().optional(),
  filtre: filtreSchema,
});

export async function importaLista(input: unknown): Promise<ActionResult<{ adaugate: number }>> {
  const who = await cine();
  if (!who) return { ok: false, message: SESSION_EXPIRED };
  const parsed = importSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { canal, numar, cont, filtre } = parsed.data;
  if (canal === "whatsapp" && !cont) return { ok: false, message: "Alege contul WhatsApp." };

  const result = await rpc<{ adaugate: number; motiv?: string; limita?: number; folosite?: number }>("prospectare_importa_lista_zi", {
    p_utilizator: who.utilizator,
    p_canal: canal,
    p_numar: numar,
    p_filtre: { nisa: filtre.nisa, oras: filtre.oras, judet: filtre.judet, scor_min: filtre.scorMin === "" ? "" : String(filtre.scorMin), doar_mobil: filtre.doarMobil },
    p_cont_whatsapp: canal === "whatsapp" ? cont : null,
    p_autor: who.nume,
  });
  if (!result.ok) return { ok: false, message: result.message };
  gata();
  const n = result.data.adaugate ?? 0;
  if (result.data.motiv === "limita_contului") {
    return { ok: false, message: `Contul ${cont} și-a atins limita de azi (${result.data.limita} mesaje). Alege alt cont sau mărește limita în Setări.` };
  }
  if (n === 0) return { ok: false, message: "Nicio firmă nu se potrivește filtrelor: toate cele cu site gata au deja un canal." };
  const unde = canal === "telefon" ? "lista ta de apeluri" : `lista de WhatsApp, contul ${cont}`;
  return { ok: true, message: `${n} ${n === 1 ? "firmă adăugată" : "firme adăugate"} în ${unde}. Au primit canalul ${canal === "telefon" ? "Telefon" : "WhatsApp"}.`, data: { adaugate: n } };
}

const rezultatSchema = z.object({
  listaId: z.coerce.number().int().positive(),
  rezultat: z.enum(["nu_raspunde", "interesat", "nu_vrea", "suna_inapoi", "numar_gresit"]),
  nota: z.string().trim().max(2000).optional(),
  sunaInapoiLa: z.string().datetime({ offset: true }).optional(),
});

export async function seteazaRezultat(input: unknown): Promise<ActionResult<{ revenit: boolean; scoasa: boolean; incercari: number; limita: number }>> {
  const who = await cine();
  if (!who) return { ok: false, message: SESSION_EXPIRED };
  const parsed = rezultatSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const result = await rpc<{ revenit: boolean; incercari: number; limita: number; scoasa?: boolean }>("prospectare_seteaza_rezultat", {
    p_lista: parsed.data.listaId,
    p_rezultat: parsed.data.rezultat,
    p_nota: parsed.data.nota ?? null,
    p_suna_inapoi_la: parsed.data.sunaInapoiLa ?? null,
    p_autor: who.nume,
  });
  if (!result.ok) return { ok: false, message: result.message };
  gata();
  const r = result.data;
  const message = r.revenit
    ? `Nu a răspuns la ${r.limita} încercări: firma iese din listă, își pierde canalul Telefon și revine în rezervă.`
    : r.scoasa
      ? "Număr greșit: firma e marcată „Nu contacta” și iese din listă."
      : "Rezultat salvat.";
  return { ok: true, message, data: { revenit: r.revenit, scoasa: Boolean(r.scoasa), incercari: r.incercari, limita: r.limita } };
}

const notaListaSchema = z.object({ listaId: z.coerce.number().int().positive(), nota: z.string().trim().max(2000) });

export async function salveazaNotaLista(input: unknown): Promise<ActionResult> {
  const who = await cine();
  if (!who) return { ok: false, message: SESSION_EXPIRED };
  const parsed = notaListaSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const client = db();
  if (!client) return { ok: false, message: NO_DB };
  const { error } = await client.from("prospectare_liste_zi").update({ nota: parsed.data.nota || null }).eq("id", parsed.data.listaId);
  if (error) return { ok: false, message: failure(error).message };
  gata();
  return { ok: true, message: "Notă salvată." };
}

export async function marcheazaWhatsapp(listaId: unknown): Promise<ActionResult> {
  const who = await cine();
  if (!who) return { ok: false, message: SESSION_EXPIRED };
  const id = z.coerce.number().int().positive().safeParse(listaId);
  if (!id.success) return { ok: false, message: "Rândul din listă nu e valid." };
  const result = await rpc<{ deja: boolean }>("prospectare_marcheaza_whatsapp", { p_lista: id.data, p_autor: who.nume });
  if (!result.ok) return { ok: false, message: result.message };
  gata();
  return { ok: true, message: result.data.deja ? "Era deja marcat ca trimis." : "Marcat ca trimis." };
}

// ---------------------------------------------------------------------------
// Firma
// ---------------------------------------------------------------------------

const etapaSchema = z.object({
  firmaId: z.uuid(),
  etapa: z.enum(["interesat", "client", "respins", "nu_contacta"]),
  motiv: z.string().trim().max(300).optional(),
});

export async function schimbaEtapa(input: unknown): Promise<ActionResult> {
  const who = await cine();
  if (!who) return { ok: false, message: SESSION_EXPIRED };
  const parsed = etapaSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const result = await rpc<{ schimbat: boolean }>("prospectare_schimba_etapa", {
    p_firma: parsed.data.firmaId,
    p_etapa: parsed.data.etapa,
    p_autor: who.nume,
    p_motiv: parsed.data.motiv ?? null,
  });
  if (!result.ok) return { ok: false, message: result.message };
  gata();
  const mesaje: Record<string, string> = {
    nu_contacta: "Marcată „Nu contacta”: iese din toate listele și nu mai primește niciun mesaj.",
    interesat: "Mutată la Interesați.",
    client: "Marcată Client.",
    respins: "Marcată Respins.",
  };
  return { ok: true, message: result.data.schimbat ? mesaje[parsed.data.etapa] : "Firma era deja în etapa asta." };
}

const notaSchema = z.object({ firmaId: z.uuid(), nota: z.string().trim().max(2000) });

export async function salveazaNota(input: unknown): Promise<ActionResult> {
  const who = await cine();
  if (!who) return { ok: false, message: SESSION_EXPIRED };
  const parsed = notaSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const result = await rpc<null>("prospectare_salveaza_nota", { p_firma: parsed.data.firmaId, p_nota: parsed.data.nota, p_autor: who.nume });
  if (!result.ok) return { ok: false, message: result.message };
  gata();
  return { ok: true, message: parsed.data.nota ? "Notă salvată." : "Notă ștearsă." };
}

// ---------------------------------------------------------------------------
// Roboți
// ---------------------------------------------------------------------------

const robotSchema = z.object({
  nume: z
    .string()
    .trim()
    .min(2, "Numele robotului: cel puțin 2 caractere.")
    .max(80, "Numele robotului: cel mult 80 de caractere.")
    .regex(/^[\p{L}\p{N}._ -]+$/u, "Numele robotului: litere, cifre, punct, liniuță, spațiu."),
  proprietar: z.string().trim().min(1, "Alege al cui e robotul.").max(80),
});

/** Creează robotul și întoarce tokenul O SINGURĂ DATĂ; în bază rămâne doar hash-ul. */
export async function creeazaRobot(input: unknown): Promise<ActionResult<{ token: string; nume: string }>> {
  const who = await cine();
  if (!who) return { ok: false, message: SESSION_EXPIRED };
  const parsed = robotSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const client = db();
  if (!client) return { ok: false, message: NO_DB };
  const token = newRobotToken();
  const { error } = await client
    .from("prospectare_dispozitive")
    .insert({ nume: parsed.data.nume, proprietar: parsed.data.proprietar, token_hash: hashToken(token), creat_de: who.nume });
  if (error) {
    const f = failure(error);
    return { ok: false, message: f.code === "23505" ? `Există deja un robot cu numele „${parsed.data.nume}”.` : f.message };
  }
  gata();
  return { ok: true, message: `Robotul ${parsed.data.nume} e creat. Copiază tokenul acum: nu se mai arată.`, data: { token, nume: parsed.data.nume } };
}

const comutaSchema = z.object({ id: z.uuid(), activ: z.boolean() });

export async function comutaRobot(input: unknown): Promise<ActionResult> {
  const who = await cine();
  if (!who) return { ok: false, message: SESSION_EXPIRED };
  const parsed = comutaSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const client = db();
  if (!client) return { ok: false, message: NO_DB };
  const { data, error } = await client
    .from("prospectare_dispozitive")
    .update({ activ: parsed.data.activ, schimbat_la: new Date().toISOString(), schimbat_de: who.nume })
    .eq("id", parsed.data.id)
    .select("nume")
    .maybeSingle();
  if (error) return { ok: false, message: failure(error).message };
  if (!data) return { ok: false, message: "Robotul nu mai există." };
  gata();
  return {
    ok: true,
    message: parsed.data.activ ? `${data.nume} e activ din nou.` : `${data.nume} e dezactivat: la următoarea cerere primește 401, iar firma lui trece la alt robot când expiră rezervarea.`,
  };
}

// ---------------------------------------------------------------------------
// Setări
// ---------------------------------------------------------------------------

const limiteSchema = z.object({
  incercariMax: z.coerce.number().int("Încercările: un număr întreg.").min(1, "Încercări: între 1 și 10.").max(10, "Încercări: între 1 și 10."),
  rezervareOre: z.coerce.number().int("Rezervarea: un număr întreg de ore.").min(1, "Rezervarea: între 1 și 24 de ore.").max(24, "Rezervarea: între 1 și 24 de ore."),
  cereriPeMinut: z.coerce.number().int().min(10, "Cereri pe minut: între 10 și 6000.").max(6000, "Cereri pe minut: între 10 și 6000."),
  whatsappPeCont: z
    .record(z.string().regex(/^[1-9]$/), z.coerce.number().int().min(0, "Limita pe cont: între 0 și 500.").max(500, "Limita pe cont: între 0 și 500."))
    .refine((v) => Object.keys(v).length >= 1 && Object.keys(v).length <= 9, "Între 1 și 9 conturi WhatsApp."),
});

export async function salveazaLimite(input: unknown): Promise<ActionResult> {
  const who = await cine();
  if (!who) return { ok: false, message: SESSION_EXPIRED };
  const parsed = limiteSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const client = db();
  if (!client) return { ok: false, message: NO_DB };
  const { error } = await client
    .from("prospectare_setari")
    .update({
      incercari_max: parsed.data.incercariMax,
      rezervare_ore: parsed.data.rezervareOre,
      cereri_pe_minut: parsed.data.cereriPeMinut,
      whatsapp_pe_cont: parsed.data.whatsappPeCont,
      actualizat_la: new Date().toISOString(),
      actualizat_de: who.nume,
    })
    .eq("id", 1);
  if (error) return { ok: false, message: failure(error).message };
  gata();
  return { ok: true, message: "Limitele sunt salvate." };
}

const sablonSchema = z.object({
  cheie: z.enum(["sablon_whatsapp_primul", "sablon_whatsapp_dupa_apel", "sablon_script_apel"]),
  text: z.string().trim().min(10, "Șablonul e prea scurt.").max(2000, "Șablonul: cel mult 2000 de caractere."),
});

export async function salveazaSablon(input: unknown): Promise<ActionResult> {
  const who = await cine();
  if (!who) return { ok: false, message: SESSION_EXPIRED };
  const parsed = sablonSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const client = db();
  if (!client) return { ok: false, message: NO_DB };
  const { error } = await client
    .from("prospectare_setari")
    .update({ [parsed.data.cheie]: parsed.data.text, actualizat_la: new Date().toISOString(), actualizat_de: who.nume })
    .eq("id", 1);
  if (error) return { ok: false, message: failure(error).message };
  gata();
  return { ok: true, message: "Șablonul e salvat." };
}

const casutaSchema = z.object({
  adresa: z.email().max(320),
  limitaZi: z.union([z.literal(""), z.null(), z.coerce.number().int().min(0, "Limita: între 0 și 2000.").max(2000, "Limita: între 0 și 2000.")]),
  activa: z.boolean().optional(),
});

export async function seteazaCasuta(input: unknown): Promise<ActionResult> {
  const who = await cine();
  if (!who) return { ok: false, message: SESSION_EXPIRED };
  const parsed = casutaSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const client = db();
  if (!client) return { ok: false, message: NO_DB };
  const patch: Record<string, unknown> = {
    limita_zi: parsed.data.limitaZi === "" || parsed.data.limitaZi === null ? null : parsed.data.limitaZi,
    actualizat_la: new Date().toISOString(),
  };
  if (typeof parsed.data.activa === "boolean") patch.activa = parsed.data.activa;
  const { data, error } = await client.from("prospectare_casute").update(patch).eq("adresa", parsed.data.adresa.toLowerCase()).select("adresa").maybeSingle();
  if (error) return { ok: false, message: failure(error).message };
  if (!data) return { ok: false, message: "Căsuța nu există încă: apare după primul email trimis de pe ea." };
  gata();
  return { ok: true, message: patch.limita_zi === null ? "Limita o dă acum încălzirea robotului." : `Limita căsuței e ${patch.limita_zi} pe zi.` };
}
