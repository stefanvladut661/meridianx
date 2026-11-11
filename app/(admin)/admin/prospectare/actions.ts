"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAdminUser } from "@/lib/supabase/clients";
import { db, failure, NO_DB, rpc, SESSION_EXPIRED } from "@/lib/prospectare/db";
import { COOKIE_UTILIZATOR, isUtilizator, UTILIZATORI } from "@/lib/prospectare/labels";
import { hashToken, newRobotToken } from "@/lib/prospectare/tokens";
import { citesteIdsFirme, citesteProgramabile } from "@/lib/prospectare/citire";
import { filtreDinAdresa } from "@/lib/prospectare/filtre";
import type { CanalProgramare, CanalStare, ContWhatsapp, FirmaProgramabila, RezultatAlocare, RezultatDistribuire, RezultatProgramare, Utilizator } from "@/lib/prospectare/types";

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

/** Un canal suspendat din Setări nu se poate distribui sau programa (migrarea 39). Null = activ. */
async function canalSuspendat(canal: "email" | "whatsapp" | "telefon"): Promise<string | null> {
  const client = db();
  if (!client) return null;
  const { data } = await client.from("prospectare_canale").select("activ, motiv").eq("canal", canal).maybeSingle();
  if (!data || data.activ) return null;
  const nume = canal === "email" ? "Emailul" : canal === "whatsapp" ? "WhatsApp-ul" : "Telefonul";
  return `${nume} e suspendat${data.motiv ? ` (${data.motiv})` : ""}. Îl pornești din Setări.`;
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
  canal: z.literal("telefon", "Doar lista de apeluri se importă."),
  numar: z.coerce.number().int("Câte firme: un număr întreg.").min(1, "Alege cel puțin o firmă.").max(500, "Cel mult 500 de firme odată."),
  filtre: filtreSchema,
});

