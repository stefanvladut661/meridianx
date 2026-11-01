import { db, failure, NO_DB, type Result } from "./db";
import type {
  Activitate,
  Canal,
  Casuta,
  Dispozitiv,
  EmailTrimis,
  Etapa,
  Firma,
  FirmaRand,
  ListaCuFirma,
  RaspunsEmail,
  Setari,
  Utilizator,
  ZiCasute,
} from "./types";

/**
 * Citirile paginilor Prospectare. Doar pe server, după garda de admin din
 * layout (cheia de service ocolește RLS). Nu importa din componente client.
 */

export const COLOANE_FIRMA =
  "id, nr, nume, domeniu, site_vechi, nisa, oras, judet, scor, telefon, este_mobil, email, persoana_contact, etapa, canal, canal_setat_la, canal_setat_de, link_demo, captura_url, lot, slug, de_refacut, nota, creat_la, actualizat_la";

const MIN_FIRMA = "id, nr, nume, domeniu, etapa, canal, persoana_contact, oras";

/** Supabase dă cel mult 1000 de rânduri pe cerere: citim pe pagini. */
async function toate<T>(fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { code?: string; message?: string } | null }>, max = 20000): Promise<Result<T[]>> {
  const out: T[] = [];
  for (let from = 0; from < max; from += 1000) {
    const { data, error } = await fetchPage(from, from + 999);
    if (error) return failure(error);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return { ok: true, data: out };
}

// ---------------------------------------------------------------------------
// Rezumat și opțiuni
// ---------------------------------------------------------------------------

export interface Rezumat {
  total: number;
  etape: Partial<Record<Etapa, number>>;
  canale: Partial<Record<Canal | "fara", number>>;
  de_refacut: number;
  rezerva_telefon: number;
  rezerva_whatsapp: number;
  in_lucru: number;
  roboti_activi: number;
  roboti: number;
  azi: {
    apeluri: number;
    apeluri_facute: number;
    whatsapp: number;
    whatsapp_trimise: number;
    emailuri: number;
    raspunsuri: number;
    bounce: number;
    site_uri: number;
    interesati: number;
  };
}

export async function citesteRezumat(): Promise<Result<Rezumat>> {
  const client = db();
  if (!client) return { ok: false, message: NO_DB };
  const { data, error } = await client.rpc("prospectare_rezumat");
  if (error) return failure(error);
  return { ok: true, data: data as Rezumat };
}

export interface Optiune {
  v: string;
  n: number;
}
export interface Optiuni {
  nise: Optiune[];
  orase: Optiune[];
  judete: Optiune[];
  loturi: Optiune[];
}

export async function citesteOptiuni(): Promise<Result<Optiuni>> {
  const client = db();
  if (!client) return { ok: false, message: NO_DB };
  const { data, error } = await client.rpc("prospectare_optiuni");
  if (error) return failure(error);
  return { ok: true, data: data as Optiuni };
}

// ---------------------------------------------------------------------------
// Firme
// ---------------------------------------------------------------------------

export interface FiltreFirme {
  q?: string | null;
  etapa?: Etapa | null;
  canal?: Canal | "fara" | null;
  nisa?: string | null;
  oras?: string | null;
  lot?: string | null;
  scorMin?: number | null;
  doarMobil?: boolean;
  doarRefacere?: boolean;
  ordine?: "scor" | "nr" | "actualizat" | "nume";
}

/** Ce folosim din constructorul de interogări Supabase (fără tipurile lui adânci, care încetinesc tsc). */
interface Filtrabil {
  eq(column: string, value: unknown): Filtrabil;
  is(column: string, value: null): Filtrabil;
  gte(column: string, value: number): Filtrabil;
  or(filters: string): Filtrabil;
}

function aplicaFiltre<Q>(query: Q, f: FiltreFirme): Q {
  let q = query as unknown as Filtrabil;
  if (f.etapa) q = q.eq("etapa", f.etapa);
  if (f.canal === "fara") q = q.is("canal", null);
  else if (f.canal) q = q.eq("canal", f.canal);
  if (f.nisa) q = q.eq("nisa", f.nisa);
  if (f.oras) q = q.eq("oras", f.oras);
  if (f.lot) q = q.eq("lot", f.lot);
  if (typeof f.scorMin === "number") q = q.gte("scor", f.scorMin);
  if (f.doarMobil) q = q.eq("este_mobil", true);
  if (f.doarRefacere) q = q.eq("de_refacut", true);
  const text = (f.q ?? "").trim().replace(/[%,()*]/g, " ").slice(0, 80).trim();
  if (text) {
    const nr = /^#?\d+$/.test(text) ? Number(text.replace("#", "")) : null;
    const like = `%${text}%`;
    q = q.or([`nume.ilike.${like}`, `domeniu.ilike.${like}`, `email.ilike.${like}`, `telefon.ilike.${like}`, nr ? `nr.eq.${nr}` : null].filter(Boolean).join(","));
  }
  return q as unknown as Q;
}

export async function citesteFirme(f: FiltreFirme, pagina = 1, pePagina = 50): Promise<Result<{ randuri: FirmaRand[]; total: number }>> {
  const client = db();
  if (!client) return { ok: false, message: NO_DB };
  const from = (Math.max(1, pagina) - 1) * pePagina;
  let query = aplicaFiltre(client.from("prospectare_firme").select(COLOANE_FIRMA, { count: "exact" }), f);
  query =
    f.ordine === "nr"
      ? query.order("nr", { ascending: true })
      : f.ordine === "actualizat"
        ? query.order("actualizat_la", { ascending: false })
        : f.ordine === "nume"
          ? query.order("nume", { ascending: true })
          : query.order("scor", { ascending: false, nullsFirst: false }).order("nr", { ascending: true });
  const { data, error, count } = await query.range(from, from + pePagina - 1);
  if (error) return failure(error);
  return { ok: true, data: { randuri: (data ?? []) as FirmaRand[], total: count ?? 0 } };
}

/** Toate firmele pentru filtre (exportul CSV), pe pagini de câte 1000. */
export async function citesteFirmeExport(f: FiltreFirme): Promise<Result<FirmaRand[]>> {
  const client = db();
  if (!client) return { ok: false, message: NO_DB };
  return toate<FirmaRand>((from, to) =>
    aplicaFiltre(client.from("prospectare_firme").select(COLOANE_FIRMA), f).order("nr", { ascending: true }).range(from, to) as unknown as PromiseLike<{ data: FirmaRand[] | null; error: { code?: string; message?: string } | null }>
  );
}

export interface FisaFirma {
  firma: Firma;
  activitate: Activitate[];
  liste: { id: number; data: string; utilizator: Utilizator; canal: "telefon" | "whatsapp"; rezultat: string | null; incercari: number }[];
  rezervare: { dispozitiv: string; tip_lucru: string; expira_la: string } | null;
}

export async function citesteFisa(id: string): Promise<Result<FisaFirma | null>> {
  const client = db();
  if (!client) return { ok: false, message: NO_DB };
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { ok: true, data: null };
  const [firma, activitate, liste, rezervare] = await Promise.all([
    client.from("prospectare_firme").select(`${COLOANE_FIRMA}, date_extra`).eq("id", id).maybeSingle(),
    client.from("prospectare_activitate").select("id, firma_id, tip, canal, autor, detalii, la").eq("firma_id", id).order("la", { ascending: false }).order("id", { ascending: false }).limit(200),
    client.from("prospectare_liste_zi").select("id, data, utilizator, canal, rezultat, incercari").eq("firma_id", id).order("data", { ascending: false }).limit(30),
    client.from("prospectare_rezervari").select("tip_lucru, expira_la, prospectare_dispozitive(nume)").eq("firma_id", id).gt("expira_la", new Date().toISOString()).maybeSingle(),
  ]);
  for (const r of [firma, activitate, liste, rezervare]) if (r.error) return failure(r.error);
  if (!firma.data) return { ok: true, data: null };
  const rez = rezervare.data as { tip_lucru: string; expira_la: string; prospectare_dispozitive: { nume: string } | { nume: string }[] | null } | null;
  const disp = rez ? (Array.isArray(rez.prospectare_dispozitive) ? rez.prospectare_dispozitive[0] : rez.prospectare_dispozitive) : null;
  return {
    ok: true,
    data: {
      firma: firma.data as Firma,
      activitate: (activitate.data ?? []) as Activitate[],
      liste: (liste.data ?? []) as FisaFirma["liste"],
      rezervare: rez ? { dispozitiv: disp?.nume ?? "robot", tip_lucru: rez.tip_lucru, expira_la: rez.expira_la } : null,
    },
  };
}

// ---------------------------------------------------------------------------
// Listele zilei
// ---------------------------------------------------------------------------

/** Mută pe azi listele neterminate din zilele trecute (o dată, la deschiderea paginii). */
export async function reporteazaListe(): Promise<void> {
  const client = db();
  if (!client) return;
  const { error } = await client.rpc("prospectare_reporteaza_liste");
  if (error) failure(error);
}

export async function citesteListaZi(utilizator: Utilizator, canal: "telefon" | "whatsapp", data: string): Promise<Result<ListaCuFirma[]>> {
  const client = db();
  if (!client) return { ok: false, message: NO_DB };
  const { data: rows, error } = await client
    .from("prospectare_liste_zi")
    .select(`id, data, utilizator, canal, cont_whatsapp, firma_id, rezultat, incercari, suna_inapoi_la, nota, firma:prospectare_firme(${COLOANE_FIRMA})`)
    .eq("utilizator", utilizator)
    .eq("canal", canal)
    .eq("data", data)
    .order("id", { ascending: true })
    .limit(1000);
  if (error) return failure(error);
  const randuri = (rows ?? []).map((r) => {
    const row = r as unknown as ListaCuFirma & { firma: FirmaRand | FirmaRand[] };
    return { ...row, firma: Array.isArray(row.firma) ? row.firma[0] : row.firma } as ListaCuFirma;
  });
  return { ok: true, data: randuri.filter((r) => r.firma) };
}

export interface GrupaRezerva {
  nisa: string | null;
  oras: string | null;
  judet: string | null;
  scor: number | null;
  este_mobil: boolean;
  n: number;
}

/** Rezerva pentru liste, grupată: pagina numără singură câte firme intră pe filtre. */
export async function citesteRezerva(): Promise<Result<GrupaRezerva[]>> {
  const client = db();
  if (!client) return { ok: false, message: NO_DB };
  return toate<GrupaRezerva>((from, to) => client.rpc("prospectare_rezerva_grupe").range(from, to) as unknown as PromiseLike<{ data: GrupaRezerva[] | null; error: { code?: string; message?: string } | null }>);
}

/** Câte rânduri de WhatsApp are azi fiecare cont (pentru limita pe cont). */
export async function citesteFolosireConturi(data: string): Promise<Result<Record<string, number>>> {
  const client = db();
  if (!client) return { ok: false, message: NO_DB };
  const { data: rows, error } = await client.from("prospectare_liste_zi").select("cont_whatsapp").eq("data", data).eq("canal", "whatsapp").limit(5000);
  if (error) return failure(error);
  const out: Record<string, number> = {};
  for (const r of rows ?? []) {
    const k = String((r as { cont_whatsapp: number | null }).cont_whatsapp ?? "");
    if (k) out[k] = (out[k] ?? 0) + 1;
  }
  return { ok: true, data: out };
}

// ---------------------------------------------------------------------------
// Setări
// ---------------------------------------------------------------------------

export async function citesteSetari(): Promise<Result<Setari>> {
  const client = db();
  if (!client) return { ok: false, message: NO_DB };
  const { data, error } = await client
    .from("prospectare_setari")
    .select("incercari_max, whatsapp_pe_cont, rezervare_ore, cereri_pe_minut, sablon_whatsapp_primul, sablon_whatsapp_dupa_apel, sablon_script_apel, actualizat_la, actualizat_de")
    .eq("id", 1)
    .maybeSingle();
  if (error) return failure(error);
  if (!data) return { ok: false, message: "Setările prospectării lipsesc: rulează din nou migrarea 28 în Supabase → SQL Editor." };
  return { ok: true, data: data as Setari };
}

// ---------------------------------------------------------------------------
// Email
// ---------------------------------------------------------------------------

export async function citesteCasute(azi: string): Promise<Result<Casuta[]>> {
  const client = db();
  if (!client) return { ok: false, message: NO_DB };
  const [casute, zi] = await Promise.all([
    client.from("prospectare_casute").select("adresa, domeniu, limita_zi, incalzire_activa, activa").order("domeniu").order("adresa"),
    client.from("prospectare_casute_zi").select("adresa, trimise, limita, limita_atinsa_la, bounce, raspunsuri").eq("zi", azi),
  ]);
  if (casute.error) return failure(casute.error);
  if (zi.error) return failure(zi.error);
  const peAdresa = new Map((zi.data ?? []).map((z) => [z.adresa as string, z]));
  return {
    ok: true,
    data: (casute.data ?? []).map((c) => {
      const z = peAdresa.get(c.adresa as string) as { trimise: number; limita: number | null; limita_atinsa_la: string | null; bounce: number; raspunsuri: number } | undefined;
      return {
        ...(c as Pick<Casuta, "adresa" | "domeniu" | "limita_zi" | "incalzire_activa" | "activa">),
        trimise_azi: z?.trimise ?? 0,
        limita_azi: (c.limita_zi as number | null) ?? z?.limita ?? null,
        limita_atinsa_la: z?.limita_atinsa_la ?? null,
        bounce_azi: z?.bounce ?? 0,
        raspunsuri_azi: z?.raspunsuri ?? 0,
      };
    }),
  };
}

/** Ultimele `zile` zile (inclusiv azi), adunate pe toate căsuțele. */
export async function citesteIstoricCasute(azi: string, zile = 14): Promise<Result<ZiCasute[]>> {
  const client = db();
  if (!client) return { ok: false, message: NO_DB };
  const start = new Date(`${azi}T12:00:00Z`);
  start.setUTCDate(start.getUTCDate() - (zile - 1));
  const de = start.toISOString().slice(0, 10);
  const { data, error } = await client.from("prospectare_casute_zi").select("zi, trimise, raspunsuri, bounce").gte("zi", de).lte("zi", azi).limit(5000);
  if (error) return failure(error);
  const peZi = new Map<string, ZiCasute>();
  for (let i = 0; i < zile; i++) {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    const k = d.toISOString().slice(0, 10);
    peZi.set(k, { zi: k, trimise: 0, raspunsuri: 0, bounce: 0 });
  }
  for (const r of (data ?? []) as ZiCasute[]) {
    const z = peZi.get(r.zi);
    if (z) {
      z.trimise += r.trimise;
      z.raspunsuri += r.raspunsuri;
      z.bounce += r.bounce;
    }
  }
  return { ok: true, data: [...peZi.values()] };
}

type FirmaMin = RaspunsEmail["firma"];

/** Supabase dă relația ca obiect sau ca listă: o aducem la obiect și scoatem rândurile fără firmă. */
function cuFirma<T extends { firma: FirmaMin | FirmaMin[] | null }>(rows: T[]): (Omit<T, "firma"> & { firma: FirmaMin })[] {
  const out: (Omit<T, "firma"> & { firma: FirmaMin })[] = [];
  for (const r of rows) {
    const firma = Array.isArray(r.firma) ? r.firma[0] : r.firma;
    if (firma) out.push({ ...r, firma });
  }
  return out;
}

export async function citesteEmailuriAzi(inceputAzi: string): Promise<Result<EmailTrimis[]>> {
  const client = db();
  if (!client) return { ok: false, message: NO_DB };
  const { data, error } = await client
    .from("prospectare_activitate")
    .select(`id, la, detalii, firma:prospectare_firme(${MIN_FIRMA})`)
    .eq("tip", "email")
    .gte("la", inceputAzi)
    .order("la", { ascending: false })
    .limit(500);
  if (error) return failure(error);
  return {
    ok: true,
    data: cuFirma((data ?? []) as unknown as { id: number; la: string; detalii: Record<string, unknown>; firma: FirmaMin | FirmaMin[] | null }[]).map((r) => ({
      id: r.id,
      la: r.la,
      casuta: typeof r.detalii?.casuta === "string" ? (r.detalii.casuta as string) : null,
      firma: r.firma,
    })),
  };
}

export async function citesteRaspunsuri(de: string): Promise<Result<RaspunsEmail[]>> {
  const client = db();
  if (!client) return { ok: false, message: NO_DB };
  const { data, error } = await client
    .from("prospectare_activitate")
    .select(`id, la, detalii, firma:prospectare_firme(${MIN_FIRMA})`)
    .eq("tip", "raspuns")
    .gte("la", de)
    .order("la", { ascending: false })
    .limit(300);
  if (error) return failure(error);
  return {
    ok: true,
    data: cuFirma((data ?? []) as unknown as { id: number; la: string; detalii: Record<string, unknown>; firma: FirmaMin | FirmaMin[] | null }[]).map((r) => {
      const tip = String(r.detalii?.tip ?? "altul");
      return {
        id: r.id,
        la: r.la,
        tip: (["pozitiv", "nu", "automat"].includes(tip) ? tip : "altul") as RaspunsEmail["tip"],
        extras: typeof r.detalii?.extras === "string" ? (r.detalii.extras as string) : null,
        casuta: typeof r.detalii?.casuta === "string" ? (r.detalii.casuta as string) : null,
        firma: r.firma,
      };
    }),
  };
}

// ---------------------------------------------------------------------------
// Activitate recentă și roboți
// ---------------------------------------------------------------------------

export type ActivitateCuFirma = Activitate & { firma: FirmaMin };

export async function citesteActivitateRecenta(limit = 20): Promise<Result<ActivitateCuFirma[]>> {
  const client = db();
  if (!client) return { ok: false, message: NO_DB };
  const { data, error } = await client
    .from("prospectare_activitate")
    .select(`id, firma_id, tip, canal, autor, detalii, la, firma:prospectare_firme(${MIN_FIRMA})`)
    .order("la", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit);
  if (error) return failure(error);
  return { ok: true, data: cuFirma((data ?? []) as unknown as (Activitate & { firma: FirmaMin | FirmaMin[] | null })[]) as ActivitateCuFirma[] };
}

export async function citesteDispozitive(): Promise<Result<Dispozitiv[]>> {
  const client = db();
  if (!client) return { ok: false, message: NO_DB };
  const [disp, rez, stat] = await Promise.all([
    client.from("prospectare_dispozitive").select("id, nume, proprietar, activ, ultima_activitate, creat_la").order("creat_la", { ascending: true }),
    client.from("prospectare_rezervari").select("dispozitiv_id, tip_lucru, expira_la, firma:prospectare_firme(id, nr, nume)").gt("expira_la", new Date().toISOString()),
    client.rpc("prospectare_statistici_roboti"),
  ]);
  if (disp.error) return failure(disp.error);
  if (rez.error) return failure(rez.error);
  if (stat.error) return failure(stat.error);
  const curent = new Map<string, Dispozitiv["firma_curenta"]>();
  for (const r of (rez.data ?? []) as unknown as { dispozitiv_id: string; tip_lucru: string; expira_la: string; firma: { id: string; nr: number; nume: string } | { id: string; nr: number; nume: string }[] | null }[]) {
    const f = Array.isArray(r.firma) ? r.firma[0] : r.firma;
    if (f) curent.set(r.dispozitiv_id, { id: f.id, nr: f.nr, nume: f.nume, expira_la: r.expira_la, tip_lucru: r.tip_lucru });
  }
  const peRobot = new Map(((stat.data ?? []) as { dispozitiv_id: string; azi: number; total: number }[]).map((s) => [s.dispozitiv_id, s]));
  return {
    ok: true,
    data: ((disp.data ?? []) as Omit<Dispozitiv, "firma_curenta" | "site_uri_azi" | "site_uri_total">[]).map((d) => ({
      ...d,
      firma_curenta: curent.get(d.id) ?? null,
      site_uri_azi: Number(peRobot.get(d.id)?.azi ?? 0),
      site_uri_total: Number(peRobot.get(d.id)?.total ?? 0),
    })),
  };
}

/** Ziua de azi și începutul ei, la București (ca în bază). */
export function aziBucuresti(now = new Date()): { azi: string; inceputAzi: string } {
  const azi = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Bucharest" }).format(now);
  // Ora României la miezul nopții: diferența față de UTC în acea zi (2 sau 3 ore).
  const probe = new Date(`${azi}T12:00:00Z`);
  const oraRo = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Bucharest", hour: "2-digit", hourCycle: "h23" }).format(probe));
  const decalaj = oraRo - 12;
  const inceput = new Date(Date.UTC(Number(azi.slice(0, 4)), Number(azi.slice(5, 7)) - 1, Number(azi.slice(8, 10)), -decalaj));
  return { azi, inceputAzi: inceput.toISOString() };
}
