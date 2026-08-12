import { defineRouting } from "next-intl/routing";

/**
 * Rutare i18n (FAZA 0, ÎNGHEȚAT).
 * RO e default și NU are prefix vizibil: /video, /software.
 * EN are prefix: /en/video, /en/software.
 */
export const routing = defineRouting({
  locales: ["ro", "en"],
  defaultLocale: "ro",
  localePrefix: "as-needed",
});

export type Locale = (typeof routing.locales)[number];