export async function importaLista(input: unknown): Promise<ActionResult<{ adaugate: number }>> {
  const who = await cine();
  if (!who) return { ok: false, message: SESSION_EXPIRED };
  const parsed = importSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { canal, numar, filtre } = parsed.data;
  const suspendat = await canalSuspendat("telefon");
  if (suspendat) return { ok: false, message: suspendat };

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
  if (n === 0) return { ok: false, message: "Nicio firmă din rezervă pe aceste filtre. Cele programate pe email sau WhatsApp nu intră până nu pleacă sau nu le scoți din coadă." };
  return { ok: true, message: `${n} ${n === 1 ? "firmă adăugată" : "firme adăugate"} în lista ta de apeluri.`, data: { adaugate: n } };
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
    ? "Număr greșit: firma rămâne doar pentru email."
    : r.revenit
      ? `Nu răspunde (încercarea ${r.incercari}): firma se întoarce în distribuție.`
      : rez === "nu_vrea"
        ? "Nu vrea: firma e „Nu contacta”."
        : rez === "interesat"
          ? "Interesat: firma rămâne pe telefon."
          : rez === "suna_inapoi"
            ? "Sună înapoi: firma trece în lista de mâine."
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
  // Cine a apăsat: utilizatorul logat (contul Google al adminului), nu comutatorul Ștefan / Vlăduț.
  const result = await rpc<{ nr: number; cont: number; cont_nume: string; trimise_azi: number; limita: number; peste_limita: boolean }>("prospectare_whatsapp_trimis", {
    p_firma: parsed.data.firmaId,
    p_cont: parsed.data.cont ?? null,
    p_autor: who.email,
  });
  if (!result.ok) return { ok: false, message: result.message };
  gata();
  const r = result.data;
  return {
    ok: true,
    message: r.peste_limita
      ? `Trimis pe ${r.cont_nume}: ${r.trimise_azi} azi, peste limita de ${r.limita}.`
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
  const result = await rpc<{ nr: number; cont: number; trimise_azi: number; reprogramata: boolean }>("prospectare_whatsapp_anuleaza", { p_firma: id.data, p_autor: who.email });
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
    message: result.data.deja ? "Continuarea pe WhatsApp era deja notată." : "Continuarea pe WhatsApp e notată în activitate.",
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
    nu_contacta: "Marcată „Nu contacta”: iese din toate listele.",
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

const PROPRIETARI_ROBOT = ["Ștefan", "Vlăduț"] as const;
const proprietarSchema = z.enum(PROPRIETARI_ROBOT, "Alege Ștefan sau Vlăduț.");
/** Numele calculatorului, afișat mare („PC Ștefan”). Gol = se arată numele tehnic. */
const calculatorSchema = z
  .string()
  .trim()
  .max(80, "Calculatorul: cel mult 80 de caractere.")
  .regex(/^[\p{L}\p{N}._ ()'-]*$/u, "Calculatorul: litere, cifre, spațiu, punct, liniuță.");

const robotSchema = z.object({
  nume: z
    .string()
    .trim()
    .min(2, "Numele robotului: cel puțin 2 caractere.")
    .max(80, "Numele robotului: cel mult 80 de caractere.")
    .regex(/^[\p{L}\p{N}._ -]+$/u, "Numele robotului: litere, cifre, punct, liniuță, spațiu."),
  calculator: calculatorSchema.optional().default(""),
  proprietar: proprietarSchema,
});

const eticheta = (r: { nume: string; calculator?: string | null }) => r.calculator?.trim() || r.nume;

/** Creează robotul și întoarce tokenul O SINGURĂ DATĂ; în bază rămâne doar hash-ul. */
export async function creeazaRobot(input: unknown): Promise<ActionResult<{ token: string; nume: string }>> {
  const who = await cine();
  if (!who) return { ok: false, message: SESSION_EXPIRED };
  const parsed = robotSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const client = db();
  if (!client) return { ok: false, message: NO_DB };
  const token = newRobotToken();
  const { error } = await client.from("prospectare_dispozitive").insert({
    nume: parsed.data.nume,
    calculator: parsed.data.calculator || null,
    proprietar: parsed.data.proprietar,
    token_hash: hashToken(token),
    token_schimbat_la: new Date().toISOString(),
    creat_de: who.nume,
  });
  if (error) {
    const f = failure(error);
    return { ok: false, message: f.code === "23505" ? `Există deja un robot cu numele „${parsed.data.nume}”.` : f.message };
  }
  gata();
  const cum = eticheta(parsed.data);
  return { ok: true, message: `${cum} e adăugat. Copiază tokenul acum: nu se mai arată.`, data: { token, nume: cum } };
}

const idSchema = z.object({ id: z.uuid("Robotul nu mai există.") });

/**
 * Token nou: hash-ul din bază se înlocuiește, deci tokenul vechi nu mai merge din clipa asta (orice terminal care îl folosește
 * primește 401). Robotul e pornit din nou. Tokenul nou se întoarce O SINGURĂ DATĂ. Un robot arhivat nu primește token.
 */
export async function tokenNouRobot(input: unknown): Promise<ActionResult<{ token: string; nume: string }>> {
  const who = await cine();
  if (!who) return { ok: false, message: SESSION_EXPIRED };
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const client = db();
  if (!client) return { ok: false, message: NO_DB };
  const token = newRobotToken();
  const acum = new Date().toISOString();
  const { data, error } = await client
    .from("prospectare_dispozitive")
    .update({ token_hash: hashToken(token), activ: true, token_schimbat_la: acum, schimbat_la: acum, schimbat_de: who.nume })
    .eq("id", parsed.data.id)
    .is("arhivat_la", null)
    .select("nume, calculator")
    .maybeSingle();
  if (error) return { ok: false, message: failure(error).message };
  if (!data) {
    const { data: exista } = await client.from("prospectare_dispozitive").select("arhivat_la").eq("id", parsed.data.id).maybeSingle();
    return { ok: false, message: exista ? "Robotul e arhivat: scoate-l din arhivă, apoi cere un token nou." : "Robotul nu mai există." };
  }
  gata();
  const cum = eticheta(data);
  return { ok: true, message: `Token nou pentru ${cum}. Cel vechi nu mai merge.`, data: { token, nume: cum } };
}

const redenumesteSchema = z.object({ id: z.uuid("Robotul nu mai există."), calculator: calculatorSchema });

/** Redenumește: schimbă doar numele calculatorului (cel mare). Numele tehnic rămâne. */
export async function redenumesteRobot(input: unknown): Promise<ActionResult> {
  const who = await cine();
  if (!who) return { ok: false, message: SESSION_EXPIRED };
  const parsed = redenumesteSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const client = db();
  if (!client) return { ok: false, message: NO_DB };
  const { data, error } = await client
    .from("prospectare_dispozitive")
    .update({ calculator: parsed.data.calculator || null, schimbat_la: new Date().toISOString(), schimbat_de: who.nume })
    .eq("id", parsed.data.id)
    .select("nume, calculator")
    .maybeSingle();
  if (error) return { ok: false, message: failure(error).message };
  if (!data) return { ok: false, message: "Robotul nu mai există." };
  gata();
  return { ok: true, message: data.calculator ? `Calculatorul se numește acum „${data.calculator}”.` : `${data.nume} se arată cu numele tehnic.` };
}

const proprietarRobotSchema = z.object({ id: z.uuid("Robotul nu mai există."), proprietar: proprietarSchema });

export async function proprietarRobot(input: unknown): Promise<ActionResult> {
  const who = await cine();
  if (!who) return { ok: false, message: SESSION_EXPIRED };
  const parsed = proprietarRobotSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const client = db();
  if (!client) return { ok: false, message: NO_DB };
  const { data, error } = await client
    .from("prospectare_dispozitive")
    .update({ proprietar: parsed.data.proprietar, schimbat_la: new Date().toISOString(), schimbat_de: who.nume })
    .eq("id", parsed.data.id)
    .select("nume, calculator")
    .maybeSingle();
  if (error) return { ok: false, message: failure(error).message };
  if (!data) return { ok: false, message: "Robotul nu mai există." };
  gata();
  return { ok: true, message: `${eticheta(data)} e al lui ${parsed.data.proprietar}.` };
}

const arhiveazaSchema = z.object({ id: z.uuid("Robotul nu mai există."), arhivat: z.boolean() });

/**
 * Arhivează: robotul iese din listă, rămâne în istoric; tokenul lui nu mai merge, iar firmele, nișele și lacătul lui se
 * eliberează acum. Scoate din arhivă: revine în listă, oprit până la un token nou. Totul într-o funcție din bază (migrarea 40).
 */
export async function arhiveazaRobot(input: unknown): Promise<ActionResult> {
  const who = await cine();
  if (!who) return { ok: false, message: SESSION_EXPIRED };
  const parsed = arhiveazaSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const result = await rpc<{ nume: string; calculator: string | null; arhivat: boolean; deja: boolean; firme: number; nise: number; lacat: boolean }>(
    "prospectare_robot_arhiveaza",
    { p_id: parsed.data.id, p_arhivat: parsed.data.arhivat, p_autor: who.nume }
  );
  if (!result.ok) return { ok: false, message: result.message };
  gata();
  const r = result.data;
  const cum = eticheta(r);
  if (!r.arhivat) return { ok: true, message: r.deja ? `${cum} nu era arhivat.` : `${cum} e din nou în listă. Pornește cu un token nou.` };
  if (r.deja) return { ok: true, message: `${cum} era deja arhivat.` };
  const eliberate = [
    r.firme ? `${r.firme} ${r.firme === 1 ? "firmă" : "firme"}` : null,
    r.nise ? `${r.nise} ${r.nise === 1 ? "nișă" : "nișe"}` : null,
    r.lacat ? "lacătul de publicare" : null,
  ].filter(Boolean);
  return { ok: true, message: `${cum} e arhivat; tokenul lui nu mai merge.${eliberate.length ? ` Eliberate: ${eliberate.join(", ")}.` : ""}` };
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
  return { ok: true, message: "Limite salvate." };
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
  // Lipsă = titularul rămâne cum e; text gol = fără titular.
  titular: z.string().trim().max(60, "Titularul: cel mult 60 de caractere.").optional(),
});

export async function salveazaContWhatsapp(input: unknown): Promise<ActionResult<ContWhatsapp>> {
  const who = await cine();
  if (!who) return { ok: false, message: SESSION_EXPIRED };
  const parsed = contSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { id, nume, telefon, limita, activ, titular } = parsed.data;
  const result = await rpc<ContWhatsapp>("prospectare_salveaza_cont_whatsapp", {
    p_id: id ?? null,
    p_nume: nume,
    p_telefon: telefon,
    p_limita: limita,
    p_activ: activ,
    p_autor: who.nume,
    ...(titular === undefined ? {} : { p_titular: titular }),
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
  return { ok: true, message: d.actiune === "adauga" ? `„${result.data.nisa} · ${result.data.zona}” adăugată, liberă.` : `„${result.data.nisa} · ${result.data.zona}” eliberată.` };
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
  return { ok: true, message: "Șablon salvat." };
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
  const suspendat = await canalSuspendat(canal);
  if (suspendat) return { ok: false, message: suspendat };
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
    message: `${anulate} ${anulate === 1 ? "programare anulată" : "programări anulate"}, înapoi în rezervă.${refuzate ? ` ${refuzate} erau deja pe azi sau folosite.` : ""}`,
    data: { anulate, refuzate },
  };
}

// ---------------------------------------------------------------------------
// Tabelul Firme: „Selectează”, „Distribuie”, „Alocă pentru construcție” (migrarea 39)
// ---------------------------------------------------------------------------

/** „Selectează tot (din filtrul curent)”: id-urile firmelor din filtrele adresei, pe toate paginile (cel mult 5000). */
export async function idsDinFiltru(query: unknown): Promise<ActionResult<{ ids: string[] }>> {
  if (!(await cine())) return { ok: false, message: SESSION_EXPIRED };
  const parsed = z.string().max(2000).safeParse(query);
  if (!parsed.success) return { ok: false, message: "Filtrele nu sunt valide." };
  const result = await citesteIdsFirme(filtreDinAdresa(Object.fromEntries(new URLSearchParams(parsed.data))), 5000);
  if (!result.ok) return { ok: false, message: result.message };
  return { ok: true, message: "", data: { ids: result.data } };
}

const MAX_SELECTATE = 5000;
const firmeAlese = z.array(z.uuid()).min(1, "Alege cel puțin o firmă.").max(MAX_SELECTATE, `Cel mult ${MAX_SELECTATE} de firme odată.`);
const numere = z.array(z.coerce.number().int("Numerele: întregi.").min(0, "Numerele: de la 0 în sus.").max(MAX_SELECTATE)).max(99).nullable().optional();

const distribuieSchema = z.object({
  canal: canalSchema,
  zi: z.iso.date("Alege ziua."),
  firmaIds: firmeAlese,
  conturi: z.array(z.string().trim().min(1).max(320)).min(1, "Alege cel puțin un cont.").max(99),
  // null = „Împarte egal”; altfel câte firme pe fiecare cont, în ordinea conturilor.
  numere,
  ordine: z.enum(["scor", "recente"]).default("scor"),
  // Opțiunile avansate: firma → contul ales pentru ea.
  alocari: z.record(z.uuid(), z.string().trim().min(1).max(320)).optional(),
  proba: z.boolean().default(true),
});

/**
 * „Distribuie”: proba întoarce rezumatul (pe conturi, sărite cu motiv, avertismentele limitelor) fără să scrie;
 * fără probă, programează. Regulile le aplică baza (același canal nu de două ori, „Nu contacta”, link verificat, mobil).
 */
export async function distribuie(input: unknown): Promise<ActionResult<RezultatDistribuire>> {
  const who = await cine();
  if (!who) return { ok: false, message: SESSION_EXPIRED };
  const parsed = distribuieSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const d = parsed.data;
  const result = await rpc<RezultatDistribuire>("prospectare_distribuie", {
    p_canal: d.canal,
    p_zi: d.zi,
    p_firme: d.firmaIds,
    p_conturi: d.conturi,
    p_numere: d.numere ?? null,
    p_ordine: d.ordine,
    p_alocari: d.alocari ?? {},
    p_proba: d.proba,
    p_autor: who.nume,
  });
  if (!result.ok) return { ok: false, message: result.message };
  if (d.proba) return { ok: true, message: "", data: result.data };
  gata();
  const r = result.data;
  const canalText = ({ email: "email", whatsapp: "WhatsApp", telefon: "apel" } as Record<CanalProgramare, string>)[d.canal];
  if (r.programate === 0) return { ok: false, message: `Nicio firmă programată pe ${canalText}: ${r.sarite[0]?.motiv ?? "niciuna nu poate merge pe acest canal"}.` };
  const sarite = r.sarite.length ? ` ${r.sarite.length} ${r.sarite.length === 1 ? "sărită" : "sărite"}.` : "";
  return { ok: true, message: `${r.programate} ${r.programate === 1 ? "firmă programată" : "firme programate"} pe ${canalText}.${sarite}`, data: r };
}

const terminal = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9._-]{1,40}$/, "Terminalul: un nume scurt, ex. stefan-1 (litere, cifre, punct, liniuță).");

const alocaSchema = z.object({
  firmaIds: firmeAlese,
  terminale: z.array(terminal).min(1, "Alege cel puțin un terminal.").max(50),
  numere,
  proba: z.boolean().default(true),
});

/** „Alocă pentru construcție”: proba întoarce rezumatul; fără probă, scrie `alocat_lui`. */
export async function alocaConstructie(input: unknown): Promise<ActionResult<RezultatAlocare>> {
  const who = await cine();
  if (!who) return { ok: false, message: SESSION_EXPIRED };
  const parsed = alocaSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const d = parsed.data;
  const result = await rpc<RezultatAlocare>("prospectare_aloca_constructie", {
    p_firme: d.firmaIds,
    p_terminale: d.terminale,
    p_numere: d.numere ?? null,
    p_proba: d.proba,
    p_autor: who.nume,
  });
  if (!result.ok) return { ok: false, message: result.message };
  if (d.proba) return { ok: true, message: "", data: result.data };
  gata();
  const r = result.data;
  if (r.alocate === 0) return { ok: false, message: `Nicio firmă alocată: ${r.sarite[0]?.motiv ?? "niciuna nu mai e de construit"}.` };
  const pe = r.pe_terminale
    .filter((t) => t.n > 0)
    .map((t) => `${t.terminal} ${t.n}`)
    .join(", ");
  return { ok: true, message: `${r.alocate} ${r.alocate === 1 ? "firmă alocată" : "firme alocate"}: ${pe}.`, data: r };
}

// ---------------------------------------------------------------------------
// Canalele (Setări), restanțele, fișa firmei
// ---------------------------------------------------------------------------

const canalStareSchema = z.object({
  canal: canalSchema,
  activ: z.boolean(),
  motiv: z.string().trim().max(300, "Motivul: cel mult 300 de caractere.").optional(),
});

export async function seteazaCanal(input: unknown): Promise<ActionResult<CanalStare>> {
  const who = await cine();
  if (!who) return { ok: false, message: SESSION_EXPIRED };
  const parsed = canalStareSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const result = await rpc<CanalStare>("prospectare_seteaza_canal", {
    p_canal: parsed.data.canal,
    p_activ: parsed.data.activ,
    p_motiv: parsed.data.motiv ?? null,
    p_autor: who.nume,
  });
  if (!result.ok) return { ok: false, message: result.message };
  gata();
  const nume = parsed.data.canal === "email" ? "Emailul" : parsed.data.canal === "whatsapp" ? "WhatsApp-ul" : "Apelul";
  return { ok: true, message: parsed.data.activ ? `${nume} e activ.` : `${nume} e suspendat.`, data: result.data };
}

/** „Scoate din coadă”: programările netrimise (restanțe sau de azi) se anulează; firmele se pot distribui din nou. */
export async function scoateDinCoada(input: unknown): Promise<ActionResult<{ scoase: number }>> {
  const who = await cine();
  if (!who) return { ok: false, message: SESSION_EXPIRED };
  const parsed = z.array(z.coerce.number().int().positive()).min(1, "Alege cel puțin o firmă.").max(1000).safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const result = await rpc<{ scoase: number; refuzate: number }>("prospectare_scoate_din_coada", { p_ids: parsed.data, p_autor: who.nume });
  if (!result.ok) return { ok: false, message: result.message };
  gata();
  const n = result.data.scoase;
  if (n === 0) return { ok: false, message: "Nimic de scos: au plecat sau au fost scoase între timp." };
  return { ok: true, message: `${n} ${n === 1 ? "firmă scoasă" : "firme scoase"} din coadă.`, data: { scoase: n } };
}

const fisaActiuneSchema = z.object({
  firmaId: z.uuid("Firma nu e validă."),
  actiune: z.enum(["raspuns", "interesat", "client"]),
  canal: z.enum(["email", "whatsapp", "telefon"]).nullable().optional(),
  nota: z.string().trim().max(2000, "Nota: cel mult 2000 de caractere.").optional(),
});

/** Fișa firmei: „A răspuns”, „Interesat”, „Client”, fiecare cu o notă (în activitate). */
export async function marcheazaFirma(input: unknown): Promise<ActionResult> {
  const who = await cine();
  if (!who) return { ok: false, message: SESSION_EXPIRED };
  const parsed = fisaActiuneSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { firmaId, actiune, canal, nota } = parsed.data;
  if (actiune === "raspuns") {
    const result = await rpc<{ nr: number }>("prospectare_marcheaza_raspuns", { p_firma: firmaId, p_canal: canal ?? null, p_nota: nota ?? null, p_autor: who.nume });
    if (!result.ok) return { ok: false, message: result.message };
    gata();
    return { ok: true, message: "Notat: a răspuns. Al doilea canal nu mai pleacă singur." };
  }
  const result = await rpc<{ schimbat: boolean }>("prospectare_schimba_etapa", { p_firma: firmaId, p_etapa: actiune, p_autor: who.nume, p_motiv: nota || null });
  if (!result.ok) return { ok: false, message: result.message };
  gata();
  if (!result.data.schimbat) return { ok: true, message: actiune === "client" ? "Era deja Client." : "Era deja la Interesați." };
  return { ok: true, message: actiune === "client" ? "Marcată Client." : "Mutată la Interesați." };
}
