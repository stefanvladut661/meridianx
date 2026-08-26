/**
 * Datele de contact, citite din variabile de mediu.
 *
 * Lansarea înseamnă completarea env-ului, nu editarea componentelor:
 * `NEXT_PUBLIC_PHONE`, `NEXT_PUBLIC_WHATSAPP_NUMBER` și adresele per
 * divizie. Cât timp lipsesc, rămân numerele de demonstrație — și
 * `isPlaceholder` devine `true`, deci interfața o spune, nu ascunde.
 *
 * Variabilele `NEXT_PUBLIC_*` sunt inlocuite la build, deci merg și în
 * componentele de client. Trebuie citite ca `process.env.NUME` întreg,
 * nu prin destructurare — bundler-ul nu le substituie altfel.
 */

const PLACEHOLDER_PHONE = "+40 700 000 000";

const ENV_PHONE = process.env.NEXT_PUBLIC_PHONE?.trim() || null;
const ENV_WHATSAPP = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER?.trim() || null;
const ENV_EMAIL_VIDEO = process.env.NEXT_PUBLIC_EMAIL_VIDEO?.trim() || null;
const ENV_EMAIL_SOFTWARE =
  process.env.NEXT_PUBLIC_EMAIL_SOFTWARE?.trim() || null;

/** `tel:` acceptă doar cifre și `+` — spațiile și parantezele pică. */
function telHref(value: string): string {
  return `tel:${value.replace(/[^\d+]/g, "")}`;
}

/** wa.me vrea numărul internațional fără `+` și fără separatori. */
function whatsappHref(value: string): string {
  return `https://wa.me/${value.replace(/\D/g, "")}`;
}

export interface ContactChannels {
  phone: string;
  phoneHref: string;
  whatsapp: string;
  email: string;
  /** Măcar un canal e încă de demonstrație. */
  isPlaceholder: boolean;
}

function build(fallbackEmail: string, envEmail: string | null): ContactChannels {
  const phone = ENV_PHONE ?? PLACEHOLDER_PHONE;
  const whatsapp = ENV_WHATSAPP ?? ENV_PHONE ?? PLACEHOLDER_PHONE;

  return {
    phone,
    phoneHref: telHref(phone),
    whatsapp: whatsappHref(whatsapp),
    email: envEmail ?? fallbackEmail,
    isPlaceholder: !ENV_PHONE || !ENV_WHATSAPP || !envEmail,
  };
}

export const VIDEO_CONTACT = build("salut@meridianagency.ro", ENV_EMAIL_VIDEO);
export const SOFTWARE_CONTACT = build(
  "software@meridianagency.ro",
  ENV_EMAIL_SOFTWARE
);
