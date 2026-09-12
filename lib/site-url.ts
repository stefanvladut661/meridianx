/**
 * Adresa publică a site-ului, dintr-un singur loc.
 *
 * De ce nu direct `process.env.NEXT_PUBLIC_SITE_URL ?? "..."`: `??` prinde
 * doar `undefined` și `null`. O variabilă declarată în Vercel și lăsată
 * goală trece de el ca șir vid, iar `new URL("")` aruncă
 * `ERR_INVALID_URL` — adică build-ul întreg pică din cauza unui câmp gol
 * într-un formular din dashboard. S-a și întâmplat, la primul deploy.
 *
 * Aici tratăm ca „lipsă" orice valoare care nu e un URL folosibil:
 * șir gol, doar spații, sau text care nu se parsează. Domeniul scris
 * fără schemă (`meridianx.ro`) primește `https://`, fiindcă asta a vrut
 * să spună oricine îl scrie așa.
 */

/**
 * Host-ul canonic e cel CU `www`.
 *
 * Nu e o preferință de stil: `meridianx.ro` răspunde deja cu 308 spre
 * `www.meridianx.ro`, iar tot ce servește site-ul acum — canonical,
 * og:url, JSON-LD, robots.txt, sitemap.xml — scrie forma cu www. Dacă
 * fallback-ul de aici ar rămâne pe apex, orice build fără variabila din
 * Vercel (local, CI, un preview neconfigurat) ar genera adrese care fac
 * un salt în plus înainte să răspundă.
 *
 * Aceeași alegere trebuie ținută și în Vercel → Domains (www ca Primary
 * Domain) și în `NEXT_PUBLIC_SITE_URL`.
 */
const FALLBACK = "https://www.meridianx.ro";

function normalize(raw: string | undefined): string {
  const value = raw?.trim();
  if (!value) return FALLBACK;

  const withScheme = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  try {
    // `.origin` taie calea și slash-ul final, ca toate URL-urile
    // construite din el să arate la fel.
    return new URL(withScheme).origin;
  } catch {
    return FALLBACK;
  }
}

/** Fără slash la final. Sigur de concatenat cu o rută. */
export const SITE_URL = normalize(process.env.NEXT_PUBLIC_SITE_URL);
