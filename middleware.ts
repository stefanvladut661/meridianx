import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  // Exclude API, admin, vault, interne Next și fișiere statice de la
  // rutarea i18n. `/vault` (feat/vault) e în afara i18n-ului ca și admin:
  // fără prefix de limbă, fără redirect, fără logică de marketing.
  matcher: ["/((?!api|admin|vault|_next|_vercel|.*\\..*).*)"],
};
