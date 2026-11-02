"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAdminUser } from "@/lib/supabase/clients";
import { db, failure, NO_DB, rpc, SESSION_EXPIRED } from "@/lib/prospectare/db";
import { COOKIE_UTILIZATOR, isUtilizator, UTILIZATORI } from "@/lib/prospectare/labels";
import { hashToken, newRobotToken } from "@/lib/prospectare/tokens";
import { citesteProgramabile } from "@/lib/prospectare/citire";
import type { CanalProgramare, ContWhatsapp, FirmaProgramabila, RezultatProgramare, Utilizator } from "@/lib/prospectare/types";

/**
 * Acțiunile paginilor Prospectare. Fiecare verifică întâi sesiunea de admin
 * (Google + ADMIN_EMAILS), validează intrarea, apoi cheamă funcțiile din bază,
 * care impun regulile (fiecare canal o singură dată, telefonul separat, „Nu contacta”, activitatea).
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
  lot: z.string().trim().max(200).optional().default(""),
  construitDe: z.string().trim().max(200).optional().default(""),
  gataDe: z.union([z.literal(""), z.iso.date()]).optional().default(""),
  gataPana: z.union([z.literal(""), z.iso.date()]).optional().default(""),
});

const importSchema = z.object({
  // Doar lista de apeluri se importă; WhatsApp-ul are lista lui, continuă.
  canal: z.literal("telefon", "Doar lista de apeluri se importă: WhatsApp-ul are lista lui, continuă."),
  numar: z.coerce.number().int("Câte firme: un număr întreg.").min(1, "Alege cel puțin o firmă.").max(500, "Cel mult 500 de firme odată."),
  filtre: filtreSchema,
});

export async function importaLista(input: unknown): Promise<ActionResult<{ adaugate: number }>> {
  const who = await cine();
  if (!who) return { ok: false, message: SESSION_EXPIRED };
  const parsed = importSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { canal, numar, filtre } = parsed.data;

  const result = await rpc<{ adaugate: number }>("prospectare_importa_lista_zi", {
    p_utilizator: who.utilizator,
    p_canal: canal,
    p_numar: numar,
    p_filtre: {
      nisa: filtre.nisa,
      oras: filtre.oras,
      judet: filtre.judet,
      scor_min: filtre.scorMin === "" ? "" : String(filtre.scorMin),
      doar_mobil: filtre.doarMobil,
      lot: filtre.lot,
      construit_de: filtre.construitDe,
      gata_de: filtre.gataDe,
      gata_pana: filtre.gataPana,
    },
    p_cont_whatsapp: null,
    p_autor: who.nume,
  });
  if (!result.ok) return { ok: false, message: result.message };
  gata();
  const n = result.data.adaugate ?? 0;
  if (n === 0) return { ok: false, message: "Nicio firmă din rezervă nu se potrivește filtrelor. Cele programate pe email sau WhatsApp nu intră în apeluri până la 00:00." };
  return { ok: true, message: `${n} ${n === 1 ? "firmă adăugată" : "firme adăugate"} în lista ta de apeluri, cele mai vechi site-uri primele. Rămân pe telefon până la 00:00.`, data: { adaugate: n } };
}

const rezultatSchema = z.object({
  listaId: z.coerce.number().int().positive(),
  rezultat: z.enum(["nu_raspunde", "interesat", "nu_vrea", "suna_inapoi", "numar_gresit"]),
  nota: z.string().trim().max(2000).optional(),
  sunaInapoiLa: z.string().datetime({ offset: true }).optional(),
});

export async function seteazaRezultat(input: unknown): Promise<ActionResult<{ revenit: boolean; doarEmail: boolean; incercari: number }>> {
  const who = await cine();
  if (!who) return { ok: false, message: SESSION_EXPIRED };
  const parsed = rezultatSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const result = await rpc<{ revenit: boolean; incercari: number; doar_email?: boolean }>("prospectare_seteaza_rezultat", {
    p_lista: parsed.data.listaId,
    p_rezultat: parsed.data.rezultat,
    p_nota: parsed.data.nota ?? null,
    p_suna_inapoi_la: parsed.data.sunaInapoiLa ?? null,
    p_autor: who.nume,
  });
  if (!result.ok) return { ok: false, message: result.message };
  gata();
  const r = result.data;
  const rez = parsed.data.rezultat;
  const message = r.doar_email
    ? "Număr greșit: firma se întoarce în distribuție, doar pentru email."
    : r.revenit
      ? `Nu a răspuns (încercarea ${r.incercari}): nu contează ca un contact, firma se întoarce în distribuție.`
      : rez === "nu_vrea"
        ? "Nu vrea: firma e „Nu contacta” și nu mai primește nimic."
        : rez === "interesat"
          ? "Interesat: firma rămâne pe telefon."
          : rez === "suna_inapoi"
            ? "Sună înapoi: firma rămâne pe telefon și trece în lista zilei următoare."
            : "Rezultat salvat.";
  return { ok: true, message, data: { revenit: r.revenit, doarEmail: Boolean(r.doar_email), incercari: r.incercari } };
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

const whatsappSchema = z.object({
  firmaId: z.uuid("Firma nu e validă."),
  // Gol = contul pe care e programată firma azi.
  cont: z.coerce.number().int("Alege contul WhatsApp.").min(1, "Alege contul WhatsApp.").max(99, "Alege contul WhatsApp.").nullable().optional(),
});

export interface WhatsappTrimis {
  nr: number;
  cont: number;
  contNume: string;
  trimiseAzi: number;
  limita: number;
  /** Contul a trecut de limita zilei: mesajul a plecat, e doar avertisment. */
  pesteLimita: boolean;
}

