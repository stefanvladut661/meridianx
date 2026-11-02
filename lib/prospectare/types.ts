/**
 * Formele datelor Prospectare, cum le citesc paginile (rândurile din
 * tabelele `prospectare_*`, cu numele coloanelor din bază). Fără importuri de
 * server: se pot folosi și în componentele client.
 */

export const ETAPE_IDS = [
  "cercetat",
  "site_in_lucru",
  "site_gata",
  "email_trimis",
  "whatsapp_trimis",
  "sunat",
  "interesat",
  "client",
  "nu_contacta",
  "respins",
] as const;
export type Etapa = (typeof ETAPE_IDS)[number];

export const CANALE_IDS = ["email", "whatsapp", "telefon"] as const;
export type Canal = (typeof CANALE_IDS)[number];

export const REZULTATE_IDS = ["nu_raspunde", "interesat", "nu_vrea", "suna_inapoi", "numar_gresit", "trimis"] as const;
export type Rezultat = (typeof REZULTATE_IDS)[number];

export const UTILIZATORI_IDS = ["stefan", "vladut"] as const;
export type Utilizator = (typeof UTILIZATORI_IDS)[number];

export interface Firma {
  id: string;
  nr: number;
  nume: string;
  domeniu: string;
  site_vechi: string | null;
  nisa: string | null;
  oras: string | null;
  judet: string | null;
  scor: number | null;
  telefon: string | null;
  este_mobil: boolean;
  email: string | null;
  persoana_contact: string | null;
  etapa: Etapa;
  /** Când a primit emailul (o singură dată). */
  email_la: string | null;
  /** Când a primit mesajul pe WhatsApp (o singură dată) și de pe ce cont. */
  whatsapp_la: string | null;
  whatsapp_cont: number | null;
  /** Când a intrat în lista de apeluri; se golește doar după ultima încercare fără răspuns. */
  telefon_la: string | null;
  /** Al doilea canal permis de un admin din fișă (cu motiv); se consumă când e folosit. */
  canal_permis: Canal | null;
  canal_permis_motiv: string | null;
  canal_permis_la: string | null;
  canal_permis_de: string | null;
  /** Evaluarea robotului: eligibilă sau respinsă (cu motiv și scor). */
  evaluare: "eligibila" | "respinsa" | null;
  evaluare_motiv: string | null;
  evaluat_la: string | null;
  nisa_id: number | null;
  link_demo: string | null;
  captura_url: string | null;
  lot: string | null;
  slug: string | null;
  de_refacut: boolean;
  nota: string | null;
  date_extra: Record<string, unknown>;
  creat_la: string;
  actualizat_la: string;
}

/** Firma fără `date_extra` (lista mare din tabel nu o aduce). */
export type FirmaRand = Omit<Firma, "date_extra">;

export interface Activitate {
  id: number;
  firma_id: string;
  tip: string;
  canal: Canal | null;
  autor: string;
  detalii: Record<string, unknown>;
  la: string;
}

export interface ListaRand {
  id: number;
  data: string;
  utilizator: Utilizator;
  canal: "telefon";
  firma_id: string;
  rezultat: Rezultat | null;
  incercari: number;
  suna_inapoi_la: string | null;
  nota: string | null;
}

/** Un rând din lista zilei, cu firma lui. */
export interface ListaCuFirma extends ListaRand {
  firma: FirmaRand;
}

export interface Casuta {
  adresa: string;
  domeniu: string;
  limita_zi: number | null;
  incalzire_activa: boolean;
  activa: boolean;
  /** Ziua de azi (din `prospectare_casute_zi`), zero dacă n-a trimis nimic. */
  trimise_azi: number;
  limita_azi: number | null;
  limita_atinsa_la: string | null;
  bounce_azi: number;
  raspunsuri_azi: number;
}

export interface ZiCasute {
  zi: string;
  trimise: number;
  raspunsuri: number;
  bounce: number;
}

export interface Dispozitiv {
  id: string;
  nume: string;
  proprietar: string;
  activ: boolean;
  ultima_activitate: string | null;
  creat_la: string;
  /** Firma rezervată acum (rezervare neexpirată), dacă are. */
  firma_curenta: { id: string; nr: number; nume: string; expira_la: string; tip_lucru: string } | null;
  site_uri_azi: number;
  site_uri_total: number;
  /** Ce face acum: cercetare (pe o nișă), construcție (o firmă) sau trimitere (emailuri). */
  ce_face: "cercetare" | "constructie" | "trimitere" | null;
  ce_face_detaliu: string | null;
  ce_face_la: string | null;
}

/** Un cont de WhatsApp de pe care se trimite (din Setări). */
export interface ContWhatsapp {
  id: number;
  nume: string;
  telefon: string;
  /** Mesaje pe zi; peste limită e doar avertisment. */
  limita_zi: number;
  activ: boolean;
  ordine: number;
  actualizat_la: string;
  actualizat_de: string | null;
}

export const NISE_STATUS_IDS = ["libera", "rezervata", "in_cercetare", "terminata"] as const;
export type NisaStatus = (typeof NISE_STATUS_IDS)[number];

/** O nișă de pe tabla comună a roboților (nișă + zonă). */
export interface Nisa {
  id: number;
  nisa: string;
  zona: string;
  status: NisaStatus;
  dispozitiv_id: string | null;
  /** Numele robotului care a rezervat-o. */
  dispozitiv: string | null;
  rezervata_la: string | null;
  semn_la: string | null;
  terminata_la: string | null;
  gasite: number;
  eligibile: number;
  respinse: number;
  nota: string | null;
  creat_la: string;
  creat_de: string | null;
  /** Rezervată, dar fără semn de viață de 24 de ore: alt robot o poate prelua. */
  expirata: boolean;
}

export interface Setari {
  incercari_max: number;
  /** Vechi: limitele pe cont stau acum în `prospectare_conturi_whatsapp`. */
  whatsapp_pe_cont: Record<string, number>;
  rezervare_ore: number;
  /** Scorul minim pentru coada comună de construcție. */
  scor_minim_constructie: number;
  cereri_pe_minut: number;
  sablon_whatsapp_primul: string;
  sablon_whatsapp_dupa_apel: string;
  sablon_script_apel: string;
  actualizat_la: string;
  actualizat_de: string | null;
}

/** Un răspuns la email, din activitate (`tip = 'raspuns'`). */
export interface RaspunsEmail {
  id: number;
  firma: Pick<FirmaRand, "id" | "nr" | "nume" | "domeniu" | "etapa" | "persoana_contact" | "oras">;
  tip: "pozitiv" | "nu" | "automat" | "altul";
  extras: string | null;
  casuta: string | null;
  la: string;
}

/** Un email trimis azi, din activitate (`tip = 'email'`). */
export interface EmailTrimis {
  id: number;
  firma: Pick<FirmaRand, "id" | "nr" | "nume" | "domeniu" | "etapa">;
  casuta: string | null;
  la: string;
}
