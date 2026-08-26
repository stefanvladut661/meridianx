import { defineRouting } from "next-intl/routing";

/**
 * Rutare i18n.
 * RO e default și NU are prefix vizibil: /video, /software.
 *
 * **Lansăm doar în română.** Copy-ul de după redesign e scris direct
 * în componentele din `components/site/`, nu în `messages/`, deci o
 * rută `/en/*` ar fi afișat titluri englezești peste text românesc.
 * Până adaptăm copy-ul (CLAUDE.md §4: EN se adaptează, nu se traduce),
 * `en` iese din listă și `/en/*` dă 404 — mai onest decât o pagină
 * pe jumătate tradusă. `messages/en.json` rămâne în repo, nefolosit.
 *
 * `localeDetection: false` rămâne: și cu o singură limbă, next-intl ar
 * citi `Accept-Language` și ar redirecta rădăcina degeaba.
 */
export const routing = defineRouting({
  locales: ["ro"],
  defaultLocale: "ro",
  localePrefix: "as-needed",
  localeDetection: false,
});

export type Locale = (typeof routing.locales)[number];