/**
 * WhatsApp către o firmă programată azi: „Trimite pe WhatsApp” deschide wa.me și
 * marchează firma ca trimisă. Baza pune data și contul o singură dată; a doua
 * cerere, de la oricine, e refuzată. În primele 2 minute se poate anula.
 */
export async function trimiteWhatsapp(input: unknown): Promise<ActionResult<WhatsappTrimis>> {
  const who = await cine();
  if (!who) return { ok: false, message: SESSION_EXPIRED };
  const parsed = whatsappSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  // Pe WhatsApp, autorul e contul de pe care pleacă mesajul (lista e comună, fără Ștefan / Vlăduț).
  const result = await rpc<{ nr: number; cont: number; cont_nume: string; trimise_azi: number; limita: number; peste_limita: boolean }>("prospectare_whatsapp_trimis", {
    p_firma: parsed.data.firmaId,
    p_cont: parsed.data.cont ?? null,
    p_autor: who.nume,
  });
  if (!result.ok) return { ok: false, message: result.message };
  gata();
  const r = result.data;
  return {
    ok: true,
    message: r.peste_limita
      ? `Trimis pe ${r.cont_nume}. Atenție: contul are ${r.trimise_azi} mesaje azi, peste limita de ${r.limita}.`
      : `Trimis pe ${r.cont_nume} (${r.trimise_azi}/${r.limita} azi).`,
    data: { nr: r.nr, cont: r.cont, contNume: r.cont_nume, trimiseAzi: r.trimise_azi, limita: r.limita, pesteLimita: r.peste_limita },
  };
}

/** „Anulează” în primele 2 minute după „Trimite pe WhatsApp”: firma se întoarce în lista de azi. */
export async function anuleazaWhatsapp(firmaId: unknown): Promise<ActionResult<{ nr: number; cont: number; trimiseAzi: number }>> {
  const who = await cine();
  if (!who) return { ok: false, message: SESSION_EXPIRED };
  const id = z.uuid().safeParse(firmaId);
  if (!id.success) return { ok: false, message: "Firma nu e validă." };
  const result = await rpc<{ nr: number; cont: number; trimise_azi: number; reprogramata: boolean }>("prospectare_whatsapp_anuleaza", { p_firma: id.data, p_autor: who.nume });
  if (!result.ok) return { ok: false, message: result.message };
  gata();
  return {
    ok: true,
    message: `Anulat: #${result.data.nr} e din nou în lista de azi.`,
    data: { nr: result.data.nr, cont: result.data.cont, trimiseAzi: result.data.trimise_azi },
  };
}

