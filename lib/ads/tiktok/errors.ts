import "server-only";

import { NotPausedError } from "../meta/paused";
import { TikTokApiError, TikTokTokenMissingError } from "./api";

/**
 * Erorile TikTok spuse în română: ce s-a întâmplat și ce faci. Mesajul
 * original și `request_id` rămân atașate — suportul TikTok îl cere primul.
 */

/** Codurile TikTok cu tâlc pentru om (API v1.3). Restul primesc mesajul lor. */
const TOKEN_CODES = new Set([40102, 40104, 40105]);
/** Tokenul e bun, dar nu pentru contul ăsta (40106) sau aplicației îi lipsește un permis. */
const PERMISSION_CODES = new Set([40001, 40106, 40118, 40125]);
const RATE_CODES = new Set([40016, 40100, 40133]);
/** Scriere concurentă pe același obiect: se reia. */
const CONFLICT_CODES = new Set([40202]);

export const TIKTOK_VIDEO_TRANSCODING = 40901;
const VIDEO_UNREACHABLE = 40902;
const VIDEO_TOO_LARGE = 40907;

function tiktokSays(error: TikTokApiError): string {
  const { message, code, requestId } = error.info;
  const details = [code !== null ? `cod ${code}` : null, requestId ? `request ${requestId}` : null].filter(Boolean);
  return `TikTok: „${message}”${details.length > 0 ? ` (${details.join(", ")})` : ""}`;
}

export function describeTikTokError(error: unknown, what: string, tokenEnv: string): string {
  if (error instanceof TikTokTokenMissingError) {
    return `Spațiul nu are token: ${error.tokenEnv} nu e setat. Pune-l în Vercel → Settings → Environment Variables și fă redeploy.`;
  }
  if (error instanceof NotPausedError) {
    return `Garda de pauză a oprit ${what} înainte să plece spre TikTok: ${error.message} Nu s-a trimis nimic. E o greșeală de cod — spune-i asistentului.`;
  }
  if (!(error instanceof TikTokApiError)) {
    return `${capitalize(what)} a eșuat dintr-un motiv neașteptat: ${error instanceof Error ? error.message : String(error)}.`;
  }

  const { status, code, message } = error.info;
  if (status === 0) {
    return message === "timeout"
      ? `TikTok n-a răspuns în 25 de secunde la ${what}. Încearcă din nou.`
      : `${capitalize(what)} n-a ajuns la TikTok (eroare de rețea pe server). Încearcă din nou peste un minut.`;
  }
  if (code !== null && RATE_CODES.has(code)) {
    return `TikTok limitează temporar cererile. Așteaptă cinci minute și încearcă din nou. ${tiktokSays(error)}`;
  }
  if (code !== null && TOKEN_CODES.has(code)) {
    return `Tokenul ${tokenEnv} nu mai e valid — autorizarea aplicației a fost retrasă sau tokenul e greșit. Refă autorizarea (pașii din lib/ads/README.md → „Tokenurile TikTok”) și pune tokenul nou în Vercel. ${tiktokSays(error)}`;
  }
  if (code !== null && PERMISSION_CODES.has(code)) {
    return `Tokenul spațiului nu are voie să facă ${what}: contul de reclame nu e printre cele autorizate pentru aplicație, sau aplicației îi lipsește un permis (scope). ${tiktokSays(error)}`;
  }
  if (code !== null && CONFLICT_CODES.has(code)) {
    return `TikTok modifica același obiect în paralel și a refuzat ${what}. Încearcă din nou. ${tiktokSays(error)}`;
  }
  if (code === VIDEO_UNREACHABLE) {
    return `TikTok n-a putut descărca fișierul de la portal. Urcă-l din nou. ${tiktokSays(error)}`;
  }
  if (code === VIDEO_TOO_LARGE) {
    return `Fișierul e prea mare pentru TikTok. Exportă-l mai mic și urcă-l din nou. ${tiktokSays(error)}`;
  }
  if (status >= 500 || (code !== null && code >= 50000)) {
    return `TikTok a avut o eroare de partea lor la ${what}. Încearcă din nou peste un minut. ${tiktokSays(error)}`;
  }
  return `TikTok a refuzat ${what}. ${tiktokSays(error)}`;
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
