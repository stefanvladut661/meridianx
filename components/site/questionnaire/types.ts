/**
 * Chestionarele de descoperire trimise clienților înainte de ofertă.
 *
 * Un chestionar e doar conținut: întrebări cu răspuns liber, grupate pe
 * secțiuni. Aceeași interfață (`questionnaire.tsx`) și aceeași rută de
 * trimitere (`/api/chestionar`) le servesc pe toate; un client nou
 * înseamnă un fișier nou de conținut și o linie în `registry.ts`.
 */

export interface QuestionnaireQuestion {
  /** Cheie stabilă: ajunge în payload și în istoricul lead-ului. */
  id: string;
  /** Secțiunea afișată deasupra întrebării ("Site", "Secțiunea de cursuri"). */
  section: string;
  title: string;
  /** Rândul mic de sub întrebare. */
  hint?: string;
}

export interface QuestionnaireConfig {
  slug: string;
  /** Cui îi scriem, cum apare în salut: „doamna Diana". */
  salutation: string;
  /** Persoana și firma, pentru email și pentru lead. */
  clientName: string;
  clientCompany: string;
  /** Domeniul despre care e vorba, afișat în bară: „dianafilip.com". */
  subject: string;
  intro: string;
  questions: readonly QuestionnaireQuestion[];
  /** Precompletare pentru pasul final; omul le poate schimba. */
  defaults: { name: string; email: string };
}