/**
 * WhatsApp după un apel „Interesat”: excepția acceptată de la separarea
 * telefonului. Firma rămâne pe Telefon; în activitate apare „Continuare apel
 * pe WhatsApp”, o singură dată pe apel. Baza refuză orice alt rezultat.
 */
export async function continuaPeWhatsapp(listaId: unknown): Promise<ActionResult<{ deja: boolean }>> {
  const who = await cine();
  if (!who) return { ok: false, message: SESSION_EXPIRED };
  const id = z.coerce.number().int().positive().safeParse(listaId);
  if (!id.success) return { ok: false, message: "Rândul din listă nu e valid." };
  const result = await rpc<{ deja: boolean }>("prospectare_continua_pe_whatsapp", { p_lista: id.data, p_autor: who.nume });
  if (!result.ok) return { ok: false, message: result.message };
  gata();
  return {
    ok: true,
    message: result.data.deja ? "Continuarea pe WhatsApp era deja în activitate." : "Scris în activitate: continuare apel pe WhatsApp.",
    data: { deja: result.data.deja },
  };
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
  scorMinimConstructie: z.coerce.number().int("Scorul minim: un număr întreg.").min(0, "Scorul minim: între 0 și 1000.").max(1000, "Scorul minim: între 0 și 1000."),
  emailPlafonCasuta: z.coerce.number().int("Plafonul de încălzire: un număr întreg.").min(0, "Plafonul de încălzire: între 0 și 500.").max(500, "Plafonul de încălzire: între 0 și 500.").optional(),
  apeluriPeZi: z.coerce.number().int("Apeluri pe zi: un număr întreg.").min(1, "Apeluri pe zi: între 1 și 500.").max(500, "Apeluri pe zi: între 1 și 500.").optional(),
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
      scor_minim_constructie: parsed.data.scorMinimConstructie,
      ...(parsed.data.emailPlafonCasuta === undefined ? {} : { email_plafon_casuta: parsed.data.emailPlafonCasuta }),
      ...(parsed.data.apeluriPeZi === undefined ? {} : { apeluri_pe_zi: parsed.data.apeluriPeZi }),
      actualizat_la: new Date().toISOString(),
      actualizat_de: who.nume,
    })
    .eq("id", 1);
  if (error) return { ok: false, message: failure(error).message };
  gata();
  return { ok: true, message: "Limitele sunt salvate." };
}

// ---------------------------------------------------------------------------
// Conturile de WhatsApp (Setări)
// ---------------------------------------------------------------------------

const contSchema = z.object({
  id: z.coerce.number().int().min(1).max(99).nullable().optional(),
  nume: z.string().trim().min(1, "Contul are nevoie de un nume.").max(60, "Numele: cel mult 60 de caractere."),
  telefon: z
    .string()
    .trim()
    .refine((v) => /^(40|0)?7\d{8}$/.test(v.replace(/\D/g, "")), "Numărul contului: un mobil românesc, ex. +40 771 464 310."),
  limita: z.coerce.number().int("Limita: un număr întreg.").min(0, "Limita pe zi: între 0 și 1000.").max(1000, "Limita pe zi: între 0 și 1000."),
  activ: z.boolean(),
});

export async function salveazaContWhatsapp(input: unknown): Promise<ActionResult<ContWhatsapp>> {
  const who = await cine();
  if (!who) return { ok: false, message: SESSION_EXPIRED };
  const parsed = contSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { id, nume, telefon, limita, activ } = parsed.data;
  const result = await rpc<ContWhatsapp>("prospectare_salveaza_cont_whatsapp", {
    p_id: id ?? null,
    p_nume: nume,
    p_telefon: telefon,
    p_limita: limita,
    p_activ: activ,
    p_autor: who.nume,
  });
  if (!result.ok) return { ok: false, message: result.message };
  gata();
  return { ok: true, message: id ? `${nume} e salvat${activ ? "" : " (dezactivat)"}.` : `${nume} e adăugat.`, data: result.data };
}

