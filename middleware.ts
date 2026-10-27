import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  // /propunere = site-urile demo pentru prospecți, servite prin rewrite din
  // proiectul meridianx-propuneri: fără prefix de limbă, fără redirect.
  // Exclude API, admin, vault, interne Next și fișiere statice de la
  // rutarea i18n. `/vault` (feat/vault) e în afara i18n-ului ca și admin:
  // fără prefix de limbă, fără redirect, fără logică de marketing.
  matcher: ["/((?!api|admin|vault|propunere|_next|_vercel|.*\\..*).*)"],
};
