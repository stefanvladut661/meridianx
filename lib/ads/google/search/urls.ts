import "server-only";

import type { SearchUrlCheck } from "./types";

/**
 * Adresele finale ale planului de căutare (grupuri, anunțuri, linkuri
 * suplimentare), întrebate scurt înainte de creare: un 404 e o eroare (Google
 * ar respinge anunțul pentru „destinație nefuncțională”), o redirecționare e
 * un avertisment (Google cere ca adresa afișată și pagina să fie pe același
 * domeniu, iar o redirecționare spre alt domeniu se respinge).
 *
 * Aceeași prudență ca la sigla din planul video (`google/logo.ts`): doar
 * https, doar nume de domeniu publice (nu IP, nu localhost), fără să urmăm
 * redirecționările și fără să citim corpul. Pe calculatorul de dezvoltare,
 * cu Google-ul fals local, întrebarea merge la falsul lui (`/site?url=…`).
 */

const TIMEOUT_MS = 6_000;
const PARALLEL = 8;

function localOverride(): string | null {
  const override = process.env.GOOGLE_ADS_API_URL?.trim();
  return override && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(override) ? override : null;
}

function publicHttps(raw: string): URL | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  const host = url.hostname.toLowerCase();
  if (/^[\d.]+$/.test(host) || host.includes(":") || host === "localhost" || /\.(local|internal|localhost)$/.test(host) || !host.includes(".")) {
    return null;
  }
  return url;
}

async function ask(url: URL, method: "HEAD" | "GET"): Promise<Response> {
  const local = localOverride();
  const target = local ? `${local}/site?url=${encodeURIComponent(url.href)}` : url.href;
  return fetch(target, {
    method,
    redirect: "manual",
    cache: "no-store",
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { "User-Agent": "MeridianPortal/1.0 (verificarea adreselor din anunturi)" },
  });
}

async function checkOne(raw: string): Promise<SearchUrlCheck> {
  const url = publicHttps(raw);
  if (!url) return { url: raw, status: null, verdict: "error", note: "Adresa trebuie să fie https, pe un nume de domeniu public." };
  let response: Response;
  try {
    response = await ask(url, "HEAD");
    // Unele servere nu știu HEAD: le întrebăm cu GET, fără să citim pagina.
    if (response.status === 405 || response.status === 403 || response.status === 501) {
      response = await ask(url, "GET");
      void response.body?.cancel();
    }
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    return {
      url: raw,
      status: null,
      verdict: "redirect",
      note: timedOut ? `Nu răspunde în ${TIMEOUT_MS / 1000} secunde — verific-o în browser.` : "Nu s-a putut contacta — verific-o în browser.",
    };
  }
  const status = response.status;
  if (status >= 200 && status < 300) return { url: raw, status, verdict: "ok", note: null };
  if (status >= 300 && status < 400) {
    const location = response.headers.get("location");
    let target: string | null = null;
    try {
      target = location ? new URL(location, url).href : null;
    } catch {
      target = location;
    }
    const otherHost = target ? new URL(target).hostname.replace(/^www\./, "") !== url.hostname.replace(/^www\./, "") : false;
    return {
      url: raw,
      status,
      verdict: "redirect",
      note: target
        ? `Redirecționează spre ${target}.${otherHost ? " E alt domeniu: Google respinge anunțurile care duc pe alt domeniu decât cel afișat." : " Pune în plan adresa finală, ca omul să nu aștepte o redirecționare."}`
        : "Redirecționează, fără să spună unde.",
    };
  }
  if (status === 404 || status === 410) return { url: raw, status, verdict: "error", note: "Pagina nu există. Google ar respinge anunțul (destinație nefuncțională)." };
  if (status === 401 || status === 403) return { url: raw, status, verdict: "redirect", note: "Pagina cere autentificare sau refuză roboții — verific-o în browser." };
  return { url: raw, status, verdict: status >= 500 ? "error" : "redirect", note: status >= 500 ? "Serverul site-ului dă eroare." : null };
}

/** Fiecare adresă o singură dată, câte 8 în paralel. */
export async function checkUrls(urls: string[]): Promise<SearchUrlCheck[]> {
  const unique = [...new Set(urls)];
  const results: SearchUrlCheck[] = new Array(unique.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(PARALLEL, unique.length) }, async () => {
      while (next < unique.length) {
        const index = next++;
        results[index] = await checkOne(unique[index]);
      }
    })
  );
  return results;
}