// ---------------------------------------------------------------------------
// Recontactare pe alt canal (din fișa firmei)
// ---------------------------------------------------------------------------

const recontactareSchema = z.object({
  firmaId: z.uuid("Firma nu e validă."),
  canal: z.enum(["email", "whatsapp", "telefon"], "Alege canalul."),
  motiv: z.string().trim().min(5, "Scrie motivul recontactării (cel puțin 5 caractere).").max(500, "Motivul: cel mult 500 de caractere."),
});

/** Un admin permite al doilea canal; firma intră în lista acelui canal. Se scrie în activitate. */
export async function permiteRecontactare(input: unknown): Promise<ActionResult> {
  const who = await cine();
  if (!who) return { ok: false, message: SESSION_EXPIRED };
  const parsed = recontactareSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const result = await rpc<{ nr: number; canal: string }>("prospectare_permite_recontactare", {
    p_firma: parsed.data.firmaId,
    p_canal: parsed.data.canal,
    p_motiv: parsed.data.motiv,
    p_autor: who.nume,
  });
  if (!result.ok) return { ok: false, message: result.message };
  gata();
  const unde = parsed.data.canal === "email" ? "robotul de email o poate lua" : parsed.data.canal === "whatsapp" ? "intră în lista de WhatsApp" : "intră în rezerva pentru apeluri";
  return { ok: true, message: `Recontactare permisă: ${unde}.` };
}

// ---------------------------------------------------------------------------
// Nișele (tabla comună a roboților)
// ---------------------------------------------------------------------------

const nisaSchema = z.discriminatedUnion("actiune", [
  z.object({ actiune: z.literal("adauga"), nisa: z.string().trim().min(1, "Scrie nișa.").max(120), zona: z.string().trim().min(1, "Scrie zona.").max(120) }),
  z.object({ actiune: z.literal("elibereaza"), id: z.coerce.number().int().positive() }),
]);

