import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  // Exclude API, admin, interne Next și fișiere statice de la rutarea i18n.
  matcher: ["/((?!api|admin|_next|_vercel|.*\\..*).*)"],
};
