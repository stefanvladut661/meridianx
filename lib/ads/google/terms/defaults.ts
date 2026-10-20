/**
 * Valorile implicite ale regulilor unui cont nou în „Termeni” — până le schimbă
 * omul din portal. Cuvintele „de exclus” pornesc goale: ele țin de fiecare
 * client și stau în Supabase, nu în cod (repo-ul e public).
 */

/** Pragul de cost fără conversii, în moneda contului, peste care un termen devine propunere. */
export const DEFAULT_COST_THRESHOLD: Record<string, number> = { RON: 20, EUR: 5, USD: 5 };