export async function nisaAdmin(input: unknown): Promise<ActionResult> {
  const who = await cine();
  if (!who) return { ok: false, message: SESSION_EXPIRED };
  const parsed = nisaSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const d = parsed.data;
  const result = await rpc<{ nisa: string; zona: string }>("prospectare_nisa_admin", {
    p_actiune: d.actiune,
    p_id: d.actiune === "elibereaza" ? d.id : null,
    p_nisa: d.actiune === "adauga" ? d.nisa : null,
    p_zona: d.actiune === "adauga" ? d.zona : null,
    p_autor: who.nume,
  });
  if (!result.ok) return { ok: false, message: result.message };
  gata();
  return { ok: true, message: d.actiune === "adauga" ? `„${result.data.nisa} · ${result.data.zona}” e pe tablă, liberă.` : `„${result.data.nisa} · ${result.data.zona}” e liberă: o poate lua orice robot.` };
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

// ---------------------------------------------------------------------------
// Distribuția: programarea manuală (Email, WhatsApp, Apeluri)
// ---------------------------------------------------------------------------

const canalSchema = z.enum(["email", "whatsapp", "telefon"], "Alege canalul: email, WhatsApp sau apeluri.");
const filtreProgramareSchema = z.object({
  lot: z.string().trim().max(200).optional(),
  construit_de: z.string().trim().max(200).optional(),
  nisa: z.string().trim().max(200).optional(),
  oras: z.string().trim().max(120).optional(),
  gata_de: z.union([z.literal(""), z.iso.date()]).optional(),
  gata_pana: z.union([z.literal(""), z.iso.date()]).optional(),
  cauta: z.string().trim().max(120).optional(),
});

/** Firmele din rezervă pentru dialogul „Programează” (pagini de câte 100). */
export async function cautaProgramabile(input: unknown): Promise<ActionResult<{ total: number; firme: FirmaProgramabila[] }>> {
  if (!(await cine())) return { ok: false, message: SESSION_EXPIRED };
  const parsed = z
    .object({ canal: canalSchema, filtre: filtreProgramareSchema, pagina: z.coerce.number().int().min(1).max(100).optional().default(1) })
    .safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const result = await citesteProgramabile(parsed.data.canal, parsed.data.filtre, 100, (parsed.data.pagina - 1) * 100);
  if (!result.ok) return { ok: false, message: result.message };
  return { ok: true, message: "", data: result.data };
}

const programeazaSchema = z
  .object({
    canal: canalSchema,
    zi: z.iso.date("Alege ziua."),
    firmaIds: z.array(z.uuid()).min(1, "Alege cel puțin o firmă.").max(500, "Cel mult 500 de firme odată."),
    // WhatsApp: contul, sau „egal” (împarte egal pe conturile active).
    cont: z.union([z.literal("egal"), z.coerce.number().int().min(1).max(99)]).optional(),
    // Apeluri: cine sună.
    utilizator: z.enum(["stefan", "vladut"]).optional(),
  })
  .refine((v) => v.canal !== "telefon" || v.utilizator, { message: "Alege cine sună: Ștefan sau Vlăduț.", path: ["utilizator"] });

/**
 * Programarea manuală: de mâine încolo. Ce nu încape în limita zilei trece în zilele
 * următoare, pe același canal (avertismentul spune până când). O firmă programată nu
 * poate fi programată pe alt canal; se poate anula până în ziua ei.
 */
export async function programeaza(input: unknown): Promise<ActionResult<RezultatProgramare>> {
  const who = await cine();
  if (!who) return { ok: false, message: SESSION_EXPIRED };
  const parsed = programeazaSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { canal, zi, firmaIds, cont, utilizator } = parsed.data;
  const result = await rpc<RezultatProgramare>("prospectare_programeaza", {
    p_canal: canal,
    p_zi: zi,
    p_firme: firmaIds,
    p_cont: canal === "whatsapp" && typeof cont === "number" ? cont : null,
    p_utilizator: canal === "telefon" ? utilizator : null,
    p_autor: who.nume,
  });
  if (!result.ok) return { ok: false, message: result.message };
  gata();
  const r = result.data;
  const canalText = ({ email: "email", whatsapp: "WhatsApp", telefon: "apeluri" } as Record<CanalProgramare, string>)[canal];
  if (r.programate === 0) {
    return { ok: false, message: `Nicio firmă programată pe ${canalText}: ${r.refuzate[0]?.motiv ?? "niciuna nu poate merge pe acest canal"}.` };
  }
  const baza = `${r.programate} ${r.programate === 1 ? "firmă programată" : "firme programate"} pe ${canalText}.`;
  return { ok: true, message: r.avertisment ? `${baza} ${r.avertisment}` : baza, data: r };
}

/** Anularea programărilor de mâine încolo (cele de azi rămân). */
export async function anuleazaProgramari(input: unknown): Promise<ActionResult<{ anulate: number; refuzate: number }>> {
  const who = await cine();
  if (!who) return { ok: false, message: SESSION_EXPIRED };
  const parsed = z.array(z.coerce.number().int().positive()).min(1, "Alege cel puțin o programare.").max(500).safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const result = await rpc<{ anulate: number; refuzate: number }>("prospectare_anuleaza_programari", { p_ids: parsed.data, p_autor: who.nume });
  if (!result.ok) return { ok: false, message: result.message };
  gata();
  const { anulate, refuzate } = result.data;
  if (anulate === 0) return { ok: false, message: "Nimic de anulat: programările de azi (sau deja folosite) nu se mai anulează." };
  return {
    ok: true,
    message: `${anulate} ${anulate === 1 ? "programare anulată" : "programări anulate"}; firmele se întorc în rezervă.${refuzate ? ` ${refuzate} erau deja pe azi sau folosite.` : ""}`,
    data: { anulate, refuzate },
  };
}
