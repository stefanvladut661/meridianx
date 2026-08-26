import { defineRouting } from "next-intl/routing";

/**
 * Rutare i18n (FAZA 0, ÎNGHEȚAT).
 * RO e default și NU are prefix vizibil: /video, /software.
 * EN are prefix: /en/video, /en/software.
 *
 * `localeDetection: false` (F7): fără el, next-intl citește
 * `Accept-Language` și cookie-ul `NEXT_LOCALE` și redirecta `/` spre
 * `/en` pentru orice browser setat pe engleză — inclusiv al nostru.
 * Româna e limba sursă (CLAUDE.md §4), engleza se alege manual din
 * comutatorul de limbă, nu se ghicește din browser.
 */
export const routing = defineRouting({
  locales: ["ro", "en"],
  defaultLocale: "ro",
  localePrefix: "as-needed",
  localeDetection: false,
});

export type Locale = (typeof routing.locales)[number];
