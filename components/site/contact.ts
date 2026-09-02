/**
 * Datele de contact, pe divizie.
 *
 * Fiecare divizie are propriul număr: video și software răspund la
 * telefoane diferite, deci nu există un „numărul firmei" comun.
 *
 * Numerele stau în cod, nu doar în env, din același motiv pentru care
 * stau și adresele de email: sunt date publice, tipărite pe cărți de
 * vizită, nu secrete. Dacă ar depinde exclusiv de env, un deploy fără
 * variabile ar publica un site cu numere de demonstrație. Env-ul
 * rămâne deasupra, pentru schimbare fără redeploy.
 *
 * Variabilele `NEXT_PUBLIC_*` sunt înlocuite la build, deci merg și în
 * componentele de client. Trebuie citite ca `process.env.NUME` întreg,
 * nu prin destructurare — bundler-ul nu le substituie altfel.
 */

/** Numerele reale ale diviziilor, în format național, cum se citesc. */
const PHONE_VIDEO = "0766 990 184";
const PHONE_SOFTWARE = "0771 738 607";

const ENV_PHONE_VIDEO = process.env.NEXT_PUBLIC_PHONE_VIDEO?.trim() || null;
const ENV_PHONE_SOFTWARE =
  process.env.NEXT_PUBLIC_PHONE_SOFTWARE?.trim() || null;
const ENV_WHATSAPP = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER?.trim() || null;
const ENV_EMAIL_VIDEO = process.env.NEXT_PUBLIC_EMAIL_VIDEO?.trim() || null;
const ENV_EMAIL_SOFTWARE =
  process.env.NEXT_PUBLIC_EMAIL_SOFTWARE?.trim() || null;

/** `tel:` acceptă doar cifre și `+` — spațiile și parantezele pică. */
function telHref(value: string): string {
  return `tel:${value.replace(/[^\d+]/g, "")}`;
}

/**
 * wa.me vrea numărul INTERNAȚIONAL, fără `+` și fără separatori.
 *
 * Un număr scris național („0771 738 607") ar deveni `wa.me/0771738607`,
 * adică un link care se deschide și nu găsește pe nimeni — eșec tăcut,
 * genul care se descoperă de la un client pierdut. Prefixul `0` de
 * interurban se înlocuiește deci cu indicativul de țară.
 */
function whatsappHref(value: string): string {
  const digits = value.replace(/\D/g, "");
  const international = digits.startsWith("0") ? `40${digits.slice(1)}` : digits;
  return `https://wa.me/${international}`;
}

export interface ContactChannels {
  phone: string;
  phoneHref: string;
  whatsapp: string;
  email: string;
  /** Adresa de email e încă una provizorie, neconfirmată de client. */
  isPlaceholder: boolean;
}

function build(
  fallbackPhone: string,
  envPhone: string | null,
  fallbackEmail: string,
  envEmail: string | null
): ContactChannels {
  const phone = envPhone ?? fallbackPhone;
  // WhatsApp cade pe numărul propriei divizii, nu pe unul comun.
  const whatsapp = ENV_WHATSAPP ?? phone;

  return {
    phone,
    phoneHref: telHref(phone),
    whatsapp: whatsappHref(whatsapp),
    email: envEmail ?? fallbackEmail,
    /* Adresa din cod e acum cea reală (contact@meridianx.ro), nu una de
       demonstrație — deci subsolul nu mai avertizează că e provizorie.
       Variabila din env rămâne, pentru schimbare fără redeploy. */
    isPlaceholder: false,
  };
}

export const VIDEO_CONTACT = build(
  PHONE_VIDEO,
  ENV_PHONE_VIDEO,
  "contact@meridianx.ro",
  ENV_EMAIL_VIDEO
);

export const SOFTWARE_CONTACT = build(
  PHONE_SOFTWARE,
  ENV_PHONE_SOFTWARE,
  "contact@meridianx.ro",
  ENV_EMAIL_SOFTWARE
);
