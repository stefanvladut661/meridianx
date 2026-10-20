import { ADMIN_ACCESS_MESSAGES } from "@/lib/supabase/clients";

/**
 * Ce poate ajunge la /admin/login în `?eroare=`, trimis de rutele de
 * autentificare (`/admin/auth/google`, `/admin/auth/callback`).
 *
 * În URL stă doar codul scurt, niciodată textul sau adresa de email. Un
 * cod necunoscut nu afișează nimic.
 */
export const LOGIN_ERRORS = {
  neconfigurat:
    "Supabase nu e configurat pe acest mediu. Setează NEXT_PUBLIC_SUPABASE_URL și NEXT_PUBLIC_SUPABASE_ANON_KEY, apoi repornește serverul.",
  "prea-multe":
    "Prea multe încercări de pe rețeaua asta. Mai încearcă peste un sfert de oră.",
  "google-oprit":
    "Intrarea cu Google nu e pornită în Supabase. Pornește-o din Authentication → Sign In / Providers → Google, cu datele clientului OAuth din Google Cloud.",
  anulat:
    "Ai ieșit din fereastra Google înainte de final. Apasă din nou când vrei să intri.",
  "cont-nou-oprit":
    "Adresa asta nu are încă un cont în Supabase, iar înregistrările noi sunt oprite. Creează contul din Authentication → Users → Add user, cu aceeași adresă, apoi intră din nou cu Google.",
  google:
    "Google n-a confirmat intrarea. Mai încearcă o dată; dacă se repetă, verifică în Supabase că adresa /admin/auth/callback e la Redirect URLs.",
  "fara-acces": ADMIN_ACCESS_MESSAGES.not_allowlisted,
  "lista-lipsa": ADMIN_ACCESS_MESSAGES.allowlist_missing,
} as const;

export type LoginError = keyof typeof LOGIN_ERRORS;

export function loginErrorMessage(code: string | string[] | undefined): string | null {
  if (typeof code !== "string" || !Object.hasOwn(LOGIN_ERRORS, code)) return null;
  return LOGIN_ERRORS[code as LoginError];
}

/** Adresa paginii de login cu o eroare, pentru rutele de autentificare. */
export function loginWithError(origin: string, code: LoginError): URL {
  return new URL(`/admin/login?eroare=${code}`, origin);
}
